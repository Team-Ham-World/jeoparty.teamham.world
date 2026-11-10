# HAM Quiz deployment

The app runs one Node 24 process for Next.js, `/api/*`, WebSockets at `/ws`, and SQLite. Do not run multiple replicas against the same database. Each room has a promise queue; the engine state and recent command acknowledgments are saved in one SQLite write with WAL and `synchronous=FULL` before delivery. The Docker entrypoint uses `flock` to refuse a second process on the same volume.

The backend tests cover transport boundaries with an injected engine and full games with the real engine. The production smoke also plays one real-engine clue.

## Local commands

Use Node 24 and npm 11. Run `npm ci`, then `npm run dev`. The combined server binds `127.0.0.1:3000`. For another local port, set `PORT=3401 PUBLIC_ORIGIN=http://127.0.0.1:3401 npm run dev`. Stop with Ctrl+C. Next development HMR upgrades pass through the custom server.

`npm run check` runs lint, typecheck, Vitest, the Next production build and the esbuild server bundle. After building, `npm run test:smoke` launches `npm start` on port 3401 with a temporary test database, checks health/session/fixture sign-in/Next pages and security headers, WebSocket Origin rejection, and a full clue, then stops it. The smoke covers accepted host/player/display handshakes and score convergence. `npm start` serves that bundle with Next in production mode. For a localhost smoke test of the built assets, use `APP_ENV=test HAM_MODE=fixture PORT=3401 PUBLIC_ORIGIN=http://127.0.0.1:3401 npm start`. This tests the production build but explicitly uses a test environment. Production configuration always rejects fixture auth.

Without an explicit `TOKEN_ENCRYPTION_KEY`, fixture mode uses a random process-local key. Set a private key to test persistence across restarts; otherwise stored fixture sessions and pending sign-ins cannot be decrypted after restart. Fixture mode requires a loopback bind host (`127.0.0.1`, `::1`, or `localhost`) as well as a localhost public origin.

The fixture consent page is marked as not live HAM. It supports quick accounts, custom names, null username and denial. Its localhost-only `POST /__ham/control` accepts `{"outage":true}` or `{"outage":false}`. Browser POSTs, including fixture controls, require the exact Origin. No fixture routes are mounted in production.

## Environment

`.env.example` lists names without values. These variables are server-only; none have `NEXT_PUBLIC_` prefixes. Set them in the process environment or a private Compose environment file. The custom server validates config before Next starts and does not load arbitrary dotenv files itself.

| Name | Default / requirement |
| --- | --- |
| `APP_ENV` | `development` unless `NODE_ENV` is set; `production` for deployment |
| `PUBLIC_ORIGIN` | Local `http://127.0.0.1:PORT`; production must use `https://quiz.teamham.world` |
| `HOST` | `127.0.0.1`; Docker sets `0.0.0.0` inside the proxy network |
| `TRUST_PROXY` | `false`; Compose sets `true` behind the single Caddy hop. See proxy boundary below |
| `PORT` | `3000`; Docker uses `8080` |
| `HAM_MODE` | `fixture` outside production, `live` in production |
| `HAM_ISSUER` | `https://teamham.world` in live mode |
| `HAM_CLIENT_ID` | `quiz`; other values rejected |
| `HAM_CLIENT_SECRET` | Live mode requires the registered `ths_` secret |
| `TOKEN_ENCRYPTION_KEY` | Live mode requires 32 random bytes encoded as 64 hex characters in every environment; production also always requires it |
| `DATABASE_PATH` | `.data/quiz.sqlite`; Docker `/data/quiz.sqlite` |

Audience is fixed at `urn:teamham:game:quiz`; callback is derived as `${PUBLIC_ORIGIN}/api/auth/callback`. HTTPS uses host-only `__Host-quiz_session; Secure; HttpOnly; SameSite=Lax`. Local HTTP uses `quiz_session` without Secure. Session ids and display grants are stored as hashes. HAM access tokens and PKCE verifiers use AES-256-GCM with row-bound AAD.

