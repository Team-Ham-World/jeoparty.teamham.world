"use client";

import { useState } from "react";
import type { PictureView } from "@/features/engine/contract";

/**
 * `className` must size the frame; the picture never does, so nothing moves
 * when it loads. The alt text is never drawn: on the TV it could give the
 * answer away.
 */
export function CluePicture({ picture, className }: { picture: PictureView; className: string }) {
  return <PictureFrame key={picture.src} picture={picture} className={className} />;
}

function PictureFrame({ picture, className }: { picture: PictureView; className: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={`clue-picture ${failed ? "clue-picture--failed" : ""} ${className}`}>
      {failed ? (
        <span className="clue-picture__failed">Picture didn&apos;t load</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- Next's optimizer fetches through its own router and can't reach /api/pictures on the custom server.
        <img
          src={picture.src}
          alt={picture.alt || "Picture for this clue"}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}
