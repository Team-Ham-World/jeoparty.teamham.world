"use client";

import { useRef, type ReactNode } from "react";
import {
  MAX_PICTURE_BYTES,
  pictureSrc,
  type CluePicture as PackPicture,
  type PictureId,
} from "@/features/content";
import { CluePicture } from "@/features/ui/clue-picture";
import { fieldId } from "./pack-draft";

const JPEG_ATTEMPTS = [
  [1600, 0.82],
  [1200, 0.7],
] as const;

export async function storePicture(
  file: File,
  upload: (jpeg: Blob) => Promise<PictureId>,
): Promise<PictureId> {
  return upload(await toJpeg(file));
}

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name} isn't a picture this browser can open.`);
  });
  try {
    for (const [edge, quality] of JPEG_ATTEMPTS) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error(`Couldn't prepare ${file.name} for upload.`);
      // JPEG has no transparency: see-through parts would otherwise turn black.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (!jpeg) throw new Error(`Couldn't prepare ${file.name} for upload.`);
      if (jpeg.size <= MAX_PICTURE_BYTES) return jpeg;
    }
  } finally {
    bitmap.close();
  }
  throw new Error(`${file.name} is too detailed to upload. Try a smaller picture.`);
}

export function firstImageFile(files: FileList | readonly File[] | undefined): File | null {
  return [...(files ?? [])].find((file) => file.type.startsWith("image/")) ?? null;
}

export function PictureField({
  cluePath,
  clueName,
  picture,
  uploading,
  error,
  onFile,
  onRemove,
  description,
}: {
  cluePath: string;
  clueName: string;
  picture: PackPicture | undefined;
  uploading: boolean;
  error?: string;
  onFile: (file: File) => void;
  onRemove: () => void;
  description: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = fieldId(`${cluePath}.picture`);
  return (
    <div className={`ed-picture ${picture ? "ed-picture--set" : ""}`}>
      {picture ? (
        <CluePicture
          picture={{ src: pictureSrc(picture.id), alt: picture.alt }}
          className="ed-picture__preview"
        />
      ) : null}
      {description}
      <div className="ed-picture__actions">
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
        <button
          id={id}
          type="button"
          className="btn btn--small"
          aria-busy={uploading || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onClick={() => input.current?.click()}
        >
          {uploading ? "Uploading…" : picture ? "Replace picture" : "Add picture"}{" "}
          <span className="sr-only">for {clueName}</span>
        </button>
        {picture ? (
          <button type="button" className="btn btn--small btn--quiet" onClick={onRemove}>
            Remove picture <span className="sr-only">from {clueName}</span>
          </button>
        ) : null}
        <span className="field__hint">Or paste or drop a picture on this clue.</span>
      </div>
      {error ? (
        <span id={`${id}-error`} className="field__error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
