import { useEffect, useRef } from "react";
import clsx from "clsx";
import { ARCHETYPE_HUE } from "@/types/contracts";
import { useSimStore } from "@/store/simStore";

function relTime(deltaMs: number): string {
  const s = Math.max(0, Math.round(deltaMs / 1000));
  if (s < 1) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function ActivityFeed() {
  const feed = useSimStore((s) => s.feed);
  const nowTs = useSimStore((s) => s.nowTs);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // auto-scroll to newest unless user scrolled up

  // newest-first: keep pinned to top unless the user scrolled away
  useEffect(() => {
    if (stickRef.current && listRef.current) listRef.current.scrollTop = 0;
  }, [feed]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollTop <= 12;
  };

  return (
    <section className="panel feed">
      <div className="section-head">
        <span className="section-title">Activity Feed</span>
        <span className="count-pill">{feed.length}</span>
      </div>
      <div className="feed-list" ref={listRef} onScroll={onScroll}>
        {feed.length === 0 && (
          <div className="muted" style={{ fontSize: 13, padding: 4 }}>
            Objections and buys will stream here…
          </div>
        )}
        {feed.map((item) => (
          <div
            key={item.id}
            className={clsx(
              "feed-item",
              item.kind === "buy" && "buy",
              item.kind === "divert" && "divert",
            )}
          >
            <span
              className="feed-dot"
              style={{ ["--hue" as string]: ARCHETYPE_HUE[item.archetype] }}
            />
            <div>
              <div className="feed-meta">
                <span className="feed-name">{item.name}</span>
                <span className="feed-time">{relTime(nowTs - item.ts)} ago</span>
              </div>
              <div
                className={clsx(
                  "feed-text",
                  item.kind === "buy" && "buy",
                  item.kind === "divert" && "divert",
                  item.kind === "thought" && "thought",
                  item.kind === "action" && "action",
                )}
              >
                {item.kind === "buy"
                  ? "bought ✓"
                  : item.kind === "thought"
                    ? `thinking: ${item.text}`
                    : item.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
