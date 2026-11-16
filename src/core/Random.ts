/**
 * Deterministic, seedable pseudo-random number generator (Mulberry32).
 *
 * Never use Math.random() in gameplay logic. Every random decision (which word
 * spawns, where, which modifier it gets) must come from a SeededRandom so that
 * a match can be reproduced exactly from its seed — both players in a Wizard
 * Duel get the same word sequence, and the server can re-check results.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Current internal state; pass to `new SeededRandom(state)` to resume. */
  getState(): number {
    return this.state;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    if (max < min) throw new RangeError(`int(): max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with the given probability (0..1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Uniformly pick one element. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick(): empty array');
    return items[this.int(0, items.length - 1)]!;
  }

  /** Pick a key from a weight table, e.g. { short: 3, long: 1 }. */
  weighted<K extends string>(weights: Readonly<Record<K, number>>): K {
    const entries = (Object.entries(weights) as [K, number][]).filter(([, w]) => w > 0);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) throw new RangeError('weighted(): no positive weights');
    let roll = this.next() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll < 0) return key;
    }
    return entries[entries.length - 1]![0];
  }
}

/** Create a fresh random seed (for starting a new match, not for gameplay rolls). */
export function createSeed(): number {
  return (Math.random() * 0x100000000) >>> 0;
}
