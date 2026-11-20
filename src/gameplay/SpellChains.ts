/**
 * Spatial spell chains (Typel prototype, D-085). Pure and deterministic.
 *
 * EXPLORATORY: D-079 (Fire Combustion Chain) and D-080 (Shock seeded chain)
 * are approved *directions* only. Every number here is a provisional
 * prototype value for owner playtesting.
 */
import type { SeededRandom } from '../core/Random';

export interface ChainWord {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export interface ChainLink {
  from: number;
  to: number;
  depth: number;
}

export const SHOCK_TUNING = {
  /** Field pixels an arc can jump. */
  radius: 300,
  /** Chance at point-blank range, falling linearly to `farChance` at the radius. */
  nearChance: 0.9,
  farChance: 0.2,
  /** Each generation of the chain is this much less likely to jump again. */
  depthDecay: 0.82,
  /** Hard safety ceiling on words struck by one cast. */
  maxWords: 10,
} as const;

export const FIRE_TUNING = {
  /** Words at or below this share of the field ignite at once (the emergency core). */
  igniteFrom: 0.5,
  /** Flames leap to any word within this many field pixels of a burning one. */
  spread: 210,
  /** Words above this share of the field never burn (fresh spawns are spared, D-057). */
  spareAbove: 0.2,
  /** Base-point bonus per generation of spread: depth 2 pays ×1.5. */
  depthBonus: 0.25,
} as const;

const dist = (a: ChainWord, b: ChainWord) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Shock: the first strike is guaranteed (the most urgent word); from every
 * struck word, each nearby unstruck word gets one seeded roll, likelier when
 * close and in early generations. Dense fields chain further.
 */
export function shockChain<W extends ChainWord>(
  words: readonly W[],
  first: W,
  rng: SeededRandom,
  t: { -readonly [K in keyof typeof SHOCK_TUNING]: number } = SHOCK_TUNING,
): { struck: W[]; links: ChainLink[] } {
  const struck: W[] = [first];
  const links: ChainLink[] = [];
  const hit = new Set<number>([first.id]);
  const depthOf = new Map<number, number>([[first.id, 0]]);
  for (let i = 0; i < struck.length && struck.length < t.maxWords; i++) {
    const src = struck[i]!;
    const depth = depthOf.get(src.id)!;
    const near = words
      .filter((w) => !hit.has(w.id) && dist(src, w) <= t.radius)
      .sort((a, b) => dist(src, a) - dist(src, b) || a.id - b.id);
    for (const w of near) {
      if (struck.length >= t.maxWords) break;
      const closeness = 1 - dist(src, w) / t.radius;
      const p = (t.farChance + (t.nearChance - t.farChance) * closeness) * Math.pow(t.depthDecay, depth);
      if (rng.next() < p) {
        hit.add(w.id);
        depthOf.set(w.id, depth + 1);
        struck.push(w);
        links.push({ from: src.id, to: w.id, depth: depth + 1 });
      }
    }
  }
  return { struck, links };
}

/**
 * Fire Combustion Chain: everything in the lower field ignites; flames then
 * leap to any word within reach, generation by generation. Spatial, never
 * random. Words still in the top fifth are never burned.
 */
export function combustionChain<W extends ChainWord>(
  words: readonly W[],
  fieldHeight: number,
  t: { -readonly [K in keyof typeof FIRE_TUNING]: number } = FIRE_TUNING,
): { burned: { word: W; depth: number }[]; links: ChainLink[] } {
  const eligible = words.filter((w) => w.y >= fieldHeight * t.spareAbove);
  const burned: { word: W; depth: number }[] = eligible
    .filter((w) => w.y >= fieldHeight * t.igniteFrom)
    .sort((a, b) => b.y - a.y || a.id - b.id)
    .map((word) => ({ word, depth: 0 }));
  const lit = new Set(burned.map((b) => b.word.id));
  const links: ChainLink[] = [];
  for (let i = 0; i < burned.length; i++) {
    const src = burned[i]!;
    const next = eligible
      .filter((w) => !lit.has(w.id) && dist(src.word, w) <= t.spread)
      .sort((a, b) => dist(src.word, a) - dist(src.word, b) || a.id - b.id);
    for (const w of next) {
      lit.add(w.id);
      burned.push({ word: w, depth: src.depth + 1 });
      links.push({ from: src.word.id, to: w.id, depth: src.depth + 1 });
    }
  }
  return { burned, links };
}
