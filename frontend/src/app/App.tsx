import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Sidebar } from "./Sidebar";
import { AgentStrip } from "./AgentStrip";
import { FunnelTrack } from "./FunnelTrack";
import { RightRail } from "./RightRail";
import { TweaksPanel } from "./TweaksPanel";
import { startRun, teardownRun } from "@/store/runController";

const STRIP_MIN = 220; // enough vertical room for readable agent monitors
const STRIP_DEFAULT = 460; // room for the spotlight + six Shopee monitor tiles
const ROW3_MIN = 280; // keep the funnel useful while giving agents more screen
const STORAGE_KEY = "synthetic.stripHeight.v2";

/** Largest strip height that still leaves ROW3_MIN for the lower row. */
function maxStrip(): number {
  // header now lives in the side rail, so the main column has more room:
  // ~32 shell padding + 2 gaps + resizer ≈ 60 of overhead.
  return Math.max(STRIP_MIN, window.innerHeight - ROW3_MIN - 60);
}

export function Dashboard() {
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [stripHeight, setStripHeight] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved && saved >= STRIP_MIN ? saved : STRIP_DEFAULT;
  });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  // Demo beat 1: dots flow on open. Auto-start a run on mount.
  useEffect(() => {
    void startRun();
    return () => teardownRun();
  }, []);

  // clamp on viewport resize so the lower row never gets squeezed away
  useEffect(() => {
    const onResize = () =>
      setStripHeight((h) => Math.min(Math.max(h, STRIP_MIN), maxStrip()));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      drag.current = { startY: e.clientY, startH: stripHeight };
      setDragging(true);
      document.body.style.userSelect = "none";
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [stripHeight],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    const next = Math.min(
      Math.max(drag.current.startH + dy, STRIP_MIN),
      maxStrip(),
    );
    setStripHeight(next);
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    document.body.style.userSelect = "";
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setStripHeight((h) => {
      localStorage.setItem(STORAGE_KEY, String(Math.round(h)));
      return h;
    });
  }, []);

  return (
    <div className="app-shell">
      <Sidebar onOpenTweaks={() => setTweaksOpen(true)} />

      <div className="main-col">
        <div className="strip-wrap" style={{ height: stripHeight }}>
          <AgentStrip />
        </div>

        <div
          className={clsx("row-resizer", dragging && "dragging")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => {
            setStripHeight(STRIP_DEFAULT);
            localStorage.setItem(STORAGE_KEY, String(STRIP_DEFAULT));
          }}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize agent preview"
          title="Drag to resize · double-click to reset"
        >
          <span className="grip" />
        </div>

        <div className="row3">
          <FunnelTrack />
          <RightRail />
        </div>
      </div>

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
    </div>
  );
}
