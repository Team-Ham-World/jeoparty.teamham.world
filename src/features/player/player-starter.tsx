import { StarterPanel } from "@/components/starter-panel";
import { team } from "@/lib/team";

export function PlayerStarter() {
  return <StarterPanel area={team.player} />;
}
