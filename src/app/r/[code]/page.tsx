import type { Metadata } from "next";
import { PlayerRoute } from "@/features/player/player-route";

export const metadata: Metadata = { title: "Play" };

export default async function PlayerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayerRoute code={decodeURIComponent(code).toUpperCase()} />;
}
