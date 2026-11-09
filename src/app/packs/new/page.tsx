import type { Metadata } from "next";
import { PackEditorRoute } from "@/features/editor/packs-route";

export const metadata: Metadata = { title: "New pack" };

export default function NewPackPage() {
  return <PackEditorRoute id={null} />;
}
