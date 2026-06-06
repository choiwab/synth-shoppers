import clsx from "clsx";
import type { RunStatus } from "@/store/simStore";

const LABEL: Record<RunStatus, string> = {
  idle: "Idle",
  running: "Live",
  paused: "Paused",
  complete: "Complete",
};

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={clsx("status-badge", status)}>
      <span className="status-dot" />
      {LABEL[status]}
    </span>
  );
}
