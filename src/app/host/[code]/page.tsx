import type { Metadata } from "next";
import { HostRoute } from "@/features/host/host-route";

export const metadata: Metadata = { title: "Host" };

export default async function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <HostRoute code={decodeURIComponent(code).toUpperCase()} />;
}
