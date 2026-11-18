/**
 * Keeps unsaved pack edits in this browser tab, so browser Back or Sign out
 * can't lose them. Storage can throw (private browsing, quota), and autosave
 * must never break the editor, so every call here swallows those errors.
 */
import type { QuestionPack } from "@/features/content";
import { finalClueOf } from "./pack-fields";

/** Per account, so a second person signing in on this tab never sees someone's draft. */
export function packDraftKey(accountId: string, packId: string | null): string {
  return `ham-quiz:pack-draft:${accountId}:${packId ?? "new"}`;
}

/** Enough shape for the editor to render. Drafts may be incomplete, so this isn't validation. */
function isEditablePack(value: unknown): value is QuestionPack {
  const pack = value as QuestionPack | null;
  return (
    typeof pack?.title === "string" &&
    Array.isArray(pack.scoring?.rounds) &&
    Array.isArray(pack.categories) &&
    pack.categories.every((category) => Array.isArray(category?.clues) && finalClueOf(category))
  );
}

interface StoredDraft {
  pack: QuestionPack;
  baseUpdatedAt: string | null;
}

export function readStoredDraft(key: string): StoredDraft | null {
  try {
    const text = sessionStorage.getItem(key);
    if (text === null) return null;
    const draft: unknown = JSON.parse(text);
    if (draft && typeof draft === "object" && "pack" in draft && isEditablePack(draft.pack)) {
      return {
        pack: draft.pack,
        baseUpdatedAt:
          "baseUpdatedAt" in draft && typeof draft.baseUpdatedAt === "string"
            ? draft.baseUpdatedAt
            : null,
      };
    }
    // Drafts saved before revision tracking contain only the pack.
    return isEditablePack(draft) ? { pack: draft, baseUpdatedAt: null } : null;
  } catch {
    return null;
  }
}

export function writeStoredDraft(
  key: string,
  pack: QuestionPack,
  baseUpdatedAt: string | null = null,
): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ pack, baseUpdatedAt }));
  } catch {
    // The beforeunload and link guards still protect this draft.
  }
}

export function clearStoredDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing was stored, or storage is unavailable.
  }
}
