import type { Metadata } from "next";

const productionOrigin = "https://quiz.teamham.world";
const homeDescription =
  "A quiz-show party game for HAM: the host runs it, the TV shows the board, and everyone buzzes in from their phone.";
export const inviteDescription =
  "You're invited to a HAM Quiz game. Sign in with HAM and buzz in from your phone.";

/** No request headers: PUBLIC_ORIGIN is trusted server configuration, never a crawler's Host. */
export function metadataOrigin(): URL {
  const environment = process.env.APP_ENV ?? process.env.NODE_ENV;
  return new URL(
    process.env.PUBLIC_ORIGIN ||
      (environment === "production"
        ? productionOrigin
        : `http://127.0.0.1:${process.env.PORT || 3000}`),
  );
}

export function socialMetadata({
  title = "HAM Quiz",
  description = homeDescription,
  pathname = "/",
  card = "home",
}: {
  title?: string;
  description?: string;
  pathname?: string;
  card?: "home" | "invite";
} = {}): Metadata {
  const metadataBase = metadataOrigin();
  const image = {
    url: new URL(`/og/${card}.png`, metadataBase).href,
    width: 1200,
    height: 630,
    alt:
      card === "home"
        ? "HAM Quiz. Pick a clue. Beat your friends to the buzzer. A paper quiz board and phone buzzer."
        : "You're invited. Join the game on HAM Quiz. Sign in with HAM and buzz in from your phone.",
  };
  return {
    metadataBase,
    description,
    openGraph: {
      type: "website",
      siteName: "HAM Quiz",
      title,
      description,
      url: new URL(pathname, metadataBase).href,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
