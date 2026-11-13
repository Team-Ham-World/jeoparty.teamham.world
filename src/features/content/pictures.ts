import type { Clue, CluePicture, FinalClue, PictureId, QuestionPack } from "./types";

export const PICTURE_ROUTE = "/api/pictures";
export const MAX_PICTURE_BYTES = 1024 * 1024;
export const MAX_PICTURE_ALT = 200;

export function parsePictureId(value: unknown): PictureId | null {
  return typeof value === "string" && /^pic_[A-Za-z0-9_-]{43}$/.test(value)
    ? (value as PictureId)
    : null;
}

export function pictureSrc(id: PictureId): string {
  return `${PICTURE_ROUTE}/${id}`;
}

export function pictureOf(clue: Clue | FinalClue): CluePicture | null {
  return clue.picture ? { id: clue.picture.id, alt: clue.picture.alt } : null;
}

export function pictureRefs(pack: QuestionPack): { path: string; id: PictureId }[] {
  const refs: { path: string; id: PictureId }[] = [];
  pack.categories.forEach((category, i) => {
    category.clues.forEach((clue, k) => {
      if (clue.picture)
        refs.push({ path: `categories[${i}].clues[${k}].picture`, id: clue.picture.id });
    });
    if (category.finalClue.picture)
      refs.push({ path: `categories[${i}].finalClue.picture`, id: category.finalClue.picture.id });
  });
  return refs;
}
