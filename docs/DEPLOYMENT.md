# HAM Quiz deployment

The app runs one Node 24 process for Next.js, `/api/*`, WebSockets at `/ws`, and SQLite. Do not run multiple replicas against the same database. Each room has a promise queue; the engine state and recent command acknowledgments are saved in one SQLite write with WAL and `synchronous=FULL` before delivery. The Docker entrypoint uses `flock` to refuse a second process on the same volume.

Engine and content integration must be verified after merging the parallel work. This backend branch's engine is a throwing placeholder. The backend tests inject a fake engine to verify transport and persistence without implementing game rules.

## Local commands

Use Node 24 and npm 11. Run `npm ci`, then `npm run dev`. The combined server binds `127.0.0.1:3000`. For another local port, set `PORT=3101 PUBLIC_ORIGIN=http://127.0.0.1:3101 npm run dev`. Stop with Ctrl+C. Next development HMR upgrades pass through the custom server.

`npm run check` runs lint, typecheck, Vitest, the Next production build and the esbuild server bundle. After building, `npm run test:smoke` launches `npm start` on port 3101 with a temporary test database, checks health/session/fixture sign-in/Next serving and WebSocket Origin rejection, then stops it. An accepted production room handshake needs the merged engine; accepted handshakes are covered by injected-engine tests. `npm start` serves that bundle with Next in production mode. For a localhost smoke test of the built assets, use `APP_ENV=test HAM_MODE=fixture PORT=3101 PUBLIC_ORIGIN=http://127.0.0.1:3101 npm start`. This tests the production build but explicitly uses a test environment. Production configuration always rejects fixture auth.

The fixture consent page is marked as not live HAM. It supports quick accounts, custom names, null username and denial. Its localhost-only `POST /__ham/control` accepts `{"outage":true}` or `{"outage":false}`. Browser POSTs, including fixture controls, require the exact Origin. No fixture routes are mounted in production.

## Environment

`.env.example` lists names without values. These variables are server-only; none have `NEXT_PUBLIC_` prefixes. Set them in the process environment or a private Compose environment file. The custom server validates config before Next starts and does not load arbitrary dotenv files itself.

| Name | Default / requirement |
| --- | --- |
| `APP_ENV` | `development` unless `NODE_ENV` is set; `production` for deployment |
| `PUBLIC_ORIGIN` | Local `http://127.0.0.1:PORT`; production must use `https://quiz.teamham.world` |
| `HOST` | `127.0.0.1`; Docker sets `0.0.0.0` inside the proxy network |
| `PORT` | `3000`; Docker uses `8080` |
| `HAM_MODE` | `fixture` outside production, `live` in production |
| `HAM_ISSUER` | `https://teamham.world` in live mode |
| `HAM_CLIENT_ID` | `quiz`; other values rejected |
| `HAM_CLIENT_SECRET` | Live mode requires the registered `ths_` secret |
| `TOKEN_ENCRYPTION_KEY` | Production requires 32 random bytes encoded as 64 hex characters |
| `DATABASE_PATH` | `.data/quiz.sqlite`; Docker `/data/quiz.sqlite` |

Audience is fixed at `urn:teamham:game:quiz`; callback is derived as `${PUBLIC_ORIGIN}/api/auth/callback`. HTTPS uses host-only `__Host-quiz_session; Secure; HttpOnly; SameSite=Lax`. Local HTTP uses `quiz_session` without Secure. Session ids and display grants are stored as hashes. HAM access tokens and PKCE verifiers use AES-256-GCM with row-bound AAD.

The introspection lease is at most 30 seconds or token expiry. Room creation, joining, game start and socket connection force fresh introspection. Outages return `503 authUnavailable` for HTTP admission and never renew access. Connected clients receive no views after lease expiry and their sockets close if renewal fails. Inactive sessions close with `authExpired`; superseded logins close with `signedInElsewhere`.

Every authenticated mutation requires exact Origin and `x-quiz-csrf` from `/api/session`. Display claim is the deliberate exception: it is anonymous, requires Origin and an unguessable host-issued key, and is rate limited. Its HttpOnly cookie is named for the room; it cannot authenticate another room. Display links keep the key in a fragment. Rotation invalidates all older grants and closes their sockets.

Room codes use five consonants. Rooms close after 12 hours without persisted activity; reconnect/presence and accepted commands count as activity. Recent acknowledgments are bounded to 512 entries per room and keyed by role plus public account identity, so reconnect retries survive both session rotation and backend restart within that recent window. Rooms restore through `engine.restore` and receive `restored` before serving connections. Save failures never publish a new state or ack.

## Owner deployment steps

No deployment is performed by implementing these files.

1. Complete [HAM registration](HAM_REGISTRATION.md), including reserving `quiz`, then point DNS at the Oracle host with ports 80/443 reachable.
2. Create a private mode-600 environment file outside source control containing `HAM_CLIENT_SECRET` and `TOKEN_ENCRYPTION_KEY`. Generate the latter with `openssl rand -hex 32`; keep its output private. Back up the key. Losing it invalidates stored credentials.
3. Confirm the existing shared Caddy uses Docker network `proxy`, or change the Compose network name to the host's actual external network. Follow the existing Strokies host runbook for Caddy installation. This Compose file attaches `quiz-app` to that network and publishes no host ports.
4. Run `docker compose --env-file /private/quiz.env build`, then `docker compose --env-file /private/quiz.env up -d` after owner approval.
5. Install `deploy/quiz.caddy` in the shared Caddy site's include directory. Run its established `caddy validate` and `caddy reload` commands. Reverse proxy supports WebSockets automatically. Leave access logging off because callbacks carry codes.
6. Verify `/api/health`, HAM sign-in, session identity, host create, two phone joins, separate display claim, one clue, reconnect and backend restart pause. Inspect public WebSocket payloads for unrevealed answers. Fixture tests do not prove live HAM or a complete game.

The container runs as `node`, with a persistent SQLite volume, a read-only root, writable Next cache tmpfs, dropped capabilities and a healthcheck. Resource limits are starting values, not measured capacity. Rate limits key on the direct socket address, deliberately ignoring untrusted forwarded headers. Behind shared Caddy, IP limits are shared by proxy traffic; account and per-socket limits still apply. Revisit trusted proxy handling if that ceiling matters.

## Updates and backups

Wait for games to finish when possible. SIGTERM sends `serverShutdown`, drains room queues and closes SQLite. After restarting, active games restore paused through the engine.

Stop the app before a filesystem backup. Archive the entire `quiz-data` volume, including the database, WAL and SHM files. Back up the private environment file separately and encrypt both backups. Restart after the copy. Restore into an empty volume with the matching encryption key and application version. Never mix SQLite files from different snapshots or use `docker compose down -v` against real data.

Migrations are numbered in `src/server/storage.ts` and applied transactionally. Append new migrations after release; do not edit an applied version. Roll back the image and database together if the old image cannot read the current schema.

Application logs contain only the public listening origin, auth mode and a generic startup failure. No request URLs, query strings, bodies, cookies, authorization headers, state, verifiers, codes, tokens or subjects are logged.
