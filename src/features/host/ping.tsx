/**
 * The host's view of each phone's ping (the server-measured median round
 * trip). Host only: players and the TV never receive these numbers.
 */

/**
 * Above this median round trip a phone is marked "slow". Fair buzzing makes
 * up for a phone's lag only while half of its 90th-percentile round trip stays
 * under 250 ms (docs/RULES.md). The host sees the median, and on busy Wi-Fi
 * the 90th percentile runs well above it, so a median past 250 ms means that
 * phone is probably at the limit: it can lose races it reacted fast enough to
 * win, and its buzzer feels late. Below it there is room to spare.
 */
export const SLOW_PING_MS = 250;

export type PingStatus = { kind: "measuring" | "ok" | "slow"; text: string; label: string };

/** What the chip says, and the fuller sentence a screen reader hears. */
export function pingStatus(ms: number | null): PingStatus {
  if (ms === null || !Number.isFinite(ms) || ms < 0)
    return { kind: "measuring", text: "measuring…", label: "Ping: measuring" };
  const rounded = Math.round(ms).toLocaleString("en-US");
  return ms > SLOW_PING_MS
    ? { kind: "slow", text: `${rounded} ms · slow`, label: `Ping ${rounded} ms, slow` }
    : { kind: "ok", text: `${rounded} ms`, label: `Ping ${rounded} ms` };
}

/**
 * A small, quiet ping readout beside a player's name. Nothing shows for a
 * phone that is away: its "away" tag already says why there is no number.
 */
export function PingChip({ ms, connected }: { ms: number | null | undefined; connected: boolean }) {
  if (!connected) return null;
  const status = pingStatus(ms ?? null);
  return (
    <span
      className={`ping ping--${status.kind}`}
      title="Ping: round trip from this phone to the server"
    >
      <span aria-hidden="true">{status.text}</span>
      <span className="sr-only">{status.label}</span>
    </span>
  );
}
