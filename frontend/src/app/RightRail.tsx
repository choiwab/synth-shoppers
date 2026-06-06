import { ActivityFeed } from "./ActivityFeed";
import { PersonaRoster } from "./PersonaRoster";

export function RightRail() {
  return (
    <div className="right-rail">
      <ActivityFeed />
      <PersonaRoster />
    </div>
  );
}
