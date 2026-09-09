import { StarterPanel } from "@/components/starter-panel";
import { team } from "@/lib/team";

export function BoardStarter() {
  return <StarterPanel area={team.board} />;
}
