import type { Metadata } from "next";
import { PacksRoute } from "@/features/editor/packs-route";

export const metadata: Metadata = { title: "Question packs" };

export default function PacksPage() {
  return <PacksRoute />;
}
