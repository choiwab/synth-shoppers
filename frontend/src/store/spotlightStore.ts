// Shared "which agent is featured" selection + camera mode for the live monitor,
// so the funnel dots and persona roster can drive the AgentStrip spotlight.
import { create } from "zustand";

export type CameraMode = "spotlight" | "gallery";

interface SpotlightStore {
  pickedId?: string;
  mode: CameraMode;
  setMode(m: CameraMode): void;
  pick(id: string): void; // feature this agent + switch to spotlight
}

export const useSpotlight = create<SpotlightStore>((set) => ({
  mode: "spotlight",
  setMode: (mode) => set({ mode }),
  pick: (id) => set({ pickedId: id, mode: "spotlight" }),
}));
