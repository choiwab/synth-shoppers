// Ties REST start/rerun + socket + store together. Imperative singleton so the
// left rail and tweaks panel drive the same backend run.
import { analyzeRun, fetchReport, rerunSimulation, startSimulation } from "./api";
import { connectSocket, type SimSocket } from "./socket";
import { useSimStore } from "./simStore";
import { currentListingConfig, useControlStore } from "./controlStore";
import { useIterationStore, type Iteration } from "./iterationStore";
import type { AgentEvent, ListingConfig, ProposedChange } from "@/types/contracts";

let socket: SimSocket | null = null;
// The diff applied to produce the NEXT run, threaded from applyProposedAndRerun →
// the iteration it creates (so the history can show "what changed to get here").
let pendingAppliedChanges: ProposedChange[] | undefined;

function attach(runId: string, listing: ListingConfig) {
  socket?.close();
  useIterationStore.getState().startIteration(runId, listing, pendingAppliedChanges);
  pendingAppliedChanges = undefined;
  const apply = useSimStore.getState().apply;
  // Wrap the pure reducer so completing a run auto-kicks the product-owner analysis.
  const sink = (ev: AgentEvent) => {
    apply(ev);
    if (ev.type === "run_complete") void onRunComplete(runId, ev.buy_rate);
  };
  socket = connectSocket(runId, sink);
}

/** When a run finishes: pull its report, then auto-run the LLM analysis that
 *  proposes the next listing. Surfaced in the left-rail iteration tracker. */
async function onRunComplete(runId: string, buyRate: number): Promise<void> {
  const iter = useIterationStore.getState();
  iter.completeIteration(runId, buyRate);
  try {
    const report = await fetchReport(runId);
    iter.setReport(runId, report);
    const analysis = await analyzeRun(runId);
    iter.setAnalysis(runId, analysis);
  } catch (error) {
    iter.setError(runId, error instanceof Error ? error.message : "Analysis failed");
  }
}

/** Start a fresh run from current tweaks. Resets the dashboard. */
export async function startRun(): Promise<void> {
  const c = useControlStore.getState();
  const listing = currentListingConfig(c);
  useSimStore.getState().reset();
  try {
    const { run_id } = await startSimulation({
      listing_config: listing,
      crowd: { personas: c.personas, crowd_size: c.personas.length * c.perPersona, speed: c.speed },
      mode: c.mode,
    });
    attach(run_id, listing);
  } catch (error) {
    useSimStore.setState({
      status: "error",
      error: error instanceof Error ? error.message : "Failed to start simulation",
    });
  }
}

/** Re-run with the current (possibly mutated) config — used by Re-run + H2's
 *  "Test this fix" handoff. */
export async function rerun(fromRecommendation?: string): Promise<void> {
  const c = useControlStore.getState();
  const listing = currentListingConfig(c);
  const prevRunId = useSimStore.getState().runId;
  useSimStore.getState().reset();
  try {
    const { run_id } = prevRunId
      ? await rerunSimulation(prevRunId, {
          listing_config: listing,
          from_recommendation: fromRecommendation,
        })
      : await startSimulation({
          listing_config: listing,
          crowd: { personas: c.personas, crowd_size: c.personas.length * c.perPersona, speed: c.speed },
          mode: c.mode,
        });
    attach(run_id, listing);
  } catch (error) {
    useSimStore.setState({
      status: "error",
      error: error instanceof Error ? error.message : "Failed to start simulation",
    });
  }
}

function latestReady(): Iteration | undefined {
  return useIterationStore
    .getState()
    .iterations.slice()
    .reverse()
    .find((it) => it.status === "ready" && it.analysis);
}

/** Apply a proposed listing from the iteration analysis, then spin up the next run.
 *  The mutated config re-renders the Shopee page on the next run (base64 handoff). */
export async function applyProposedAndRerun(): Promise<void> {
  const latest = latestReady();
  if (!latest?.analysis || latest.analysis.proposed_changes.length === 0) return;
  pendingAppliedChanges = latest.analysis.proposed_changes;
  useControlStore.getState().setListing(latest.analysis.proposed_listing);
  await rerun(`analysis:${latest.runId}`);
}

/** Wait until the most recent iteration reaches a terminal analysis state. */
function waitForLatestSettled(timeoutMs = 240_000): Promise<Iteration | undefined> {
  return new Promise((resolve) => {
    const settled = (it?: Iteration) => it && (it.status === "ready" || it.status === "error");
    const last = () => {
      const its = useIterationStore.getState().iterations;
      return its[its.length - 1];
    };
    if (settled(last())) return resolve(last());
    const timer = setTimeout(() => {
      unsub();
      resolve(last());
    }, timeoutMs);
    const unsub = useIterationStore.subscribe(() => {
      if (settled(last())) {
        clearTimeout(timer);
        unsub();
        resolve(last());
      }
    });
  });
}

let autoBusy = false;

/** One-click self-improvement: run, analyze, apply the proposal, repeat — up to
 *  `totalRuns` runs total (baseline counts as run 1). Stops early if a proposal
 *  has no changes. The baseline run is started if the dashboard is idle. */
export async function autoImprove(totalRuns = 3): Promise<void> {
  if (autoBusy) return;
  autoBusy = true;
  try {
    if (useIterationStore.getState().iterations.length === 0) {
      await startRun();
    }
    while (useIterationStore.getState().iterations.length < totalRuns) {
      const settled = await waitForLatestSettled();
      if (!settled || settled.status === "error") break;
      if (!settled.analysis || settled.analysis.proposed_changes.length === 0) break;
      await applyProposedAndRerun();
    }
  } finally {
    autoBusy = false;
  }
}

export function pauseRun(): void {
  socket?.pause();
  useSimStore.setState({ status: "paused" });
}

export function resumeRun(): void {
  socket?.resume();
  useSimStore.setState({ status: "running" });
}

export function setRunSpeed(speed: number): void {
  socket?.setSpeed(speed);
}

export function teardownRun(): void {
  socket?.close();
  socket = null;
}
