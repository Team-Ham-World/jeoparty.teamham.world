import { StarterHome } from "../components/starter-home";

/*
  Root page. It only renders the shared StarterHome —
  all home content lives there so member routes can reuse it.
*/

export default function HomePage() {
  return <StarterHome />;
}