Every protected HTTP request freshly introspects, including session, room, pack and logout routes. WebSocket connection and every `startGame` command also freshly introspect. Other in-socket commands use a lease of at most 30 seconds or token expiry, measured from introspection start; renewal begins in the last five seconds. Outages return `503 authUnavailable` for protected HTTP requests and never renew the socket lease. Connected clients receive no views after lease expiry and their sockets close if renewal fails. Inactive sessions are revoked locally and close with `authExpired`; superseded logins close with `signedInElsewhere`. This hybrid policy is an owner-approved deviation for in-socket commands only; see [security decisions](SECURITY.md) for the normative references and buzz-latency rationale.

Every authenticated mutation requires exact Origin and `x-quiz-csrf` from `/api/session`. Display claim is the deliberate exception: it is anonymous, requires Origin and an unguessable host-issued key, and is rate limited. Its HttpOnly cookie is named for the room; it cannot authenticate another room. Display links keep the key in a fragment. Rotation invalidates all older grants and closes their sockets.

Room codes use five consonants. Rooms close after 12 hours without persisted activity; reconnect/presence and accepted commands count as activity. A server restart does not: shutdown and the `restored` step save without restarting that clock. Only accepted commands enter the durable replay cache, with at most 32 entries per role plus public account identity across all its sockets. One sender cannot evict another sender's accepted retries. Accepted retries survive session rotation and restart within that window. Rejected IDs are replayed too, from memory only: at most 32 per identity and 512 per room, forgotten on restart. They do not write room state or extend room lifetime. Rooms restore through `engine.restore` and receive `restored` before serving connections. Invalid state or malformed state/replay JSON moves the row to `quarantined_rooms`, deletes its display grants, and logs only the room code. Other rooms continue restoring. Inspect/repair quarantine offline before restoring a row; it is never served automatically. Save failures never publish a new state or ack.

## Resource and browser limits

Each account can save 50 packs, each at most 256 KiB of serialized UTF-8 JSON. Updates at the count limit are allowed; delete a pack to make room. Duplicate also counts toward the limit. Count errors return `409 conflict`; oversized packs return `413 badRequest`. Pack uploads accept request bodies up to 1 MiB; other API mutations, including display claim, accept at most 4 KiB, including chunked bodies.

Content validation rejects titles/IDs/authors/tags over 120 characters, prompts/answers over 500, notes/descriptions over 1000, more than 12 categories, more than 5 clues per category, or more than 4 scoring rounds. Validation returns `400 invalidPack` with field errors. Both built-in packs meet these limits. Pack lists read stored summaries; existing summaries are backfilled once on startup. The server indexes player/waiting membership by public ID for name synchronization.

A host can keep three rooms open, including finished rooms until closed or expired. A fourth returns `409 conflict`; 500 total open rooms returns `429 rateLimited`. The home page lists the rooms a host has open (`GET /api/rooms`), and each has a Close room button that calls `POST /api/rooms/:code/leave` to release capacity. No new API error codes are introduced.

Node sets security headers before handing requests to Next, so HTML protection does not depend on Caddy. CSP forbids framing, objects and external script sources, and permits Next inline bootstrap scripts/styles. Development additionally permits script evaluation and the same-origin HMR WebSocket. This is a baseline CSP, not a nonce-based inline-script policy. Pages use `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` (not `no-referrer`, which makes browsers send `Origin: null` on same-origin form posts and break the exact-Origin checks; display keys live in the URL fragment, which is never sent as a referrer) and `X-Content-Type-Options: nosniff`. HSTS is emitted only in production by Node, and mirrored on the production Caddy site.

## Owner deployment steps

No deployment is performed by implementing these files.

1. Complete [HAM registration](HAM_REGISTRATION.md), including reserving `quiz`, then point DNS at the Oracle host with ports 80/443 reachable.
2. Create a private mode-600 environment file outside source control containing `HAM_CLIENT_SECRET` and `TOKEN_ENCRYPTION_KEY`. Generate the latter with `openssl rand -hex 32`; keep its output private. Back up the key. Losing it invalidates stored credentials.
3. Confirm the existing shared Caddy uses Docker network `proxy`, or change the Compose network name to the host's actual external network. Follow the existing Strokies host runbook for Caddy installation. This Compose file attaches `quiz-app` to that network and publishes no host ports.
4. Run `docker compose --env-file /private/quiz.env build`, then `docker compose --env-file /private/quiz.env up -d` after owner approval.
5. Install `deploy/quiz.caddy` in the shared Caddy site's include directory. Run its established `caddy validate` and `caddy reload` commands. Reverse proxy supports WebSockets automatically. Leave access logging off because callbacks carry codes.
6. Verify `/api/health`, HAM sign-in, session identity, host create, two phone joins, separate display claim, one clue, reconnect and backend restart pause. Inspect public WebSocket payloads for unrevealed answers. Fixture tests do not prove live HAM or a complete game.

