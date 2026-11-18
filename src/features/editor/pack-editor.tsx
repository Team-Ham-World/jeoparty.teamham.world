"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  parseQuestionPackJson,
  validateQuestionPack,
  type Clue,
  type PictureId,
  type QuestionPack,
  type ValidationError,
} from "@/features/content";
import { ConfirmDialog, Dialog } from "@/features/ui/dialog";
import { formatScore, plural } from "@/features/ui/format";
import { useToast } from "@/features/ui/toasts";
import { clearStoredDraft, readStoredDraft, writeStoredDraft } from "./pack-autosave";
import {
  TIERS,
  blankCategory,
  blankClue,
  describePath,
  errorsByPath,
  exportFileName,
  fieldId,
  friendlyMessage,
  move,
  packForSave,
  removeAt,
  updateCategory,
  updateClue,
  updateFinal,
  withPicture,
} from "./pack-draft";
import { FINAL_CLUE_FIELD, finalClueOf, finalCluePath } from "./pack-fields";
import { PackScoring } from "./pack-scoring";
import { PictureField, firstImageFile, storePicture } from "./picture-field";

export interface PackEditorProps {
  initial: QuestionPack;
  isNew: boolean;
  /** Revision of the last loaded or saved pack, when editing a server pack. */
  savedUpdatedAt?: string | null;
  /** Saves via the API. Throw an ApiError-like `{ validationErrors }` to show field errors. */
  onSave: (pack: QuestionPack) => Promise<void>;
  onUploadPicture: (jpeg: Blob) => Promise<PictureId>;
  /** Navigate in-app (used after "Leave without saving?"). */
  onNavigate: (href: string) => void;
  /** Show these errors on first render (previews and tests). */
  initialErrors?: ValidationError[];
  /** Where to keep unsaved work in this browser tab. Leave out to skip autosaving. */
  draftKey?: string;
}

/**
 * Pack editor: details, scoring rounds, categories with clues and a final
 * clue each. Validates locally with the shared content validator before
 * saving, then shows any server errors on the same fields by their `path`.
 */
