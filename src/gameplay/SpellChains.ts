/**
 * Spatial spell chains (TypeL prototype, D-085). Pure and deterministic.
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

/**
 * SHOCK (D-115, D-118): one guaranteed strike on the most urgent scroll,
 * guaranteed conduction through its nearby cluster, then seeded jumps to other
 * clusters, each less likely than the last, with no fixed cap on the chain.
 * EXPERIMENTAL values.
 */
export const SHOCK_TUNING = {
  /** Field pixels within which lightning always conducts (one cluster). */
  conduct: 170,
  /** Chance of the first jump to another cluster. */
  jumpChance: 0.5,
  /** Each further jump is this much less likely (0.5: 50%, 25%, 12.5% …). Never zero, so no fixed cap. */
  jumpDecay: 0.5,
  /** A jump reaches the nearest unstruck scroll within this distance of any struck one. */
  jumpReach: 700,
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

/** Conducts from `seeds` through every scroll within `radius` of a struck one (guaranteed, spatial). */
function conduct<W extends ChainWord>(words: readonly W[], struck: W[], hit: Set<number>, links: ChainLink[], depthOf: Map<number, number>, from: number, radius: number): void {
  for (let i = from; i < struck.length; i++) {
    const src = struck[i]!;
    const near = words
      .filter((w) => !hit.has(w.id) && dist(src, w) <= radius)
      .sort((a, b) => dist(src, a) - dist(src, b) || a.id - b.id);
    for (const w of near) {
      const depth = depthOf.get(src.id)! + 1;
      hit.add(w.id);
      depthOf.set(w.id, depth);
      struck.push(w);
      links.push({ from: src.id, to: w.id, depth });
    }
  }
}

/**
 * Shock chain: `first` is always struck and its cluster always conducts. Then
 * each jump to the nearest other cluster succeeds with jumpChance × decay^k.
 * Seeded, so a replay strikes the same way.
 */
export function shockChain<W extends ChainWord>(
  words: readonly W[],
  first: W,
  rng: SeededRandom,
  t: { -readonly [K in keyof typeof SHOCK_TUNING]: number } = SHOCK_TUNING,
): { struck: W[]; links: ChainLink[]; jumps: number } {
  const struck: W[] = [first];
  const links: ChainLink[] = [];
  const hit = new Set<number>([first.id]);
  const depthOf = new Map<number, number>([[first.id, 0]]);
  conduct(words, struck, hit, links, depthOf, 0, t.conduct);
  let jumps = 0;
  while (struck.length < words.length && rng.next() < t.jumpChance * Math.pow(t.jumpDecay, jumps)) {
    let best: { src: W; w: W; d: number } | null = null;
    for (const src of struck)
      for (const w of words) {
        if (hit.has(w.id)) continue;
        const d = dist(src, w);
        if (d <= t.jumpReach && (!best || d < best.d || (d === best.d && w.id < best.w.id))) best = { src, w, d };
      }
    if (!best) break;
    jumps++;
    const depth = depthOf.get(best.src.id)! + 1;
    hit.add(best.w.id);
    depthOf.set(best.w.id, depth);
    const from = struck.length;
    struck.push(best.w);
    links.push({ from: best.src.id, to: best.w.id, depth });
    conduct(words, struck, hit, links, depthOf, from, t.conduct);
  }
  return { struck, links, jumps };
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
