"use client";

import Link from "next/link";
import { useState } from "react";
import type { PackSummary } from "@/features/network/protocol";
import { ConfirmDialog } from "@/features/ui/dialog";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function PacksList({
  packs,
  busyId,
  onDuplicate,
  onDelete,
}: {
  packs: PackSummary[];
  busyId: string | null;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<PackSummary | null>(null);
  const mine = packs.filter((p) => p.source === "mine");
  const builtIn = packs.filter((p) => p.source === "builtIn");

  return (
    <div className="packs">
      <div className="packs-head">
        <div className="stack stack--tight">
          <h1 className="marker">Question packs</h1>
          <p className="muted">Write your own categories and clues, or copy a built-in pack and remix it.</p>
        </div>
        <Link className="btn btn--primary btn--big" href="/packs/new">
          + New pack
        </Link>
      </div>

      <section aria-labelledby="mine-title" className="stack">
        <h2 id="mine-title">My packs</h2>
        {mine.length === 0 ? (
          <p className="panel panel--sunk">No packs yet. Start a new one, or copy a built-in pack below.</p>
        ) : (
          <ul className="packs-grid">
            {mine.map((pack) => (
              <PackCard key={pack.id} pack={pack} busy={busyId === pack.id}>
                <Link className="btn btn--small btn--primary" href={`/packs/${pack.id}`}>
                  Edit
                </Link>
                <button type="button" className="btn btn--small" onClick={() => onDuplicate(pack.id)} disabled={busyId !== null}>
                  Duplicate
                </button>
                <button type="button" className="btn btn--small" onClick={() => setDeleting(pack)} disabled={busyId !== null}>
                  Delete
                </button>
              </PackCard>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="builtin-title" className="stack">
        <h2 id="builtin-title">Built in</h2>
        <ul className="packs-grid">
          {builtIn.map((pack) => (
            <PackCard key={pack.id} pack={pack} busy={busyId === pack.id}>
              <button type="button" className="btn btn--small" onClick={() => onDuplicate(pack.id)} disabled={busyId !== null}>
                Copy to my packs
              </button>
            </PackCard>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="This can't be undone. Games already running keep their own copy."
        confirmLabel="Delete pack"
        cancelLabel="Keep it"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) onDelete(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}

function PackCard({ pack, busy, children }: { pack: PackSummary; busy: boolean; children: React.ReactNode }) {
  return (
    <li className="panel pack-card" aria-busy={busy || undefined}>
      <div className="pack-card__meta">
        <span className={`stamp stamp--flat ${pack.source === "mine" ? "stamp--blue" : "stamp--dashed"}`}>{pack.source === "mine" ? "Mine" : "Built in"}</span>
        <span className="muted num">
          {pack.categories} categories × {pack.cluesPerCategory} clues
        </span>
      </div>
      <h3 className="pack-card__title name">{pack.title}</h3>
      {pack.description ? <p className="muted pack-card__desc">{pack.description}</p> : null}
      {pack.updatedAt ? <p className="field__hint">Updated {dateFormat.format(new Date(pack.updatedAt))}</p> : null}
      <div className="row pack-card__actions">{children}</div>
    </li>
  );
}
