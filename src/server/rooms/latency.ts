import { randomUUID } from "node:crypto";

/** Per-socket transport data. Never persisted with the game or accepted from a phone. */
export class Latency {
  private samples: number[] = [];
  private pending = new Map<string, number>();
  private lastProbe = -Infinity;

  probe(now: number): { t: "probe"; id: string; at: number } | null {
    if (now - this.lastProbe < 2000) return null;
    this.lastProbe = now;
    for (const [id, at] of this.pending) if (now - at > 10_000) this.pending.delete(id);
    const id = randomUUID();
    this.pending.set(id, now);
    return { t: "probe", id, at: now };
  }
  acknowledge(id: string, arrival: number): boolean {
    const sentAt = this.pending.get(id);
    if (sentAt === undefined || arrival < sentAt) return false;
    this.pending.delete(id);
    if (arrival - sentAt > 10_000) return false;
    this.samples.push(arrival - sentAt);
    this.samples = this.samples.slice(-10);
    return true;
  }
  get median(): number | null {
    if (!this.samples.length) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  get p90(): number {
    const sorted = [...this.samples].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * 0.9) - 1] ?? 300;
  }
  get uplinkBound(): number {
    return Math.min(250, this.p90 / 2);
  }
}