export function PackEditor({
  initial,
  isNew,
  savedUpdatedAt = null,
  onSave,
  onUploadPicture,
  onNavigate,
  initialErrors = [],
  draftKey,
}: PackEditorProps) {
  const toast = useToast();
  const [pack, setPack] = useState<QuestionPack>(initial);
  const [categoryId, setCategoryId] = useState<string>();
  const [clueId, setClueId] = useState<string>();
  const [saved, setSaved] = useState<string>(() => JSON.stringify(packForSave(initial)));
  const [errors, setErrors] = useState<ValidationError[]>(initialErrors);
  const [saving, setSaving] = useState(false);
  // A new pack exists on the server once this is true. Saving again would make a
  // second copy, so Save stays off until the redirect to the pack's own page lands.
  const [created, setCreated] = useState(false);
  const [removingCategory, setRemovingCategory] = useState<number | null>(null);
  const [saveConflict, setSaveConflict] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState<{ baseUpdatedAt: string | null } | null>(null);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    pack: QuestionPack;
    fileName: string;
  } | null>(null);
  // Unsaved work from an earlier visit, waiting for the author to restore or discard it.
  const [storedDraft, setStoredDraft] = useState(() => {
    const draft = draftKey ? readStoredDraft(draftKey) : null;
    const differs =
      draft && JSON.stringify(packForSave(draft.pack)) !== JSON.stringify(packForSave(initial));
    return differs ? draft : null;
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const pictureActionCount = useRef(0);
  const latestPictureAction = useRef(new Map<string, number>());
  const [uploading, setUploading] = useState<ReadonlySet<string>>(() => new Set());
  const dirty = JSON.stringify(packForSave(pack)) !== saved;
  const editsLocked = isNew && (saving || created);
  const baseUpdatedAt = draftConflict ? draftConflict.baseUpdatedAt : savedUpdatedAt;
  const conflictMessage = draftConflict
    ? draftConflict.baseUpdatedAt === null
      ? "The saved version for this draft is unknown."
      : "This pack changed elsewhere after you started this draft."
    : saveConflict;
  const canSave =
    !saving &&
    !created &&
    !draftConflict &&
    !storedDraft &&
    !importing &&
    !pendingImport &&
    uploading.size === 0 &&
    (dirty || isNew || errors.length > 0);
  const guard = useUnsavedGuard(dirty && !saving);
  const fieldErrors = useMemo(() => errorsByPath(errors), [errors]);
  const err = (path: string) => fieldErrors.get(path);

  // Browser Back and Sign out leave this page with no warning, so keep every change.
  // `saved` is a dependency so edits typed during a save are stored again afterwards.
  useEffect(() => {
    if (!draftKey || storedDraft) return; // Don't overwrite a draft still awaiting a decision.
    if (dirty) writeStoredDraft(draftKey, pack, baseUpdatedAt);
    else clearStoredDraft(draftKey);
  }, [draftKey, storedDraft, dirty, pack, saved, baseUpdatedAt]);

  async function save() {
    if (!canSave) return;
    const candidate = packForSave(pack);
    const local = validateQuestionPack(candidate);
    if (!local.ok) {
      setErrors(local.errors);
      toast(`Fix ${plural(local.errors.length, "problem")} before saving.`);
      return;
    }
    setSaving(true);
    setErrors([]);
    setSaveConflict(null);
    try {
      await onSave(candidate);
      // A new pack navigates away. Existing pack drafts are updated by the effect.
      if (isNew && draftKey) clearStoredDraft(draftKey);
      setSaved(JSON.stringify(candidate));
      if (isNew) setCreated(true);
      toast("Pack saved.", "info");
    } catch (error) {
      const validation = (error as { validationErrors?: ValidationError[] }).validationErrors;
      if (validation && validation.length > 0) {
        setErrors(validation);
        toast(`The server found ${plural(validation.length, "problem")}.`);
      } else if ((error as { code?: string }).code === "conflict") {
        setSaveConflict(error instanceof Error ? error.message : "This pack changed elsewhere.");
      } else {
        toast(error instanceof Error ? error.message : "Couldn't save. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  function startPictureAction(clueId: string): () => boolean {
    const action = ++pictureActionCount.current;
    latestPictureAction.current.set(clueId, action);
    return () => latestPictureAction.current.get(clueId) === action;
  }

  function markUploading(clueId: string, on: boolean) {
    setUploading((current) => {
      const next = new Set(current);
      if (on) next.add(clueId);
      else next.delete(clueId);
      return next;
    });
  }

  async function attachPicture(clueId: string, file: File) {
    if (editsLocked) return;
    const isLatest = startPictureAction(clueId);
    markUploading(clueId, true);
    try {
      const id = await storePicture(file, onUploadPicture);
      if (isLatest())
        setPack((current) => withPicture(current, clueId, (old) => ({ id, alt: old?.alt ?? "" })));
    } catch (error) {
      if (isLatest())
        toast(error instanceof Error ? error.message : "Couldn't add the picture. Try again.");
    } finally {
      if (isLatest()) markUploading(clueId, false);
    }
  }

  function removePicture(clueId: string) {
    startPictureAction(clueId);
    markUploading(clueId, false);
    setPack((current) => withPicture(current, clueId, () => undefined));
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || editsLocked || importing) return;
    setImporting(true);
    let result;
    try {
      result = parseQuestionPackJson(await file.text());
    } catch {
      toast(`Couldn't read ${file.name}. Try again.`);
      return;
    } finally {
      setImporting(false);
    }
    if (!result.ok) {
      setErrors([]);
      const first = result.errors[0];
      // Paths point into the file, not this draft, so describe them without this pack's titles.
      const where = first
        ? describePath(first.path, { ...pack, categories: [] }, FINAL_CLUE_FIELD)
        : null;
      const what = first
        ? `${where}: ${friendlyMessage(first.message)}`
        : "it isn't a HAM Quiz pack";
      const more =
        result.errors.length > 1
          ? ` (and ${plural(result.errors.length - 1, "more problem")})`
          : "";
      toast(`Couldn't import ${file.name}. ${what}${more} Nothing was changed.`);
      return;
    }
    if (dirty) {
      setPendingImport({ pack: result.data, fileName: file.name });
      return;
    }
    applyImport(result.data, file.name);
  }

  function applyImport(imported: QuestionPack, fileName: string) {
    // Uploads still running belong to the draft being replaced, even where a clue id matches.
    latestPictureAction.current.clear();
    setUploading(new Set());
    // Keep this pack's id so saving updates it instead of creating a twin.
    setPack({ ...imported, id: pack.id });
    setCategoryId(undefined);
    setClueId(undefined);
    setErrors([]);
    toast(`Imported ${fileName}. Review it, then save.`, "info");
  }

  function exportFile() {
    const blob = new Blob([JSON.stringify(packForSave(pack), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName(pack.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const cluesPerCategory = pack.categories[0]?.clues.length ?? 0;
  const uneven = pack.categories.some((c) => c.clues.length !== cluesPerCategory);
  const defaultRound =
    pack.scoring.rounds.find((r) => r.id === pack.scoring.defaultRoundId) ?? pack.scoring.rounds[0];
  const category = pack.categories.find((item) => item.id === categoryId) ?? pack.categories[0];
  const c = pack.categories.indexOf(category);
  const categoryName = category?.title.trim() || `Category ${c + 1}`;
  const clues = category ? [...category.clues, finalClueOf(category)] : [];
  const clue = clues.find((item) => item.id === clueId) ?? clues[0];
  const isFinal = clue?.tier === "final";
  const k = clues.indexOf(clue);
  const clueName = isFinal ? "Final clue" : `Clue ${k + 1}`;
  const categoryPath = `categories[${c}]`;
  const cluePath = isFinal ? finalCluePath(c) : `${categoryPath}.clues[${k}]`;
  const points = clue && clue.tier !== "final" ? defaultRound?.pointsByTier[clue.tier] : undefined;

  function pastePicture(event: ClipboardEvent<HTMLElement>) {
    const file = firstImageFile(event.clipboardData.files);
    if (!file || !clue) return;
    event.preventDefault();
    void attachPicture(clue.id, file);
  }

  function dropPicture(event: DragEvent<HTMLElement>) {
    const file = firstImageFile(event.dataTransfer.files);
    if (!file || !clue) return;
    event.preventDefault();
    void attachPicture(clue.id, file);
  }

  function addCategory() {
    const next = blankCategory(cluesPerCategory || 5);
    setPack({ ...pack, categories: [...pack.categories, next] });
    setCategoryId(next.id);
    setClueId(undefined);
    setErrors([]);
  }

  function changeClues(next: Clue[]) {
    setPack(updateCategory(pack, c, (cat) => ({ ...cat, clues: next })));
    setErrors([]);
  }

  function removeCategory(index: number) {
    const removed = pack.categories[index];
    const categories = removeAt(pack.categories, index);
    for (const { id } of [...removed.clues, finalClueOf(removed)]) {
      latestPictureAction.current.delete(id);
      markUploading(id, false);
    }
    setPack({ ...pack, categories });
    setCategoryId((categories[index] ?? categories[index - 1]).id);
    setClueId(undefined);
    setErrors([]);
  }

  function focusError(path: string) {
    const match = /^categories\[(\d+)\](.*)$/.exec(path);
    if (match) {
      const index = Number(match[1]);
      const target = pack.categories[index];
      if (target) {
        const clueMatch = /^\.clues\[(\d+)\]/.exec(match[2]);
        const targetClue = clueMatch
          ? target.clues[Number(clueMatch[1])]
          : path.startsWith(finalCluePath(index))
            ? finalClueOf(target)
            : undefined;
        // The field only exists once its category and clue are selected.
        flushSync(() => {
          setCategoryId(target.id);
          setClueId(targetClue?.id);
        });
      }
    }
    const scoring = document.getElementById("ed-scoring");
    if (path.startsWith("scoring") && scoring instanceof HTMLDetailsElement) scoring.open = true;
    const fallback = path.startsWith("scoring")
      ? "ed-scoring-heading"
      : match
        ? "ed-clue-heading"
        : "ed-contents";
    const field = document.getElementById(fieldId(path)) ?? document.getElementById(fallback);
    field?.focus();
    field?.scrollIntoView?.({ block: "center" });
  }

  return (
    <div className="ed">
      <div className="ed-bar">
        <Link className="btn btn--quiet btn--small" href="/packs">
          ← My packs
        </Link>
        <div className="ed-bar__status" role="status">
          {saving ? (
            <span className="stamp stamp--dashed stamp--flat">Saving…</span>
          ) : uploading.size > 0 ? (
            <span className="stamp stamp--dashed stamp--flat">Uploading picture…</span>
          ) : dirty ? (
            <span className="stamp stamp--warn stamp--flat">Unsaved changes</span>
          ) : errors.length > 0 ? (
            <span className="stamp stamp--bad stamp--flat">Needs fixes</span>
          ) : isNew && !created ? (
            <span className="stamp stamp--dashed stamp--flat">Not saved yet</span>
          ) : (
            <span className="stamp stamp--good stamp--flat">Saved</span>
          )}
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={save}
          disabled={!canSave}
          aria-busy={saving || undefined}
        >
          {isNew ? "Save pack" : "Save changes"}
        </button>
      </div>

      <div className="ed-head">
        <div>
          <p className="ed-eyebrow">Pack library / {isNew ? "New" : "Your pack"}</p>
          <h1 className="ed-title">
            {pack.title.trim() || (isNew ? "New pack" : "Untitled pack")}
          </h1>
        </div>
        <div className="row ed-file">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            onChange={importFile}
            aria-hidden="true"
            disabled={editsLocked || importing}
          />
          <button
            type="button"
            className="btn btn--small"
            onClick={() => fileInput.current?.click()}
            disabled={editsLocked || importing}
          >
            Import JSON
          </button>
          <button type="button" className="btn btn--small" onClick={exportFile}>
            Export JSON
          </button>
        </div>
      </div>

      {conflictMessage ? (
        <div className="banner banner--warn" role="alert">
          <p>
            <strong>{conflictMessage}</strong> Your edits are still on this page. Export them so you
            don&apos;t lose them.
          </p>
          <button type="button" className="btn btn--small" onClick={exportFile}>
            Export JSON
          </button>
          {draftConflict ? (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => setDiscardingDraft(true)}
            >
              Discard draft
            </button>
          ) : null}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <section
          className="banner banner--bad ed-errors"
          aria-labelledby="ed-errors-title"
          tabIndex={-1}
        >
          <h2 id="ed-errors-title">{plural(errors.length, "problem")} to fix</h2>
          <ul>
            {errors.map((e, i) => (
              <li key={`${e.path}-${i}`}>
                <a
                  href={`#${fieldId(e.path)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    focusError(e.path);
                  }}
                >
                  {describePath(e.path, pack, FINAL_CLUE_FIELD)}
                </a>
                : {friendlyMessage(e.message)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <fieldset className="ed-workspace min-w-0" disabled={editsLocked}>
        <aside className="ed-card" aria-labelledby="ed-contents">
          <h2 id="ed-contents" tabIndex={-1}>
            Pack contents
          </h2>
          <TextField
            label="Title"
            path="title"
            value={pack.title}
            error={err("title")}
            onChange={(title) => setPack({ ...pack, title })}
          />
          <TextField
            label="Description (optional)"
            path="description"
            value={pack.description ?? ""}
            error={err("description")}
            onChange={(description) => setPack({ ...pack, description })}
            placeholder="What's this pack about?"
          />
          {category ? (
            <>
              <div className="field">
                <label className="field__label" htmlFor="ed-category-select">
                  Category
                </label>
                <select
                  className="input"
                  id="ed-category-select"
                  value={category.id}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    setClueId(undefined);
                  }}
                >
                  {pack.categories.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      {item.title.trim() || `Category ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="ed-clue-select">
                  Clue
                </label>
                <select
                  className="input"
                  id="ed-clue-select"
                  value={clue?.id ?? ""}
                  onChange={(event) => setClueId(event.target.value)}
                >
                  {clues.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      {item.tier === "final" ? "Final clue" : `Clue ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          <div className="row ed-contents-actions">
            <button
              type="button"
              className="btn btn--small btn--quiet"
              onClick={addCategory}
              disabled={pack.categories.length >= 12}
            >
              + Add category
            </button>
            {category ? (
              <button
                type="button"
                className="btn btn--small btn--quiet"
                disabled={category.clues.length >= TIERS.length}
                onClick={() => {
                  const next = blankClue(TIERS[category.clues.length]);
                  changeClues([...category.clues, next]);
                  setClueId(next.id);
                }}
              >
                + Add clue
              </button>
            ) : null}
          </div>
          <p className="field__hint">
            {plural(pack.categories.length, "category", "categories")} ×{" "}
            {plural(cluesPerCategory, "clue")}
          </p>
          {uneven ? (
            <p className="field__error">Give every category the same number of clues.</p>
          ) : null}
        </aside>

        {category && clue ? (
          <section
            className="ed-card ed-clue"
            aria-label="Clue editor"
            onPaste={pastePicture}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) event.preventDefault();
            }}
            onDrop={dropPicture}
          >
            <h2 id="ed-clue-heading" tabIndex={-1}>
              {clueName}
            </h2>
            <div className="ed-category-fields">
              <TextField
                label="Category title"
                path={`${categoryPath}.title`}
                value={category.title}
                error={err(`${categoryPath}.title`)}
                onChange={(title) => setPack(updateCategory(pack, c, (cat) => ({ ...cat, title })))}
              />
              <div className="row ed-tools" role="group" aria-label="Category tools">
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={c === 0}
                  aria-label={`Move ${categoryName} up`}
                  onClick={() => {
                    setCategoryId(category.id);
                    setPack({ ...pack, categories: move(pack.categories, c, c - 1) });
                    setErrors([]);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={c === pack.categories.length - 1}
                  aria-label={`Move ${categoryName} down`}
                  onClick={() => {
                    setCategoryId(category.id);
                    setPack({ ...pack, categories: move(pack.categories, c, c + 1) });
                    setErrors([]);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={pack.categories.length <= 1}
                  aria-label={`Remove ${categoryName}`}
                  onClick={() => setRemovingCategory(c)}
                >
                  Remove
                </button>
              </div>
            </div>
            {err(`${categoryPath}.clues`) ? (
              <p id={fieldId(`${categoryPath}.clues`)} className="field__error" tabIndex={-1}>
                {err(`${categoryPath}.clues`)}
              </p>
            ) : null}
            <div className="ed-clue-fields">
              <TextField
                multiline
                label={clueName}
                path={`${cluePath}.prompt`}
                value={clue.prompt}
                error={err(`${cluePath}.prompt`)}
                onChange={(prompt) =>
                  setPack(
                    isFinal ? updateFinal(pack, c, { prompt }) : updateClue(pack, c, k, { prompt }),
                  )
                }
              />
              <TextField
                multiline
                label={isFinal ? "Final answer" : "Answer"}
                path={`${cluePath}.answer`}
                value={clue.answer}
                error={err(`${cluePath}.answer`)}
                onChange={(answer) =>
                  setPack(
                    isFinal ? updateFinal(pack, c, { answer }) : updateClue(pack, c, k, { answer }),
                  )
                }
              />
              {!isFinal ? (
                <div className="ed-tier-row">
                  <div className="field">
                    <label className="field__label" htmlFor={fieldId(`${cluePath}.tier`)}>
                      Point tier
                    </label>
                    <select
                      id={fieldId(`${cluePath}.tier`)}
                      className="input"
                      value={clue.tier}
                      aria-invalid={err(`${cluePath}.tier`) ? true : undefined}
                      onChange={(event) => {
                        const tier = TIERS.find((tier) => tier === Number(event.target.value));
                        if (tier) setPack(updateClue(pack, c, k, { tier }));
                      }}
                    >
                      {TIERS.map((tier) => (
                        <option key={tier} value={tier}>
                          {tier}
                        </option>
                      ))}
                    </select>
                  </div>
                  {points ? (
                    <span className="ed-tier-points">{formatScore(points)} pts</span>
                  ) : null}
                  <div className="row ed-tools" role="group" aria-label={`${clueName} tools`}>
                    <button
                      type="button"
                      className="btn btn--small"
                      disabled={k === 0}
                      aria-label={`Move clue ${k + 1} up`}
                      onClick={() => {
                        setClueId(clue.id);
                        changeClues(move(category.clues, k, k - 1));
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn--small"
                      disabled={k === category.clues.length - 1}
                      aria-label={`Move clue ${k + 1} down`}
                      onClick={() => {
                        setClueId(clue.id);
                        changeClues(move(category.clues, k, k + 1));
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn--small"
                      disabled={category.clues.length <= 1}
                      aria-label={`Remove clue ${k + 1}`}
                      onClick={() => {
                        latestPictureAction.current.delete(clue.id);
                        markUploading(clue.id, false);
                        const next = removeAt(category.clues, k);
                        changeClues(next);
                        setClueId((next[k] ?? next[k - 1]).id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : null}
              <PictureField
                cluePath={cluePath}
                clueName={isFinal ? "the final clue" : `clue ${k + 1}`}
                picture={clue.picture}
                uploading={uploading.has(clue.id)}
                error={err(`${cluePath}.picture`)}
                onFile={(file) => void attachPicture(clue.id, file)}
                onRemove={() => removePicture(clue.id)}
                description={
                  clue.picture ? (
                    <TextField
                      label="Picture description"
                      path={`${cluePath}.picture.alt`}
                      value={clue.picture.alt}
                      error={err(`${cluePath}.picture.alt`)}
                      onChange={(alt) =>
                        setPack(withPicture(pack, clue.id, (old) => old && { ...old, alt }))
                      }
                      placeholder="What's in it, without giving away the answer"
                    />
                  ) : null
                }
              />
            </div>
          </section>
        ) : null}
      </fieldset>

      <fieldset className="min-w-0" disabled={editsLocked}>
        <PackScoring
          scoring={pack.scoring}
          fieldErrors={fieldErrors}
          onChange={(scoring) => setPack({ ...pack, scoring })}
        />
      </fieldset>

      <div className="ed-foot">
        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={save}
          disabled={!canSave}
          aria-busy={saving || undefined}
        >
          {isNew ? "Save pack" : "Save changes"}
        </button>
      </div>

      <ConfirmDialog
        open={discardingDraft}
        title="Discard your unsaved draft?"
        description="This will remove your edits and reopen the saved pack."
        confirmLabel="Discard draft"
        cancelLabel="Keep editing"
        onCancel={() => setDiscardingDraft(false)}
        onConfirm={() => {
          latestPictureAction.current.clear();
          setUploading(new Set());
          setPack(initial);
          setCategoryId(undefined);
          setClueId(undefined);
          setErrors([]);
          setDraftConflict(null);
          setDiscardingDraft(false);
        }}
      />
      <ConfirmDialog
        open={removingCategory !== null}
        title={`Remove ${removingCategory !== null ? pack.categories[removingCategory]?.title.trim() || `category ${removingCategory + 1}` : "category"}?`}
        description="Its clues and final clue go too. You can still leave without saving to undo."
        confirmLabel="Remove category"
        cancelLabel="Keep it"
        onCancel={() => setRemovingCategory(null)}
        onConfirm={() => {
          if (removingCategory !== null) removeCategory(removingCategory);
          setRemovingCategory(null);
        }}
      />
      <ConfirmDialog
        open={guard.pendingHref !== null}
        title="Leave without saving?"
        description="Your changes to this pack will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay and save"
        onCancel={guard.cancel}
        onConfirm={() => {
          const href = guard.pendingHref;
          guard.cancel();
          if (draftKey) clearStoredDraft(draftKey);
          if (href) onNavigate(href);
        }}
      />
      <ConfirmDialog
        open={pendingImport !== null}
        title="Replace your unsaved changes?"
        description={`Importing ${pendingImport?.fileName ?? "this file"} replaces everything in this editor.`}
        confirmLabel="Import and replace"
        cancelLabel="Keep editing"
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          if (pendingImport) applyImport(pendingImport.pack, pendingImport.fileName);
          setPendingImport(null);
        }}
      />
      {/* No way to dismiss it: Escape or a stray click shouldn't decide the fate of someone's work. */}
      <Dialog
        open={storedDraft !== null}
        onClose={() => {}}
        title="Restore your unsaved edits?"
        description="You left this pack with changes that weren't saved."
        footer={
          <>
            {/* First on purpose: opening a dialog focuses its first button, so Enter keeps the work. */}
            <button
              type="button"
              className="btn btn--primary"
              autoFocus
              onClick={() => {
                if (!storedDraft) return;
                setPack(storedDraft.pack);
                if (savedUpdatedAt !== null && storedDraft.baseUpdatedAt !== savedUpdatedAt) {
                  setDraftConflict({ baseUpdatedAt: storedDraft.baseUpdatedAt });
                }
                setStoredDraft(null);
              }}
            >
              Restore
            </button>
            <button
              type="button"
              className="btn btn--bad"
              onClick={() => {
                if (draftKey) clearStoredDraft(draftKey);
                setStoredDraft(null);
              }}
            >
              Discard
            </button>
          </>
        }
      />
    </div>
  );
}

function TextField({
  label,
  path,
  value,
  error,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  path: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const id = fieldId(path);
  const errorId = `${id}-error`;
  const common = {
    id,
    className: "input",
    value,
    placeholder,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  };
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea {...common} rows={2} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} onChange={(e) => onChange(e.target.value)} />
      )}
      {error ? (
        <span id={errorId} className="field__error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Warn before leaving with unsaved changes: tab close/reload and in-app links. */
function useUnsavedGuard(active: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  return { pendingHref, cancel: () => setPendingHref(null) };
}
