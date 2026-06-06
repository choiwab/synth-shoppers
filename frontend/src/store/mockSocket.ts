// Fixture player — replays fixtures/events.sample.jsonl over the SAME sink path
// as the real socket (PRD §4.7). This is what lets H1 finish M1 with no backend.
// Swap to H4's real fixture by replacing the .jsonl file; player path unchanged.
import type { AgentEvent } from "@/types/contracts";
import type { SimSocket } from "./socket";

type Sink = (ev: AgentEvent) => void;

const FIXTURE_URL = `${import.meta.env.BASE_URL}fixtures/events.sample.jsonl`;

async function loadEvents(): Promise<AgentEvent[]> {
  const res = await fetch(FIXTURE_URL);
  const text = await res.text();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as AgentEvent);
}

/**
 * Replays events honoring inter-event timestamp deltas, accelerated by `speed`.
 * Supports pause/resume. `speed` can be changed mid-run.
 */
export function connectMockSocket(
  _runId: string,
  sink: Sink,
  initialSpeed = 1,
): SimSocket {
  let paused = false;
  let closed = false;
  let speed = Math.max(1, initialSpeed);
  let timer: ReturnType<typeof setTimeout> | null = null;

  let events: AgentEvent[] = [];
  let i = 0;

  const schedule = (delayMs: number) => {
    if (closed) return;
    timer = setTimeout(tick, Math.max(0, delayMs / speed));
  };

  const tick = () => {
    if (closed || paused) return;
    if (i >= events.length) return;
    const ev = events[i];
    sink(ev);
    i += 1;
    if (i >= events.length) return;
    const dt = (events[i].ts ?? ev.ts) - (ev.ts ?? 0);
    // clamp pathological gaps so replay stays demo-snappy
    schedule(Math.min(Math.max(dt, 30), 1500));
  };

  loadEvents()
    .then((evs) => {
      events = evs;
      if (!closed && !paused) tick();
    })
    .catch((err) => {
      console.error("mockSocket: failed to load fixture", err);
    });

  return {
    pause() {
      paused = true;
      if (timer) clearTimeout(timer);
    },
    resume() {
      if (!paused) return;
      paused = false;
      tick();
    },
    setSpeed(s: number) {
      speed = Math.max(1, s);
    },
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  };
}
