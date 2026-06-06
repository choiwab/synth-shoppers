// Real WebSocket client for H4's stream (OVERVIEW §5.7).
// Shares the SimSocket interface with mockSocket so the swap is free (PRD §4.7).
import type { AgentEvent } from "@/types/contracts";
import { WS_BASE } from "./api";

export interface SimSocket {
  /** Pause local consumption (incoming events buffer until resume). */
  pause(): void;
  resume(): void;
  /** Replay-speed multiplier (mock only; real stream is server-paced). */
  setSpeed(speed: number): void;
  close(): void;
}

type Sink = (ev: AgentEvent) => void;

export function connectSocket(runId: string, sink: Sink): SimSocket {
  let ws: WebSocket | null = null;
  let paused = false;
  let closed = false;
  let backoff = 500;
  const buffer: AgentEvent[] = [];

  const flush = () => {
    while (!paused && buffer.length) sink(buffer.shift()!);
  };

  const handle = (raw: string) => {
    let ev: AgentEvent;
    try {
      ev = JSON.parse(raw) as AgentEvent;
    } catch {
      return; // ignore malformed frames
    }
    if (paused) buffer.push(ev);
    else sink(ev);
  };

  const open = () => {
    if (closed) return;
    ws = new WebSocket(`${WS_BASE}/ws/simulation/${runId}`);
    ws.onmessage = (e) => handle(typeof e.data === "string" ? e.data : "");
    ws.onopen = () => {
      backoff = 500;
    };
    ws.onclose = () => {
      if (closed) return;
      setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 8000); // exponential backoff
    };
    ws.onerror = () => ws?.close();
  };

  open();

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      flush();
    },
    setSpeed() {
      /* real stream is server-paced; no-op */
    },
    close() {
      closed = true;
      ws?.close();
    },
  };
}
