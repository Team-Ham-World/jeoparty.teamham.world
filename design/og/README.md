# Social cards

The shipped cards are `public/og/home.png` and `public/og/invite.png`, each 1200×630.

## Edit and render

Use Node 24, run `npm ci`, then `npm run render:og`. The script uses Playwright Chromium with `--no-sandbox` and Sharp to produce palette PNGs under 300 KB. It uses an installed headless shell from the Playwright cache, or `PLAYWRIGHT_CHROMIUM_PATH`.

Edit the copy in `scripts/og/render.mjs` and the layout and CSS artwork in `design/og/card.html`. The dark studio backdrop, peach accents and retro TV match the broadcast-studio reference. Fonts come from the installed Fontsource packages. The script extracts the original SVG path from `src/features/ui/ham-wordmark.tsx` on every render.

For review copies, run `npm run render:og -- /absolute/output/directory`. This also writes self-contained HTML and 400×210 PNGs. The default writes only the two production PNGs. Set `OG_HOME_ART` or `OG_INVITE_ART` to a local image path to render that card with an alternate backdrop.

## Previous artwork

`home-art.jpg`, `invite-art.jpg` and `prompts.json` record the previous paper-collage design. The current cards render offline from the template and local fonts.

## Metadata and serving

Docker builds without `PUBLIC_ORIGIN`. The root layout therefore has safe defaults at `https://quiz.teamham.world` when Next builds in production, never a localhost fallback. In `npm run dev`, those defaults use `PUBLIC_ORIGIN` or the local `PORT`.

Home calls Next's `connection()` in its page metadata hook before reading `PUBLIC_ORIGIN`. Room pages already render dynamically through their route parameters, and their metadata hook reads the startup configuration too. This lets the same build serve either production or the local smoke-test origin for both shareable routes. Only home gains dynamic rendering; host, packs and display keep their existing rendering behavior and inherit the home card. Prerendered pack pages use the production origin in a production build; dynamic host and display pages inherit the startup origin. No root-level request API makes every page dynamic. Metadata never trusts request Host headers, queries rooms, or includes names. Invalid room codes receive generic metadata and the origin URL, with no input echoed.

Next serves `/og/*` from `public/`, through the custom server's existing public fallback. `next.config.ts` sets `Cache-Control: public, max-age=86400`, without immutable caching because the filenames are stable. No sign-in is required. Existing CSP, frame and opener policies do not block a crawler fetching HTML or PNGs. The smoke test checks anonymous Discordbot metadata in the HTML head, PNG signatures, image content types and caching.

Deployment needs only the normal image rebuild and restart with `APP_ENV=production` and `PUBLIC_ORIGIN=https://quiz.teamham.world`. Docker already copies `public/`. Actual platform cache refreshes and production crawler fetches remain deployment checks.
