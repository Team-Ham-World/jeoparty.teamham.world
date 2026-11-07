# HAM Quiz UI kit

Shared pieces every screen uses. The look is HAM System A, "Cut & Paste" (see
`organization-docs/BRAND.md`): paper slips pasted onto paper (phone, host,
editor) or onto an ink stage (the TV), hard offset shadows instead of blur,
near-zero corners, rubber stamps for state, and at most one red marker stroke
per screen.

## Rules of thumb

- **Screens render views; they never decide rules.** Use `view.can.*`,
  `allowedCommands`, `startBlockers`, `wagerBounds` and `myFinal`. Disable every
  action while `connection.stale` is true.
- **Colors are tokens** in `src/app/globals.css` (`:root`). Decorative red
  (`--red`) never carries text or meaning. Interactive blue (`--blue`) is only
  for things you can press, links, selection and focus. State always has a word
  next to its color ("Correct", "Locked out", "Away").
- **Type:** Bricolage Grotesque 800 for display headings and board values,
  Atkinson Hyperlegible for everything else, including clue prompts (most
  legible at 10 feet). "HAM" is always the traced wordmark (`HamWordmark`),
  never typed in a font, so the wager brand renders as "Hot [wordmark]!".
- **Motion** is short, decorative and never blocks input. Under
  `prefers-reduced-motion` every animation and transition finishes instantly.
  One-shot effects use `useFreshEvent`, so a reconnect never replays them.

## Pieces

| File | What it is |
|---|---|
| `brand.tsx` | `Lockup` ("HAM Quiz"), `HotHam`, `FixtureStamp` |
| `ham-wordmark.tsx` | Copy of the canonical traced wordmark from teamham.world |
| `dialog.tsx` | Native `<dialog>` (`showModal`: focus trap, Escape, focus return) and `ConfirmDialog` (safe choice focused first) |
| `toasts.tsx` | `ToastProvider` / `useToast` for rejected commands (polite live region) |
| `use-command.ts` | Sends a command, tracks `pending`, turns rejections into toasts, refuses while stale |
| `clock.ts`, `countdown.tsx` | One shared ticking clock; countdown bar that reads the server timer with `clockOffsetMs` |
| `connection-status.tsx` | Live/Reconnecting pill, stale banner, closed-reason screens |
| `events.ts` | Screen-reader sentences for game events; pause copy |
| `wager-form.tsx` | Whole-number wager inside server-given bounds, with quick picks |
| `qr-code.tsx` | QR code as one SVG path (no images, no network) |
| `copy-field.tsx` | Read-only link + Copy button |
| `page-chrome.tsx` | Paper top bar, loading/error/sign-in notices |
| `haptics.ts` | Optional `navigator.vibrate`, only after the person has tapped |
| `contrast.ts` | WCAG math and the list of color pairs we use |

## Measured contrast

`contrast.test.ts` reads the tokens from `globals.css` and checks every pair
below on each `npm test`. Recompute this table if a token changes.

| Foreground | Background | Ratio | Min | Used for |
|---|---|---|---|---|
| ink | paper | 15.40 | 4.5 | body text |
| ink | surface | 17.06 | 4.5 | panel text |
| ink | shade | 13.34 | 4.5 | sunken panel / disabled buzzer |
| ink | highlight | 13.64 | 4.5 | answers, warnings, "you" |
| ink | hot | 9.09 | 4.5 | Hot HAM / wager stamps |
| ink | blue-tint | 13.76 | 4.5 | hover, answering row |
| ink | good-tint | 14.41 | 4.5 | correct row |
| ink | bad-tint | 13.39 | 4.5 | incorrect row |
| muted | paper | 6.47 | 4.5 | secondary text |
| muted | surface | 7.16 | 4.5 | secondary text on panels |
| muted | shade | 5.60 | 4.5 | disabled buzzer label |
| blue | paper | 5.95 | 4.5 | links; focus ring (3:1 needed) |
| blue | surface | 6.58 | 4.5 | links on panels |
| surface | blue | 6.58 | 4.5 | primary buttons, buzz |
| surface | good | 6.41 | 4.5 | Correct button / stamp |
| surface | bad | 7.15 | 4.5 | Incorrect button / stamp |
| surface | ink | 17.06 | 4.5 | ink headers, stamps |
| good | paper | 5.79 | 4.5 | correct text |
| bad | paper | 6.46 | 4.5 | negative scores, errors |
| bad | surface | 7.15 | 4.5 | errors on panels |
| bad | bad-tint | 5.61 | 4.5 | error banner text |
| stage-text | stage | 15.40 | 4.5 | TV text |
| stage-text | stage-raise | 13.01 | 4.5 | TV score tiles |
| stage-muted | stage | 8.06 | 4.5 | TV secondary text |
| stage-muted | stage-raise | 6.81 | 4.5 | away player tile |
| stage-faint | stage | 6.22 | 4.5 | completed board cells |
| stage-bad | stage-raise | 7.15 | 4.5 | TV negative scores |
| ink | stage-blue | 7.98 | 4.5 | "Picks" tag |
| stage-text | blue | 5.95 | 4.5 | answering tile, active cell |
| stage-blue | stage | 7.98 | 3 | TV outlines (non-text) |
| red (decorative) | paper | 4.14 | — | stamps and strokes only, never text |
