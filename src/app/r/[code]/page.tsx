import type { Metadata } from "next";
import { ROOM_CODE_PATTERN } from "@/features/network/protocol";
import { PlayerRoute } from "@/features/player/player-route";
import { inviteDescription, socialMetadata } from "@/app/social-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const code = (await params).code.toUpperCase();
  const valid = ROOM_CODE_PATTERN.test(code);
  const title = valid ? `Join room ${code}` : "Join the game";
  return {
    ...socialMetadata({
      title: `${title} · HAM Quiz`,
      description: inviteDescription,
      pathname: valid ? `/r/${code}` : "/",
      card: "invite",
    }),
    title,
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayerRoute code={decodeURIComponent(code).toUpperCase()} />;
}
