# End-to-end tests

Real browsers against the real server: Next.js pages, `/api/*`, the `/ws`
WebSocket, SQLite and the local HAM sign-in fixture. Nothing is mocked.

```sh
npm run test:e2e        # build, start the server, run every spec (about 2 minutes)
npm run screenshots     # refresh docs/screenshots/ from the real app
```

`npm run check` does not run these; they are a separate step.

## What runs

| Spec | Covers |
|---|---|
| `game.spec.ts` | Host laptop, TV and three phones in separate browser contexts play the 3×3 pack: TV link claim (key stripped from the address bar), joining, a concurrent buzz race with exactly one winner, incorrect → reopen → correct, three wager clues (player wagers, host enters it for them, host skips), a late joiner on the bench, the final round (private wagers and answers, reveal then judge), results, and play again with the late joiner seated. |
| `resilience.spec.ts` | Removing a lobby player, rotating the TV link (old screen revoked, old key refused), pause/resume, a phone refreshing mid-clue (same identity and score), a phone going offline (stale banner, buzzing off, recovery), the host's tab closing (auto-pause everywhere, host returns and resumes), a score correction with a reason, round 2 of the starter pack, ending early, and signing out. |
| `picture.spec.ts` | The author attaches pictures in the pack editor (Chromium re-encodes a generated PNG to JPEG), saves and reloads them. Then a TV, the host and two phones play the pack: no picture on the TV before a pick; a standard clue's picture loads on the TV and host while phones keep only the buzzer; a wager clue's and the final clue's pictures stay host-only until the wager is in or the clue is shown, then load on the TV and both phones. |
| `pack-editor.spec.ts` | Validation errors mapped to fields, save, edit with the leave-without-saving guard, export and import JSON (including a broken file), duplicate, delete, copy a built-in pack, and starting a game with the new pack. |
| `screenshots.spec.ts` | Skipped unless `E2E_SCREENSHOTS=1` (`npm run screenshots`). Writes `<screen>-<state>-<width>x<height>.png` at phone 390×844 and 360×740, laptop 1366×768 and TV 1920×1080. |

## How it works

- `start-server.mjs` runs `npm run build`, then `dist/server.cjs` on
  `http://127.0.0.1:3501` with `APP_ENV=test`, `HAM_MODE=fixture` and a new
  SQLite database in a temp folder that is deleted afterwards.
- Each person is a separate browser context, so cookies and sessions are
  separate, like separate devices. Every test signs in with its own usernames
  through the fixture's consent page.
- Tests run one at a time: they share one server, and the server rate-limits
  sign-ins (20 a minute) and sockets per IP address.
- Contexts use `reducedMotion: "reduce"` so animations never race the checks.

## Useful switches

| Variable | Effect |
|---|---|
| `E2E_SKIP_BUILD=1` | Reuse the current `.next` and `dist` build while iterating. |
| `E2E_PORT=3601` | Use another port. |
| `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome` | Use a specific Chromium. |
| `E2E_SCREENSHOTS_DIR=/tmp/shots` | Write screenshots somewhere else (with `npm run screenshots`). |

Playwright 1.63 expects its own Chromium build (`npx playwright install
chromium`). If that build is missing, `playwright.config.ts` uses the newest
Chromium already in the Playwright cache (`~/.cache/ms-playwright`), preferring
the headless shell. Only Chromium is covered; WebKit (iOS Safari) and Firefox
are not.

Failures keep a trace, screenshots and an error snapshot in
`test-results/e2e/` (`npx playwright show-trace <trace.zip>`).
