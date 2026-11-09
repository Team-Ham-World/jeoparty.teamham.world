import { connection } from "next/server";
import { HomeRoute } from "@/features/lobby/home-route";
import { socialMetadata } from "./social-metadata";

export async function generateMetadata() {
  // Docker supplies PUBLIC_ORIGIN at startup, after Next's build has finished.
  // Only home needs this opt-in; the root layout stays statically renderable.
  await connection();
  return socialMetadata();
}

export default function HomePage() {
  return <HomeRoute />;
}
