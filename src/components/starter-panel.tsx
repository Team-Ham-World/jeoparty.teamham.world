import Link from "next/link";
import type { TeamArea } from "../lib/team";

/*
  StarterPanel — shared placeholder for one member area.
  The parent route looks up its entry in teamAreas and passes
  it in as `area`. It shows honest scaffold labels only:
  no buttons, no buzzer, no fake board or controls.

  Note: guidePath names a docs file to read in the editor.
  Docs files are not web routes, so it is shown as <code>
  text and never linked.
*/

export function StarterPanel({ area }: { area: TeamArea }) {
  return (
    <main id="main-content" tabIndex={-1}>
      <div className="ham-shell max-w-3xl py-8 sm:py-12">
        <p>
          <Link href="/" className="ham-card-link">
            &larr; Back to workbench home
          </Link>
        </p>

        <header className="ham-hero mt-4 px-6 py-8 sm:px-8">
          <p className="flex flex-wrap gap-2">
            <span className="ham-badge ham-badge-gold">Scaffold only</span>
            <span className="ham-badge ham-badge-outline">
              Nonfunctional placeholder
            </span>
          </p>
          <p className="mt-4 text-xs font-bold tracking-widest text-white/80 uppercase">
            {area.owner}&apos;s area
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {area.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/90">
            {area.summary}
          </p>
        </header>

        <section
          aria-labelledby="panel-details-heading"
          className="ham-card mt-6 p-6 sm:p-8"
        >
          <h2 id="panel-details-heading" className="text-lg font-bold">
            Where this work lives
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-semibold">Route</dt>
              <dd className="mt-0.5">
                <code className="ham-code">{area.href}</code>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Source</dt>
              <dd className="mt-0.5">
                <code className="ham-code">{area.sourcePath}</code>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Member guide</dt>
              <dd className="mt-0.5">
                <code className="ham-code">{area.guidePath}</code>{" "}
                <span className="text-[#55617a]">
                  (read in your editor, not a web page)
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Next step</dt>
              <dd className="mt-0.5">{area.nextStep}</dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="panel-status-heading"
          className="mt-6 rounded-xl border border-[#ddd2b8] bg-[#fdf3d7] p-6 text-sm leading-relaxed"
        >
          <h2 id="panel-status-heading" className="font-bold text-[#5f4a08]">
            No live game connected
          </h2>
          <p className="mt-2 text-[#5f4a08]">
            This panel is intentionally empty. The owner replaces it with real
            content after milestone 0. Until then there is nothing to press,
            join, or score here.
          </p>
        </section>
      </div>
    </main>
  );
}
