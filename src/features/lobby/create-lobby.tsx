"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type GameSettings,
  type SettingsPatch,
} from "@/features/engine/contract";
import { defaultSettingsForBoard } from "@/features/engine/settings";
import { SettingsEditor } from "@/features/host/lobby-settings";
import type { CreateRoomRequest, PackSummary } from "@/features/network/protocol";
import { plural } from "@/features/ui/format";
import { PackCover, StudioHero } from "@/features/ui/studio-hero";

const SNACK_PACK_ID = "7972d58d-1b8f-4bd4-9a3b-9b0679752823";

export function CreateLobby({
  packs,
  packsError,
  onCreateGame,
}: {
  packs: PackSummary[] | null;
  packsError: string | null;
  onCreateGame: (request: CreateRoomRequest) => Promise<void>;
}) {
  const [packId, setPackId] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = useRef(false);
  const pack = packs?.find((item) => item.id === packId) ?? packs?.[0];

  async function create(settings?: SettingsPatch) {
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    setError(null);
    try {
      if (pack) {
        await onCreateGame(settings ? { packId: pack.id, settings } : { packId: pack.id });
      } else {
        await onCreateGame({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the game. Try again.");
      creating.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <StudioHero
        eyebrow="Host desk"
        title={
          <>
            Create a <em>lobby.</em>
          </>
        }
        description="Pick what to play, then bring everyone into the room."
      />
      <div className="home-body home-create">
        <section aria-labelledby="home-packs-title">
          <div className="home-create__header">
            <h2 id="home-packs-title">Question pack</h2>
            <Link className="home-text-link" href="/packs">
              Browse library <span aria-hidden="true">↗</span>
            </Link>
          </div>
          {packsError ? (
            <p className="field__error" role="alert">
              Couldn&apos;t load question packs. {packsError}
            </p>
          ) : null}
          {packs === null ? (
            <p role="status" className="muted">
              Loading packs…
            </p>
          ) : null}
          {packs?.length === 0 ? (
            <p className="muted">The game will use the default pack.</p>
          ) : null}
          {pack ? (
            <div className="home-packs">
              {packs?.map((item) => {
                const selected = item.id === pack.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="home-pack"
                    aria-pressed={selected}
                    disabled={busy}
                    onClick={() => setPackId(item.id)}
                  >
                    <PackCover variant={item.id === SNACK_PACK_ID ? "snack" : "record"} />
                    <span className="home-pack__copy">
                      <strong>{item.title}</strong>
                      <small>
                        {plural(item.categories, "category", "categories")} ·{" "}
                        {plural(item.cluesPerCategory, "clue")} each
                        {item.source === "mine" ? " · Mine" : ""}
                      </small>
                    </span>
                    <span className="home-pack__mark" aria-hidden="true">
                      {selected ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
        <CreateLobbyOptions
          key={pack ? `${pack.id}:${pack.categories}:${pack.cluesPerCategory}` : "default"}
          pack={pack}
          expanded={expanded}
          onExpand={setExpanded}
          busy={busy}
          loading={packs === null}
          error={error}
          onCreate={create}
        />
      </div>
    </>
  );
}

function CreateLobbyOptions({
  pack,
  expanded,
  onExpand,
  busy,
  loading,
  error,
  onCreate,
}: {
  pack?: PackSummary;
  expanded: boolean;
  onExpand: (expanded: boolean) => void;
  busy: boolean;
  loading: boolean;
  error: string | null;
  onCreate: (settings?: SettingsPatch) => Promise<void>;
}) {
  const id = useId();
  const [dirty, setDirty] = useState(false);
  const settings = pack ? defaultSettingsForBoard(pack) : null;
  const [editedFormat, setEditedFormat] = useState<Pick<
    GameSettings,
    "rounds" | "categoriesPerRound" | "finalRound"
  > | null>(null);
  const format = editedFormat ?? settings;

  return (
    <>
      {pack && settings && format ? (
        <section aria-labelledby={`${id}-format`}>
          <div className="home-format">
            <div>
              <h2 id={`${id}-format`}>Game format</h2>
              <p className="muted" aria-live="polite">
                {plural(format.rounds, "round")} ·{" "}
                {plural(format.categoriesPerRound, "category", "categories")} per round · Final{" "}
                {format.finalRound ? "on" : "off"}
              </p>
            </div>
            <button
              type="button"
              className="home-text-link"
              aria-expanded={expanded}
              aria-controls={`${id}-settings-panel`}
              onClick={() => onExpand(!expanded)}
            >
              {expanded ? "Close settings" : "Adjust settings"}{" "}
              <span aria-hidden="true">{expanded ? "↑" : "↓"}</span>
            </button>
          </div>
          <div id={`${id}-settings-panel`} className="home-settings" hidden={!expanded}>
            <SettingsEditor
              formId={`${id}-settings`}
              settings={settings}
              pack={pack}
              disabled={busy}
              busy={busy}
              hideActions
              onDirtyChange={setDirty}
              onFormatChange={setEditedFormat}
              onInvalid={() => {
                // The editor focuses the invalid field as soon as this callback returns.
                if (!expanded) flushSync(() => onExpand(true));
              }}
              onSave={(patch) => void onCreate(dirty ? patch : undefined)}
            />
          </div>
        </section>
      ) : null}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="home-create__commit">
        <small className="muted">
          {MIN_PLAYERS}–{MAX_PLAYERS} players · 1 shared TV
        </small>
        <button
          type={pack ? "submit" : "button"}
          form={pack ? `${id}-settings` : undefined}
          className="btn btn--primary"
          disabled={busy || loading}
          aria-busy={busy || undefined}
          onClick={pack ? undefined : () => void onCreate()}
        >
          {busy ? (
            "Creating…"
          ) : (
            <>
              Create game <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
