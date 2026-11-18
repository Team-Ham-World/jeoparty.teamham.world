"use client";

import Link from "next/link";
import { useState } from "react";
import type { PackSummary } from "@/features/network/protocol";
import { ConfirmDialog } from "@/features/ui/dialog";
import { plural } from "@/features/ui/format";
import { PackCover, StudioHero } from "@/features/ui/studio-hero";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

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
      <StudioHero
        eyebrow="Question packs"
        title={
          <>
            Pack <i>library.</i>
          </>
        }
        description="Write your own clues or make a copy of a built-in pack."
      />

      <section aria-labelledby="mine-title" className="packs-shelf">
        <div className="packs-head">
          <h2 id="mine-title">My packs</h2>
          <Link className="btn btn--primary" href="/packs/new">
            + New pack
          </Link>
        </div>
        {mine.length === 0 ? (
          <p className="pack-card packs-empty">No packs yet.</p>
        ) : (
          <ul className="packs-grid">
            {mine.map((pack) => (
              <PackCard key={pack.id} pack={pack} busy={busyId === pack.id}>
                <Link className="btn btn--small btn--primary" href={`/packs/${pack.id}`}>
                  Edit
                </Link>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => onDuplicate(pack.id)}
                  disabled={busyId !== null}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => setDeleting(pack)}
                  disabled={busyId !== null}
                >
                  Delete
                </button>
              </PackCard>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="builtin-title" className="packs-shelf">
        <h2 id="builtin-title">Built-in packs</h2>
        <ul className="packs-grid">
          {builtIn.map((pack, index) => (
            <PackCard key={pack.id} pack={pack} busy={busyId === pack.id} snack={index % 2 === 1}>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => onDuplicate(pack.id)}
                disabled={busyId !== null}
              >
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

function PackCard({
  pack,
  busy,
  snack = false,
  children,
}: {
  pack: PackSummary;
  busy: boolean;
  snack?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="pack-card" aria-busy={busy || undefined}>
      <div className="pack-card__head">
        <PackCover variant={snack ? "snack" : "record"} />
        <div>
          <h3 className="pack-card__title">{pack.title}</h3>
          <p className="muted">
            {plural(pack.categories, "category", "categories")} ×{" "}
            {plural(pack.cluesPerCategory, "clue")}
          </p>
        </div>
      </div>
      {pack.description ? <p className="muted">{pack.description}</p> : null}
      {pack.updatedAt ? (
        <p className="field__hint">Updated {dateFormat.format(new Date(pack.updatedAt))}</p>
      ) : null}
      <div className="row pack-card__actions" role="group" aria-label={pack.title}>
        {children}
      </div>
    </li>
  );
}
