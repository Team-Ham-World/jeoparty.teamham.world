import type { Metadata } from "next";
import { PackEditorRoute } from "@/features/editor/packs-route";

export const metadata: Metadata = { title: "Edit pack" };

export default async function EditPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PackEditorRoute id={decodeURIComponent(id)} />;
}
