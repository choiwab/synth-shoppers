// Tracks each simulation run as an "iteration": the listing that ran, its outcome,
// and the post-run product-owner analysis that proposes the NEXT listing.
// Display-only state — side effects (start/analyze/apply) live in runController.ts.
import { create } from "zustand";
import type { ListingAnalysis, ListingConfig, ProposedChange, ViabilityReport } from "@/types/contracts";

export type IterationStatus = "running" | "analyzing" | "ready" | "error";

export interface Iteration {
  index: number; // 1-based
  runId: string;
  listing: ListingConfig; // the config this run actually used
  appliedChanges?: ProposedChange[]; // diff applied to get HERE from the previous iteration
  buyRate?: number;
  report?: ViabilityReport;
  analysis?: ListingAnalysis; // proposal for the NEXT listing
  status: IterationStatus;
  error?: string;
}

interface IterationStore {
  iterations: Iteration[];
  startIteration(runId: string, listing: ListingConfig, appliedChanges?: ProposedChange[]): void;
  completeIteration(runId: string, buyRate: number): void;
  setReport(runId: string, report: ViabilityReport): void;
  setAnalysis(runId: string, analysis: ListingAnalysis): void;
  setError(runId: string, error: string): void;
  clear(): void;
}

function patch(runId: string, fields: Partial<Iteration>) {
  return (s: IterationStore) => ({
    iterations: s.iterations.map((it) => (it.runId === runId ? { ...it, ...fields } : it)),
  });
}

export const useIterationStore = create<IterationStore>((set) => ({
  iterations: [],

  startIteration: (runId, listing, appliedChanges) =>
    set((s) => ({
      iterations: [
        ...s.iterations,
        { index: s.iterations.length + 1, runId, listing, appliedChanges, status: "running" as const },
      ],
    })),

  completeIteration: (runId, buyRate) => set(patch(runId, { buyRate, status: "analyzing" })),
  setReport: (runId, report) => set(patch(runId, { report })),
  setAnalysis: (runId, analysis) => set(patch(runId, { analysis, status: "ready" })),
  setError: (runId, error) => set(patch(runId, { error, status: "error" })),
  clear: () => set({ iterations: [] }),
}));

/** The most recent iteration that has a ready proposal (for the "Apply & run next" CTA). */
export function latestReadyIteration(s: IterationStore): Iteration | undefined {
  for (let i = s.iterations.length - 1; i >= 0; i--) {
    if (s.iterations[i].status === "ready" && s.iterations[i].analysis) return s.iterations[i];
  }
  return undefined;
}
