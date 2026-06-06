import { PersonaRoster } from "./PersonaRoster";

// Activity feed removed — the persona roster now fills the whole right rail.
// (ActivityFeed.tsx is retained but unused; the feed is still built in the store.)
export function RightRail() {
  return (
    <div className="right-rail">
      <PersonaRoster />
    </div>
  );
}
