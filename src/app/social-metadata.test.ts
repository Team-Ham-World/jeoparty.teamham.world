import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateMetadata as homeMetadata } from "./page";
import { generateMetadata as roomMetadata } from "./r/[code]/page";
import { metadataOrigin } from "./social-metadata";

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PUBLIC_ORIGIN", "https://quiz.teamham.world");
});
afterEach(() => vi.unstubAllEnvs());

describe("social metadata", () => {
  it("includes complete home metadata in the root defaults", async () => {
    // Import after configuring the environment: root defaults are evaluated on import.
    const { metadata } = await import("./layout");
    const image = {
      url: "https://quiz.teamham.world/og/home.png",
      width: 1200,
      height: 630,
      alt: expect.stringContaining("paper quiz board and phone buzzer"),
    };
    expect(metadata.title).toEqual({ default: "HAM Quiz", template: "%s · HAM Quiz" });
    expect(metadata.description).toEqual(expect.stringContaining("quiz-show party game"));
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      siteName: "HAM Quiz",
      title: "HAM Quiz",
      description: metadata.description,
      url: "https://quiz.teamham.world/",
      images: [image],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "HAM Quiz",
      description: metadata.description,
      images: [image],
    });
  });

  it.each(["BCDFG", "bcdfg"])("normalizes the valid room code %s", async (code) => {
    const result = await roomMetadata({ params: Promise.resolve({ code }) });
    expect(result.title).toBe("Join room BCDFG");
    expect(result.openGraph).toMatchObject({
      type: "website",
      siteName: "HAM Quiz",
      title: "Join room BCDFG · HAM Quiz",
      description:
        "You're invited to a HAM Quiz game. Sign in with HAM and buzz in from your phone.",
      url: "https://quiz.teamham.world/r/BCDFG",
      images: [
        {
          url: "https://quiz.teamham.world/og/invite.png",
          width: 1200,
          height: 630,
          alt: expect.stringContaining("Join the game on HAM Quiz"),
        },
      ],
    });
    expect(result.twitter).toMatchObject({
      card: "summary_large_image",
      images: [{ url: "https://quiz.teamham.world/og/invite.png" }],
    });
  });

  it.each(["private-input", "<script>alert(1)</script>", "BCDFG?name=private", "ABCDE", "BCDFGH"])(
    "never echoes invalid input %s",
    async (code) => {
      const result = await roomMetadata({ params: Promise.resolve({ code }) });
      expect(result.title).toBe("Join the game");
      expect(result.openGraph).toMatchObject({
        url: "https://quiz.teamham.world/",
        images: [{ url: "https://quiz.teamham.world/og/invite.png" }],
      });
      expect(JSON.stringify(result)).not.toContain(code);
    },
  );

  it("reads the origin at runtime for home and invite, independently of the request host", async () => {
    vi.stubEnv("PUBLIC_ORIGIN", "http://127.0.0.1:3070");
    expect((await homeMetadata()).openGraph).toMatchObject({
      url: "http://127.0.0.1:3070/",
      images: [{ url: "http://127.0.0.1:3070/og/home.png" }],
    });
    expect(
      (await roomMetadata({ params: Promise.resolve({ code: "BCDFG" }) })).openGraph,
    ).toMatchObject({
      url: "http://127.0.0.1:3070/r/BCDFG",
      images: [{ url: "http://127.0.0.1:3070/og/invite.png" }],
    });
  });

  it("uses a safe production fallback when Docker builds without PUBLIC_ORIGIN or APP_ENV", async () => {
    vi.stubEnv("PUBLIC_ORIGIN", "");
    vi.stubEnv("APP_ENV", undefined);
    vi.stubEnv("NODE_ENV", "production");
    expect(metadataOrigin().href).toBe("https://quiz.teamham.world/");
    const { metadata } = await import("./layout");
    expect(metadata.openGraph).toMatchObject({
      url: "https://quiz.teamham.world/",
      images: [{ url: "https://quiz.teamham.world/og/home.png" }],
    });
  });

  it("uses the dev port when PUBLIC_ORIGIN is absent", () => {
    vi.stubEnv("PUBLIC_ORIGIN", "");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("PORT", "3070");
    expect(metadataOrigin().href).toBe("http://127.0.0.1:3070/");
  });
});
