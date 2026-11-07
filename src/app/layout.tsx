import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";
import "@/features/board/board.css";
import "@/features/player/player.css";
import "@/features/host/host.css";
import "@/features/display/display.css";
import "@/features/lobby/home.css";
import "@/features/editor/editor.css";

/*
  App shell: fonts (self-hosted, no runtime font requests), the design
  system, page title and the skip link. Each page owns its own <main>.
*/

export const metadata: Metadata = {
  title: { default: "HAM Quiz", template: "%s · HAM Quiz" },
  description:
    "A quiz-show party game for HAM: the host runs it, the TV shows the board, and everyone buzzes in from their phone.",
};

export const viewport: Viewport = {
  themeColor: "#f6f1e5",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
