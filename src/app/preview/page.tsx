import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewIndex } from "@/features/preview/preview-pages";

export const metadata: Metadata = { title: "Screen gallery", robots: { index: false } };

/** Dev-only gallery of every screen state. Production builds return 404. */
export default function PreviewIndexPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewIndex />;
}
