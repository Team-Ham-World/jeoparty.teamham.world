"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  parseQuestionPackJson,
  validateQuestionPack,
  type DifficultyTier,
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
  blankRound,
  describePath,
  errorsByPath,
  exportFileName,
  fieldId,
  friendlyMessage,
  move,
  packForSave,
  removeAt,
  replaceAt,
  updateCategory,
  updateClue,
  updateFinal,
} from "./pack-draft";
import { FINAL_CLUE_FIELD, finalClueOf, finalCluePath } from "./pack-fields";

export interface PackEditorProps {
  initial: QuestionPack;
  isNew: boolean;
  /** Saves via the API. Throw an ApiError-like `{ validationErrors }` to show field errors. */
  onSave: (pack: QuestionPack) => Promise<void>;
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
  onSave,
  onNavigate,
  initialErrors = [],
  draftKey,
}: PackEditorProps) {
  const toast = useToast();
  const [pack, setPack] = useState<QuestionPack>(initial);
  const [saved, setSaved] = useState<string>(() => JSON.stringify(packForSave(initial)));
  const [errors, setErrors] = useState<ValidationError[]>(initialErrors);
  const [saving, setSaving] = useState(false);
  // A new pack exists on the server once this is true. Saving again would make a
  // second copy, so Save stays off until the redirect to the pack's own page lands.
  const [created, setCreated] = useState(false);
  const [removingCategory, setRemovingCategory] = useState<number | null>(null);
  const [saveConflict, setSaveConflict] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    pack: QuestionPack;
    fileName: string;
  } | null>(null);
  // Unsaved work from an earlier visit, waiting for the author to restore or discard it.
  const [storedDraft, setStoredDraft] = useState<QuestionPack | null>(() => {
    const draft = draftKey ? readStoredDraft(draftKey) : null;
    const differs =
      draft && JSON.stringify(packForSave(draft)) !== JSON.stringify(packForSave(initial));
    return differs ? draft : null;
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(packForSave(pack)) !== saved;
  const canSave = !saving && !created && (dirty || isNew || errors.length > 0);
  const guard = useUnsavedGuard(dirty && !saving);
  const fieldErrors = useMemo(() => errorsByPath(errors), [errors]);
  const err = (path: string) => fieldErrors.get(path);

  // Browser Back and Sign out leave this page with no warning, so keep every change.
  // `saved` is a dependency so edits typed during a save are stored again afterwards.
  useEffect(() => {
    if (!draftKey || storedDraft) return; // Don't overwrite a draft still awaiting a decision.
    if (dirty) writeStoredDraft(draftKey, pack);
    else clearStoredDraft(draftKey);
  }, [draftKey, storedDraft, dirty, pack, saved]);

  async function save() {
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
      // Now, not in the effect: saving a new pack navigates away from this editor.
      if (draftKey) clearStoredDraft(draftKey);
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

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = parseQuestionPackJson(await file.text());
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
    // Keep this pack's id so saving updates it instead of creating a twin.
    setPack({ ...imported, id: pack.id });
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

  return (
    <div className="ed">
      {/* Sticky: only what you need while scrolling a long pack. */}
      <div className="ed-bar">
        <Link className="btn btn--quiet btn--small" href="/packs">
          ← My packs
        </Link>
        <div className="ed-bar__status" role="status">
          {saving ? (
            <span className="stamp stamp--dashed stamp--flat">Saving…</span>
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
        <h1 className="ed-title marker">
          {isNew ? "New pack" : pack.title.trim() || "Untitled pack"}
        </h1>
        <div className="row ed-file">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            onChange={importFile}
            aria-hidden="true"
          />
          <button
            type="button"
            className="btn btn--small"
            onClick={() => fileInput.current?.click()}
          >
            Import JSON
          </button>
          <button type="button" className="btn btn--small" onClick={exportFile}>
            Export JSON
          </button>
        </div>
      </div>

      {saveConflict ? (
        <div className="banner banner--warn" role="alert">
          <p>
            <strong>{saveConflict}</strong> Your edits are still on this page. Export them so you
            don&apos;t lose them.
          </p>
          <button type="button" className="btn btn--small" onClick={exportFile}>
            Export JSON
          </button>
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
            {errors.slice(0, 12).map((e, i) => (
              <li key={`${e.path}-${i}`}>
                <a
                  href={`#${fieldId(e.path)}`}
                  onClick={(event) => {
                    const target = document.getElementById(fieldId(e.path));
                    if (target) {
                      event.preventDefault();
                      target.focus();
                      target.scrollIntoView({ block: "center" });
                    }
                  }}
                >
                  {describePath(e.path, pack, FINAL_CLUE_FIELD)}
                </a>
                : {friendlyMessage(e.message)}
              </li>
            ))}
            {errors.length > 12 ? <li>…and {errors.length - 12} more.</li> : null}
          </ul>
        </section>
      ) : null}

      <section className="panel ed-section" aria-labelledby="ed-details">
        <h2 id="ed-details" className="panel__title">
          Details
        </h2>
        <div className="ed-grid">
          <TextField
            label="Title"
            path="title"
            value={pack.title}
            error={err("title")}
            onChange={(title) => setPack({ ...pack, title })}
            placeholder="Friday Night Brain Melt"
          />
          <TextField
            label="Description (optional)"
            path="description"
            value={pack.description ?? ""}
            error={err("description")}
            onChange={(description) => setPack({ ...pack, description })}
            placeholder="What's this pack about?"
          />
        </div>
      </section>

      <section className="panel ed-section" aria-labelledby="ed-scoring">
        <div className="panel__title">
          <h2 id="ed-scoring">Scoring</h2>
          <button
            type="button"
            className="btn btn--small"
            onClick={() =>
              setPack({
                ...pack,
                scoring: {
                  ...pack.scoring,
                  rounds: [
                    ...pack.scoring.rounds,
                    blankRound(`Round ${pack.scoring.rounds.length + 1}`, 2),
                  ],
                },
              })
            }
          >
            Add scoring round
          </button>
        </div>
        <p className="muted ed-help">
          Points per difficulty tier. The default round scores round 1; round 2 uses the next one
          (or doubles the default).
        </p>
        <div className="ed-table-wrap">
          <table className="ed-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Default</th>
                {TIERS.map((t) => (
                  <th key={t} scope="col">
                    Tier {t}
                  </th>
                ))}
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pack.scoring.rounds.map((round, r) => (
                <tr key={round.id}>
                  <td>
                    <input
                      id={fieldId(`scoring.rounds[${r}].title`)}
                      className="input"
                      aria-label={`Scoring round ${r + 1} name`}
                      value={round.title}
                      aria-invalid={err(`scoring.rounds[${r}].title`) ? true : undefined}
                      onChange={(e) =>
                        setPack({
                          ...pack,
                          scoring: {
                            ...pack.scoring,
                            rounds: replaceAt(pack.scoring.rounds, r, {
                              ...round,
                              title: e.target.value,
                            }),
                          },
                        })
                      }
                    />
                  </td>
                  <td className="ed-center">
                    <input
                      type="radio"
                      name="default-round"
                      aria-label={`Use ${round.title || `round ${r + 1}`} as the default`}
                      checked={pack.scoring.defaultRoundId === round.id}
                      onChange={() =>
                        setPack({ ...pack, scoring: { ...pack.scoring, defaultRoundId: round.id } })
                      }
                    />
                  </td>
                  {TIERS.map((t) => {
                    const path = `scoring.rounds[${r}].pointsByTier.${t}`;
                    return (
                      <td key={t}>
                        <input
                          id={fieldId(path)}
                          className="input num ed-points"
                          inputMode="numeric"
                          aria-label={`${round.title || `Round ${r + 1}`}, tier ${t} points`}
                          aria-invalid={err(path) ? true : undefined}
                          value={String(round.pointsByTier[t] ?? "")}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/[^0-9]/g, ""));
                            setPack({
                              ...pack,
                              scoring: {
                                ...pack.scoring,
                                rounds: replaceAt(pack.scoring.rounds, r, {
                                  ...round,
                                  pointsByTier: { ...round.pointsByTier, [t]: n },
                                }),
                              },
                            });
                          }}
                        />
                      </td>
                    );
                  })}
                  <td>
                    <button
                      type="button"
                      className="btn btn--small btn--quiet"
                      disabled={pack.scoring.rounds.length <= 1}
                      aria-label={`Remove scoring round ${round.title || r + 1}`}
                      onClick={() => {
                        const rounds = removeAt(pack.scoring.rounds, r);
                        const defaultRoundId =
                          pack.scoring.defaultRoundId === round.id
                            ? rounds[0].id
                            : pack.scoring.defaultRoundId;
                        setPack({ ...pack, scoring: { ...pack.scoring, rounds, defaultRoundId } });
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ed-cats" aria-labelledby="ed-categories">
        <div className="panel__title">
          <h2 id="ed-categories">Categories ({pack.categories.length})</h2>
          <span className="muted">
            {pack.categories.length} × {cluesPerCategory} board
          </span>
        </div>
        <p className="muted ed-help">
          A game uses up to 6 categories per round. Give every category the same number of clues
          {uneven ? <strong className="ed-warn"> (they differ right now)</strong> : null}. Each
          category also needs a final-round clue.
        </p>

        {pack.categories.map((category, c) => {
          const name = category.title.trim() || `Category ${c + 1}`;
          const final = finalClueOf(category);
          return (
            <article
              key={category.id}
              className="panel ed-cat"
              aria-labelledby={`cat-${category.id}`}
            >
              <header className="ed-cat__head">
                <h3 id={`cat-${category.id}`} className="ed-cat__num">
                  <span className="sr-only">{name}, </span>Category {c + 1}
                </h3>
                <div className="ed-cat__title">
                  <TextField
                    label="Category title"
                    path={`categories[${c}].title`}
                    value={category.title}
                    error={err(`categories[${c}].title`)}
                    onChange={(title) =>
                      setPack(updateCategory(pack, c, (cat) => ({ ...cat, title })))
                    }
                    placeholder="Internet Lore"
                  />
                </div>
                <div className="row ed-cat__tools">
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={c === 0}
                    aria-label={`Move ${name} up`}
                    onClick={() =>
                      setPack({ ...pack, categories: move(pack.categories, c, c - 1) })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={c === pack.categories.length - 1}
                    aria-label={`Move ${name} down`}
                    onClick={() =>
                      setPack({ ...pack, categories: move(pack.categories, c, c + 1) })
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={pack.categories.length <= 1}
                    aria-label={`Remove ${name}`}
                    onClick={() => setRemovingCategory(c)}
                  >
                    Remove
                  </button>
                </div>
              </header>

              {err(`categories[${c}].clues`) ? (
                <p id={fieldId(`categories[${c}].clues`)} className="field__error" tabIndex={-1}>
                  {err(`categories[${c}].clues`)}
                </p>
              ) : null}

              <ol className="ed-clues">
                {category.clues.map((clue, k) => {
                  const base = `categories[${c}].clues[${k}]`;
                  const value = defaultRound?.pointsByTier[clue.tier];
                  return (
                    <li key={clue.id} className="ed-clue">
                      <div className="field ed-clue__tier">
                        <label className="field__label" htmlFor={fieldId(`${base}.tier`)}>
                          Tier
                        </label>
                        <select
                          id={fieldId(`${base}.tier`)}
                          className="input"
                          value={clue.tier}
                          aria-invalid={err(`${base}.tier`) ? true : undefined}
                          onChange={(e) =>
                            setPack(
                              updateClue(pack, c, k, {
                                tier: Number(e.target.value) as DifficultyTier,
                              }),
                            )
                          }
                        >
                          {TIERS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <span className="field__hint num">
                          {value ? `${formatScore(value)} pts` : ""}
                        </span>
                      </div>
                      <TextField
                        multiline
                        label={`Clue ${k + 1}`}
                        path={`${base}.prompt`}
                        value={clue.prompt}
                        error={err(`${base}.prompt`)}
                        onChange={(prompt) => setPack(updateClue(pack, c, k, { prompt }))}
                        placeholder="The clue the host reads out"
                      />
                      <TextField
                        label="Answer"
                        path={`${base}.answer`}
                        value={clue.answer}
                        error={err(`${base}.answer`)}
                        onChange={(answer) => setPack(updateClue(pack, c, k, { answer }))}
                        placeholder="What is…?"
                      />
                      <div
                        className="ed-clue__tools"
                        role="group"
                        aria-label={`Clue ${k + 1} tools`}
                      >
                        <button
                          type="button"
                          className="btn btn--small"
                          disabled={k === 0}
                          aria-label={`Move clue ${k + 1} up`}
                          onClick={() =>
                            setPack(
                              updateCategory(pack, c, (cat) => ({
                                ...cat,
                                clues: move(cat.clues, k, k - 1),
                              })),
                            )
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn--small"
                          disabled={k === category.clues.length - 1}
                          aria-label={`Move clue ${k + 1} down`}
                          onClick={() =>
                            setPack(
                              updateCategory(pack, c, (cat) => ({
                                ...cat,
                                clues: move(cat.clues, k, k + 1),
                              })),
                            )
                          }
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn btn--small"
                          disabled={category.clues.length <= 1}
                          aria-label={`Remove clue ${k + 1}`}
                          onClick={() =>
                            setPack(
                              updateCategory(pack, c, (cat) => ({
                                ...cat,
                                clues: removeAt(cat.clues, k),
                              })),
                            )
                          }
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <button
                type="button"
                className="btn btn--small ed-add"
                onClick={() =>
                  setPack(
                    updateCategory(pack, c, (cat) => ({
                      ...cat,
                      clues: [...cat.clues, blankClue(TIERS[Math.min(cat.clues.length, 4)])],
                    })),
                  )
                }
              >
                + Add clue
              </button>

              <div className="ed-final">
                <h4 className="eyebrow">Final-round clue</h4>
                <div className="ed-grid">
                  <TextField
                    multiline
                    label="Final clue"
                    path={`${finalCluePath(c)}.prompt`}
                    value={final.prompt}
                    error={err(`${finalCluePath(c)}.prompt`)}
                    onChange={(prompt) => setPack(updateFinal(pack, c, { prompt }))}
                    placeholder="Used if this category's final clue is picked"
                  />
                  <TextField
                    label="Final answer"
                    path={`${finalCluePath(c)}.answer`}
                    value={final.answer}
                    error={err(`${finalCluePath(c)}.answer`)}
                    onChange={(answer) => setPack(updateFinal(pack, c, { answer }))}
                    placeholder="What is…?"
                  />
                </div>
              </div>
            </article>
          );
        })}

        <button
          type="button"
          className="btn btn--big ed-add-cat"
          onClick={() =>
            setPack({
              ...pack,
              categories: [...pack.categories, blankCategory(cluesPerCategory || 5)],
            })
          }
        >
          + Add category
        </button>
      </section>

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
        open={removingCategory !== null}
        title={`Remove ${removingCategory !== null ? pack.categories[removingCategory]?.title.trim() || `category ${removingCategory + 1}` : "category"}?`}
        description="Its clues and final clue go too. You can still leave without saving to undo."
        confirmLabel="Remove category"
        cancelLabel="Keep it"
        onCancel={() => setRemovingCategory(null)}
        onConfirm={() => {
          if (removingCategory !== null)
            setPack({ ...pack, categories: removeAt(pack.categories, removingCategory) });
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
                if (storedDraft) setPack(storedDraft);
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
