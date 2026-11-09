import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewFrame } from "@/features/preview/preview-pages";

export const metadata: Metadata = { title: "Preview", robots: { index: false } };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { id } = await params;
  return <PreviewFrame id={id} />;
}
