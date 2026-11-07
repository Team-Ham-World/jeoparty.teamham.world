/**
 * Fixed-window counters keyed by bucket + subject (IP or account). Bounded:
 * when the table grows past `maxKeys`, expired windows are swept and, if still
 * full, the oldest entries are dropped.
 */
export class RateLimiter {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 20_000,
  ) {}

  checkpoint(): [string, { count: number; resetAt: number }][] {
    this.sweep(this.now());
    return [...this.windows];
  }

  restore(entries: ReturnType<RateLimiter["checkpoint"]>): void {
    for (const [key, entry] of entries)
      if (entry.resetAt > this.now()) this.windows.set(key, entry);
  }

  /** Returns true when the action is allowed. */
  take(
    bucket: string,
    subject: string,
    limit: number,
    windowMs: number,
  ): boolean {
    const key = `${bucket}:${subject}`;
    const now = this.now();
    let entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.windows.size >= this.maxKeys) this.sweep(now);
      entry = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= limit;
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.windows)
      if (entry.resetAt <= now) this.windows.delete(key);
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}
