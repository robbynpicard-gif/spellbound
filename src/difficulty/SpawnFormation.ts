/**
 * Arcane Trials spawn formations (D-109 behaviours 4 and 5; D-120 prototype).
 *
 * - **Alternating Edges:** pressure sweeps between the left and right of the
 *   field in recognizable runs of several scrolls, then switches side.
 * - **Staggered Vertical Pressure:** some scrolls enter partway down the
 *   field (never fast), so threats arrive at several heights at once instead
 *   of one falling front.
 *
 * Its own seeded stream: it never consumes the engine's, the Director's or
 * the lane search's draws, so encounters without a formation are unchanged.
 * Phases change between scrolls, never moving a scroll already on screen.
 * EXPERIMENTAL values (playtesting decides them).
 */
import { SeededRandom } from '../core/Random';

export interface FormationSpec {
  kind: 'crosswind';
  /** Share of scrolls that follow the current side (the rest go anywhere: controlled randomness). */
  edgeShare: number;
  /** Width of one side's band, as a share of the usable width (0.5 = exactly half). */
  band: number;
  /** Scrolls per side before it switches (inclusive range). */
  run: readonly [number, number];
  /** Chance a scroll enters partway down, and how far (share of the field height). */
  stagger: { chance: number; depth: readonly [number, number] };
}

export interface FormationStep {
  /** Which band to place the scroll in; null = anywhere. */
  side: 'left' | 'right' | null;
  /** Start height as a share of the field (0 = top). */
  startShare: number;
  /** The side just changed with this scroll (for a telegraph). */
  switched: boolean;
}

export class SpawnFormation {
  private readonly rng: SeededRandom;
  private side: 'left' | 'right';
  private left: number;

  constructor(private readonly spec: FormationSpec, seed: number) {
    this.rng = new SeededRandom(seed >>> 0);
    this.side = this.rng.next() < 0.5 ? 'left' : 'right';
    this.left = this.runLength();
  }

  private runLength(): number {
    const [a, b] = this.spec.run;
    return a + Math.floor(this.rng.next() * (b - a + 1));
  }

  /** Exactly four draws per scroll, always in the same order (replay-stable). */
  next(): FormationStep {
    const rFollow = this.rng.next();
    const rStagger = this.rng.next();
    const rDepth = this.rng.next();
    const rRun = this.rng.next();
    let switched = false;
    if (this.left <= 0) {
      this.side = this.side === 'left' ? 'right' : 'left';
      const [a, b] = this.spec.run;
      this.left = a + Math.floor(rRun * (b - a + 1));
      switched = true;
    }
    this.left--;
    const side = rFollow < this.spec.edgeShare ? this.side : null;
    const { chance, depth } = this.spec.stagger;
    const startShare = rStagger < chance ? depth[0] + (depth[1] - depth[0]) * rDepth : 0;
    return { side, startShare, switched };
  }

  /** Restrict [minX, maxX] to a side's band. */
  static band(side: 'left' | 'right' | null, minX: number, maxX: number, share: number): [number, number] {
    if (!side || maxX <= minX) return [minX, maxX];
    const w = (maxX - minX) * share;
    return side === 'left' ? [minX, minX + w] : [maxX - w, maxX];
  }
}