The container runs as `node`, with a persistent SQLite volume, a read-only root, writable Next cache tmpfs, dropped capabilities and a healthcheck. Resource limits are starting values, not measured capacity. With `TRUST_PROXY=false`, rate limits use the direct socket address and ignore forwarded headers. With `TRUST_PROXY=true`, every IP limiter uses the right-most `X-Forwarded-For` entry appended by the single Caddy hop; client-supplied prefixes never select a bucket. This configuration assumes Caddy has no `trusted_proxies` and the app is reachable only through Caddy on the private proxy network. Do not expose the Node port publicly with proxy trust enabled. Multiple proxy hops require a separately reviewed configuration. Per-account limits remain in force. Host sockets allow 60 messages per five seconds; player/display sockets allow 20.

## Current deployment

First deployed 2026-11-07 at **https://quiz.teamham.world**. Last redeployed 2026-11-08 with the UI polish pass, social cards and fair buzzing, from commit `3d55773` on `feat/ham-quiz`.

- **DNS:** `quiz.teamham.world` is a Cloudflare-proxied CNAME to `oracle.cyr1en.dev`, the same as Strokies.
- **Ingress:** the shared Caddy on the Oracle host serves `/opt/stacks/caddy/sites/quiz.caddy` (a copy of `deploy/quiz.caddy`), with a Let's Encrypt certificate.
- **App:** Compose project `quiz`, built from the source snapshot in `/opt/stacks/quiz/app` (`DEPLOYED_COMMIT` records the commit). Container `quiz-app-1`, alias `quiz-app` on the `proxy` network, SQLite in the `quiz_quiz-data` volume.
- **Secrets:** `/opt/stacks/quiz/quiz.env` (mode 600) holds `HAM_CLIENT_SECRET` and `TOKEN_ENCRYPTION_KEY`. Back it up privately; losing the key signs everyone out, and losing the secret means rotating it in HAM.

Redeploy a newer commit (wait for games to finish when possible):

```sh
cd /home/ubuntu/TeamHamWorld/jeoparty.teamham.world   # clean working tree on the commit to ship
rm -rf /opt/stacks/quiz/app && mkdir /opt/stacks/quiz/app
git archive HEAD | tar -x -C /opt/stacks/quiz/app && git rev-parse --short HEAD > /opt/stacks/quiz/app/DEPLOYED_COMMIT
docker compose -f /opt/stacks/quiz/app/docker-compose.yml --env-file /opt/stacks/quiz/quiz.env -p quiz up -d --build
```

Verified after deployment:

- Over HTTPS through Cloudflare: `/api/health`, `/api/session` (`authMode: live`), and pages with CSP, HSTS and `X-Frame-Options`.
- The login redirect sends exactly `client_id=quiz`, the registered callback and audience, scope `identity`, and S256 PKCE.
- HAM's authorize endpoint accepts the client, sending a signed-out visitor on to Discord login.
- `/ws` upgrades reach the app.

Not yet verified: a real HAM sign-in, and a game played on real phones.

## Updates and backups

Wait for games to finish when possible. SIGTERM sends `serverShutdown`, drains room queues and closes SQLite. After restarting, active games restore paused through the engine.

Stop the app before a filesystem backup. Archive the entire `quiz-data` volume, including the database, WAL and SHM files. Back up the private environment file separately and encrypt both backups. Restart after the copy. Restore into an empty volume with the matching encryption key and application version. Never mix SQLite files from different snapshots or use `docker compose down -v` against real data.

Migrations are numbered in `src/server/storage.ts` and applied transactionally. Append new migrations after release; do not edit an applied version. Roll back the image and database together if the old image cannot read the current schema.

Application logs contain only the public listening origin, auth mode and a generic startup failure. No request URLs, query strings, bodies, cookies, authorization headers, state, verifiers, codes, tokens or subjects are logged.
