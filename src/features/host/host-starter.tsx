import { StarterPanel } from "@/components/starter-panel";
import { team } from "@/lib/team";

export function HostStarter() {
  return <StarterPanel area={team.host} />;
}
