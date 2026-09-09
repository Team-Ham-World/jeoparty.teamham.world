import type { Metadata } from "next";
import "./globals.css";

/*
  Shared app shell. It sets the page language, title,
  and the skip-to-content link. It does NOT render a
  <main> — each page component owns its own <main>.
*/

export const metadata: Metadata = {
  title: "JeoParty — Team Ham Learning Workbench",
  description:
    "Scaffold-only starting point for six beginners building a Jeopardy-style game. No live game connected.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="ham-skip">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
