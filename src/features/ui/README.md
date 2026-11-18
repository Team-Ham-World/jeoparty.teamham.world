# HAM Quiz UI kit

The [broadcast studio mockup](../../../design/mockups/broadcast-studio.html) defines the shared look. Cream pages use warm card surfaces and fine rules. The TV and page heroes use an ink stage. Peach marks the main action, violet marks links and selection, and lilac supplies contrast on the stage.

The real palette, typography, and control styles live in [globals.css](../../app/globals.css). Bricolage Grotesque is the main face. Use `--font-mono` for room codes, timers, and small uppercase labels, and `--font-reading` for longer clue text. Use ink text on peach or lilac and cream text on violet. Decorative red never carries meaning. Pair state colors with words such as “Correct”, “Locked out”, and “Away”.

## Shared pieces

| File | Purpose |
|---|---|
| `studio-hero.tsx` | `StudioHero` for a page heading with CRT artwork. Pass `<em>` inside `title` for peach emphasis. `PackCover` provides decorative `record` and `snack` thumbnails beside pack names. |
| `brand.tsx` | `Lockup` for the studio mark and product name, `HotHam` for wager clues, and `FixtureStamp` for development sign-in. |
| `ham-wordmark.tsx` | Canonical traced mark used in `HotHam`. |
| `page-chrome.tsx` | Page header with real navigation and account controls, and the loading, sign-in, and error screens. |
| `dialog.tsx` | Native modal dialog with focus trapping, Escape, and focus return. Confirmation dialogs focus the cancel action first. |
| `toasts.tsx`, `use-command.ts` | Polite announcements for confirmations and rejected commands. `useCommand` tracks pending commands and refuses them while stale. |
| `connection-status.tsx` | Connection status pill, stale banner, and disconnected room notice. |
| `clock.ts`, `countdown.tsx` | Shared ticking clock and countdown using the server timer and clock offset. |
| `clue-picture.tsx` | Picture mat in a frame sized by the caller. The description stays in the image alt text. |
| `wager-form.tsx` | Whole-number wager controls using server-given bounds. |
| `qr-code.tsx`, `copy-field.tsx` | Local SVG QR code and a read-only link with a Copy button. |
| `events.ts`, `haptics.ts` | Game-event announcements and optional vibration after interaction. |

Screens read `view.can.*`, `allowedCommands`, `startBlockers`, `wagerBounds`, and `myFinal` to show the actions the game allows. Disable actions while `connection.stale` is true. Motion is decorative, respects `prefers-reduced-motion`, and never delays game actions. `useFreshEvent` keeps a reconnect from replaying one-shot feedback.

## Contrast

`contrast.test.ts` reads the colors from `globals.css`. It checks 4.5:1 for normal text and 3:1 for large display text and meaningful borders or focus rings. Add the foreground and background pair when introducing a new use of a shared color. The test covers the brightest point of the hero gradient.

| Foreground | Background | Contrast |
|---|---|---|
| Ink | Cream | 16.28:1 |
| Ink | Peach | 8.43:1 |
| Ink | Lilac | 9.93:1 |
| Cream | Violet | 7.67:1 |
| Violet | Violet tint | 6.66:1 |
| Peach hero title emphasis | Hero glow | 4.07:1 |
| Blue focus ring | Cream | 4.79:1 |
| Lilac focus ring | Raised stage | 8.43:1 |
