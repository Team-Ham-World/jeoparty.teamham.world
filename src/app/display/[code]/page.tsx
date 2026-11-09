import type { Metadata, Viewport } from "next";
import { DisplayRoute } from "@/features/display/display-route";

export const metadata: Metadata = { title: "Big screen" };
export const viewport: Viewport = { themeColor: "#1c1a17" };

export default async function DisplayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <DisplayRoute code={decodeURIComponent(code).toUpperCase()} />;
}
