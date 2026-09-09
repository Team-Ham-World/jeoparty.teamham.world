import Link from "next/link";
import { teamAreas } from "../lib/team";

/*
  StarterHome — the shared learning-workbench home.
  Server component with no interactivity: it only lists
  the six owner areas from src/lib/team.ts and links to them.
  There are no game controls here on purpose.
*/

export function StarterHome() {
  return (
    <main id="main-content" tabIndex={-1}>
      <div className="ham-shell py-8 sm:py-12">
        {/* Intro band: what this page is, honestly labeled. */}
        <header className="ham-hero px-6 py-8 sm:px-10 sm:py-10">
          <p className="flex flex-wrap gap-2">
            <span className="ham-badge ham-badge-gold">Scaffold only</span>
            <span className="ham-badge ham-badge-outline">
              No live game connected
            </span>
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            JeoParty Team Ham Workbench
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/90">
            A shared starting point for six beginners. Each card below names
            its owner, links to that area&apos;s route, and shows the next
            small task. Nothing here starts, plays, or scores a game.
          </p>
        </header>

        {/* The six owner areas. Content comes from teamAreas. */}
        <section aria-labelledby="areas-heading" className="mt-10">
          <h2 id="areas-heading" className="text-xl font-bold">
            Six owner areas
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#55617a]">
            Pick your owner card to open your route. File paths are shown as{" "}
            <code className="ham-code">code</code> so you know where the work
            will live.
          </p>

          <ul className="mt-6 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {teamAreas.map((area) => (
              <li key={area.id} className="m-0 p-0">
                <article className="ham-card flex h-full flex-col p-6">
                  <p className="text-xs font-bold tracking-widest text-[#1e4f8a] uppercase">
                    {area.owner}
                  </p>
                  <h3 className="mt-1 text-lg font-bold">{area.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#55617a]">
                    {area.summary}
                  </p>

                  <dl className="mt-4 space-y-2 text-sm">
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
                      <dt className="font-semibold">Next task</dt>
                      <dd className="mt-0.5 text-[#1e293b]">
                        {area.nextStep}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-5 pt-1">
                    <Link
                      href={area.href}
                      className="ham-card-link"
                      aria-label={`Open ${area.owner}'s area: ${area.title}`}
                    >
                      Open {area.owner}&apos;s area &rarr;
                    </Link>
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </section>

        {/* How to read this scaffold. No controls, just guidance. */}
        <section
          aria-labelledby="scaffold-heading"
          className="ham-card mt-8 p-6 sm:p-8"
        >
          <h2 id="scaffold-heading" className="text-lg font-bold">
            How to use this scaffold
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>
              Each member route renders the same honest placeholder pattern —
              owner, paths as text, and a next step.
            </li>
            <li>
              Guide files (for example{" "}
              <code className="ham-code">docs/pointers/…</code>) are local
              files to read in your editor. They are not web routes, so they
              are shown as text, never linked.
            </li>
            <li>
              When your area is ready, your route replaces its placeholder
              with real content. This home page stays as the map.
            </li>
          </ul>
        </section>

        <footer className="mt-8 text-center text-sm text-[#55617a]">
          <p>
            Team Ham learning workbench &middot; Scaffold only &middot; No
            live game connected
          </p>
        </footer>
      </div>
    </main>
  );
}
