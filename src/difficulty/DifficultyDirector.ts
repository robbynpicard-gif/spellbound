import { SeededRandom } from '../core/Random';

/**
 * Shared Apprenticeship Difficulty Director (D-097, prototype).
 *
 * One pure, deterministic module decides *what kind* of word comes next:
 * how long it is and how long it takes to reach the Ward. Every
 * apprenticeship uses the same language. What changes is:
 *
 *   Layer 1  the apprenticeship floor, which rises slowly with `a` (0 = first
 *            apprenticeship, 1 = the last), independent of how many levels or
 *            apprenticeships exist;
 *   Layer 2  the pressure arc inside an encounter: a convex
 *            ("exponential-feeling") rise with swells at surges, recovery dips
 *            after them, and a bounded climax;
 *   Layer 3  a JOINT length × fall-speed distribution: a 3 × 3 grid of
 *            (short | medium | long) × (slow | medium | fast) cells whose
 *            weights move from an opening mix to a peak mix as pressure rises.
 *            All four corner quadrants are possible from the first lesson,
 *            but not equally likely; short/slow relief never disappears;
 *   D-098    lengths live in a DOMINANT, SOFTLY BOUNDED window per
 *            apprenticeship (Slow ≈ 3–6 letters → Harvest ≈ 6+), with rare
 *            outliers above and below it. "Short / medium / long" mean the
 *            lower, middle and upper part of that window. No hard gates: a
 *            separate tail draw can always produce a word outside it;
 *   Layer 4  supporting levers (spawn interval, density) scaled from the
 *            classic level so letter arrival stays comparable.
 *
 * What it deliberately does NOT read: the player's WPM, accuracy, errors,
 * Ward or score, or the words on the field. The sequence depends only on the
 * seed, the encounter spec and encounter progress. There is no hidden
 * skill adaptation (owner has not approved any).
 *
 * The director never touches spells, scoring, Rush, the catch loop or any
 * word already on the field. It only plans new spawns; the engine applies
 * the plan and every spell keeps acting on authoritative world state.
 *
 * EVERY number in DIRECTOR_TUNING is EXPERIMENTAL. It is a starting point for
 * owner playtesting, not approved balance.
 */

export type DirectorMode = 'normal' | 'hardcore';
export type EncounterKind = 'level' | 'boss' | 'endless';
export const LENGTH_BANDS = ['short', 'medium', 'long'] as const;
export const SPEED_BANDS = ['slow', 'medium', 'fast'] as const;
export type LengthBand = (typeof LENGTH_BANDS)[number];
export type SpeedBand = (typeof SPEED_BANDS)[number];
/** Rows: length band (short, medium, long). Columns: speed band (slow, medium, fast). */
export type Mix = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
type Range = readonly [number, number];

/** The serializable description of one encounter. Lives on DifficultyConfig.director. */
export interface DirectorSpec {
  version: 1;
  mode: DirectorMode;
  /** Normalized apprenticeship progression a ∈ [0, 1]: first apprenticeship 0, last 1. */
  apprenticeship: number;
  /** Where this encounter sits in its apprenticeship: first level 0, last level / boss 1. */
  arcPosition: number;
  kind: EncounterKind;
  /** Average length of the classic level this replaces. Keeps letter arrival rate comparable. */
  referenceLength: number;
  /** Surge points (0–1 of the encounter) where pressure swells, then dips for recovery. */
  surges: readonly number[];
}

export interface DirectorContext {
  /** Encounter progress 0–1: share of the quota, or of the boss timer. */
  progress: number;
  /** Endless only: seconds since Endless began. */
  endlessSeconds?: number;
  /** An opening word placed partway down the field: never drawn from the fast band. */
  opening?: boolean;
}

export interface SpawnPlan {
  spawnIndex: number;
  length: number;
  /** Seconds a word spawned at the top of the field takes to reach the Ward (time-to-Ward). */
  fallSeconds: number;
  lengthBand: LengthBand;
  speedBand: SpeedBand;
  pressure: number;
  /** Why the sampled cell was changed, if it was. */
  adjusted: null | 'spike-spacing' | 'relief' | 'opening';
  /** D-098: a rare word outside the apprenticeship's dominant length window. */
  outlier: null | 'below' | 'above';
}

/** D-098: the apprenticeship's dominant, softly bounded word-length window (fractional bounds). */
export interface LengthWindow {
  lo: number;
  hi: number;
  /** The window as whole letters, for display and tests. */
  dominant: Range;
  /** Chance a word falls above / below the window right now. */
  above: number;
  below: number;
}

export interface Envelope {
  pressure: number;
  floor: number;
  ceiling: number;
  mix: Mix;
  lengthWindow: LengthWindow;
  /** Fall seconds per band, [slowest, fastest]. */
  speedBands: Record<SpeedBand, Range>;
  expectedLength: number;
  /** Multiplier for the classic spawn interval (supporting lever). */
  spawnScale: number;
  /** Representative fall time (the medium band's midpoint). */
  referenceFallSeconds: number;
  /** Endless only: bounded speed overdrive (1 = none). */
  overdrive: number;
}

export interface DirectorTuning {
  /** Layer 1: floor(a) = from + (to − from) · smoothstep(a). */
  floor: Record<DirectorMode, Range>;
  /** Pressure headroom above an encounter's base: ceiling = base + span. */
  span: Record<DirectorMode, number>;
  /** Within one apprenticeship, the last level starts this much higher than the first. */
  levelLift: number;
  /** Layer 2 convexity: rise(p; k) = (e^{kp} − 1) / (e^k − 1). */
  levelK: number;
  bossK: number;
  bossCeilingBonus: number;
  /** Pressure bump while a surge runs, and the recovery dip after it. */
  swell: { height: number; offset: number; width: number };
  recovery: { depth: number; offset: number; width: number; breathers: readonly number[] };
  /** Endless: repeated 60 s arcs on a saturating floor; speed overdrive is capped. */
  endless: { periodSeconds: number; startShare: number; growthShare: number; growthLaps: number; waveAmplitude: number; overdriveMax: number; overdriveLaps: number };
  /** Layer 3: joint mix at pressure 0 and pressure 1. Rows short/medium/long, columns slow/medium/fast. */
  openingMix: Mix;
  peakMix: Mix;
  /** Short/slow never drops below this share (recovery and Rush flow preservation). */
  reliefReserve: number;
  /** A short/slow word is guaranteed at least once in this many spawns. */
  reliefEvery: number;
  /** Minimum spawns between two long/fast spikes: first apprenticeship → last. */
  spikeGap: Range;
  /**
   * D-098 dominant length windows (fractional [lo, hi]) at the first
   * apprenticeship (Slow), at Harvest, and at the last (the Grand Wizard).
   * In between they move smoothly. `levelDrift`: share of one apprenticeship
   * step the window drifts from level 1 to the boss. `edge`: letters over
   * which a window edge fades. `bandSpread`: how much the short / medium /
   * long parts of the window overlap.
   */
  lengths: {
    start: Range; harvest: Range; end: Range; harvestAt: number; levelDrift: number; edge: number; bandSpread: number;
    /** Chance of a word above the window: [at pressure 0, at pressure 1], at Slow and at Harvest+. */
    above: { start: Range; harvest: Range };
    /** Chance of a shorter relief word below the window, at Slow and at Harvest+. */
    below: Range;
    /** Each further letter outside the window is this much less likely. */
    tailDecay: number;
    /** Dictionary lengths the director may use at all. */
    library: Range;
  };
  /** Within the window, pressure tilts toward the longer end by this much. */
  lengthTilt: number;
  /** Fall seconds per speed band at a = 0 and a = 1 (Normal). Each band is [slowest, fastest]. */
  speeds: { start: Record<SpeedBand, Range>; end: Record<SpeedBand, Range> };
  hardcoreSpeedScale: number;
  /** Within a band, pressure tilts toward the faster end by this much. */
  speedTilt: number;
  /** Supporting lever: spawn interval × lerp(from, to, pressure). */
  density: Range;
  /**
   * How far the spawn interval stretches when the director's words are longer
   * than the classic level's: 1 keeps letters per minute equal to classic
   * (longer gaps, longer levels), 0 keeps words per minute equal (more letters
   * to type). Quotas are never changed.
   */
  letterRateMatch: number;
}

/** EXPERIMENTAL starting values for playtesting. None of these are approved balance. */
export const DIRECTOR_TUNING: DirectorTuning = {
  floor: { normal: [0, 0.5], hardcore: [0.15, 0.65] },
  span: { normal: 0.5, hardcore: 0.45 },
  levelLift: 0.12,
  levelK: 2.6,
  bossK: 2.0,
  bossCeilingBonus: 0.1,
  swell: { height: 0.12, offset: 0.04, width: 0.05 },
  recovery: { depth: 0.45, offset: 0.13, width: 0.06, breathers: [0.5] },
  endless: { periodSeconds: 60, startShare: 0.6, growthShare: 0.6, growthLaps: 3, waveAmplitude: 0.1, overdriveMax: 0.18, overdriveLaps: 4 },
  openingMix: [
    [0.36, 0.18, 0.09],
    [0.13, 0.08, 0.03],
    [0.07, 0.04, 0.02],
  ],
  peakMix: [
    [0.1, 0.08, 0.12],
    [0.07, 0.11, 0.13],
    [0.07, 0.12, 0.2],
  ],
  reliefReserve: 0.1,
  reliefEvery: 8,
  spikeGap: [6, 2],
  lengths: {
    start: [3, 6], harvest: [6, 9], end: [6, 10], harvestAt: 7 / 8, levelDrift: 0.5, edge: 1.5, bandSpread: 0.35,
    above: { start: [0.003, 0.02], harvest: [0.03, 0.06] },
    below: [0.01, 0.07],
    tailDecay: 0.3,
    library: [2, 12],
  },
  lengthTilt: 1,
  speeds: {
    start: { slow: [19, 16], medium: [15, 12], fast: [11, 8.5] },
    end: { slow: [18, 14.5], medium: [13.5, 10.5], fast: [9.5, 7] },
  },
  hardcoreSpeedScale: 0.9,
  speedTilt: 1,
  density: [1.08, 0.92],
  letterRateMatch: 0.6,
};

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** Normalized convex rise: 0 at p = 0, 1 at p = 1, steeper toward the end. */
export function convexRise(p: number, k: number): number {
  const t = clamp01(p);
  return k <= 0 ? t : (Math.exp(k * t) - 1) / (Math.exp(k) - 1);
}
const bump = (x: number, centre: number, width: number) => Math.exp(-(((x - centre) / width) ** 2));

/** Layer 1: the apprenticeship floor. Monotonic, slow, independent of level counts. */
export function floorAt(spec: Pick<DirectorSpec, 'mode' | 'apprenticeship'>, t: DirectorTuning = DIRECTOR_TUNING): number {
  const [from, to] = t.floor[spec.mode];
  return lerp(from, to, smoothstep(spec.apprenticeship));
}

/** Starting pressure of one encounter: the floor, lifted slightly by its place in the apprenticeship. */
export function encounterBase(spec: Pick<DirectorSpec, 'mode' | 'apprenticeship' | 'arcPosition'>, t: DirectorTuning = DIRECTOR_TUNING): number {
  return clamp01(floorAt(spec, t) + t.levelLift * clamp01(spec.arcPosition));
}

export function encounterCeiling(spec: Pick<DirectorSpec, 'mode' | 'apprenticeship' | 'arcPosition' | 'kind'>, t: DirectorTuning = DIRECTOR_TUNING): number {
  return clamp01(encounterBase(spec, t) + t.span[spec.mode] + (spec.kind === 'boss' ? t.bossCeilingBonus : 0));
}

/** Layer 2: shape of a level or boss arc, 0–1. Convex rise, swells at surges, recovery after them. */
export function arcShape(spec: Pick<DirectorSpec, 'kind' | 'surges'>, progress: number, t: DirectorTuning = DIRECTOR_TUNING): number {
  const p = clamp01(progress);
  const rise = convexRise(p, spec.kind === 'boss' ? t.bossK : t.levelK);
  let swell = 0;
  let dip = 0;
  for (const at of spec.surges) {
    swell += t.swell.height * bump(p, at + t.swell.offset, t.swell.width);
    dip += t.recovery.depth * bump(p, at + t.recovery.offset, t.recovery.width);
  }
  if (spec.surges.length === 0) for (const at of t.recovery.breathers) dip += 0.5 * t.recovery.depth * bump(p, at, t.recovery.width);
  // A dip takes away a share of what the arc has built (never below zero).
  return clamp01(rise + swell - dip * Math.max(rise, 0.25));
}

/** Endless: a deterministic 60 s build / surge / relief / settle wave on a saturating floor. */
function endlessWave(phase: number): number {
  if (phase < 1 / 3) return phase * 3;
  if (phase < 32 / 60) return 1;
  if (phase < 46 / 60) return -1;
  return 0;
}

export function endlessState(spec: DirectorSpec, seconds: number, t: DirectorTuning = DIRECTOR_TUNING): { pressure: number; overdrive: number } {
  const e = t.endless;
  const s = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const laps = s / e.periodSeconds;
  const base = encounterBase({ ...spec, arcPosition: 1 }, t);
  const start = clamp01(base + t.span[spec.mode] * e.startShare);
  const growth = (1 - start) * e.growthShare * (1 - Math.exp(-laps / e.growthLaps));
  const wave = e.waveAmplitude * endlessWave((s % e.periodSeconds) / e.periodSeconds);
  return {
    pressure: clamp01(start + growth + wave),
    overdrive: 1 + e.overdriveMax * (1 - Math.exp(-laps / e.overdriveLaps)),
  };
}

/** Current pressure, 0–1, for an encounter at a given moment. */
export function pressureAt(spec: DirectorSpec, ctx: DirectorContext, t: DirectorTuning = DIRECTOR_TUNING): number {
  if (spec.kind === 'endless') return endlessState(spec, ctx.endlessSeconds ?? 0, t).pressure;
  const base = encounterBase(spec, t);
  return clamp01(base + (encounterCeiling(spec, t) - base) * arcShape(spec, ctx.progress, t));
}

function normalize(cells: number[][]): Mix {
  const total = cells.flat().reduce((s, v) => s + v, 0);
  return cells.map((row) => row.map((v) => (total > 0 ? v / total : 0))) as unknown as Mix;
}

/** Layer 3: the joint length × speed mix at a pressure, with the relief reserve enforced. */
export function mixAt(pressure: number, t: DirectorTuning = DIRECTOR_TUNING): Mix {
  const p = clamp01(pressure);
  const cells = t.openingMix.map((row, i) => row.map((v, j) => lerp(v, t.peakMix[i]![j]!, p)));
  const mix = normalize(cells) as unknown as number[][];
  if (mix[0]![0]! < t.reliefReserve) {
    const others = 1 - mix[0]![0]!;
    const scale = (1 - t.reliefReserve) / others;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) mix[i]![j]! *= scale;
    mix[0]![0] = t.reliefReserve;
  }
  return mix as unknown as Mix;
}

/** Where the window sits on the Slow → Harvest → Grand Wizard path (0 = Slow, 1 = Harvest, 2 = last). */
function windowProgress(a: number, arcPosition: number, t: DirectorTuning): number {
  const L = t.lengths;
  const step = 1 / 8; // one apprenticeship of nine
  const x = clamp01(a + clamp01(arcPosition) * step * L.levelDrift);
  if (x <= L.harvestAt) return x / L.harvestAt;
  return 1 + (x - L.harvestAt) / Math.max(1e-9, 1 - L.harvestAt);
}

/** D-098: the dominant length window for an encounter at a pressure. */
export function lengthWindowAt(spec: Pick<DirectorSpec, 'apprenticeship' | 'arcPosition'>, pressure = 0, t: DirectorTuning = DIRECTOR_TUNING): LengthWindow {
  const L = t.lengths;
  const w = windowProgress(spec.apprenticeship, spec.arcPosition, t);
  const s = smoothstep(Math.min(1, w));
  const [lo, hi] = w <= 1
    ? [lerp(L.start[0], L.harvest[0], s), lerp(L.start[1], L.harvest[1], s)]
    : [lerp(L.harvest[0], L.end[0], w - 1), lerp(L.harvest[1], L.end[1], w - 1)];
  const p = clamp01(pressure);
  const above = lerp(lerp(L.above.start[0], L.above.harvest[0], s), lerp(L.above.start[1], L.above.harvest[1], s), p);
  return { lo, hi, dominant: [Math.round(lo), Math.round(hi)], above, below: lerp(L.below[0], L.below[1], s) };
}

/** Soft window membership of a length: 1 well inside, fading to 0 over `edge` letters past each bound. */
function membership(len: number, win: LengthWindow, t: DirectorTuning): number {
  const e = t.lengths.edge;
  return smoothstep((len - (win.lo - 1)) / e) * smoothstep((win.hi + 1 - len) / e);
}

const BAND_PEAK: Record<LengthBand, number> = { short: 0, medium: 0.5, long: 1 };

/** Length weights for one band of the window: library availability (√count) × membership × band affinity, tilted longer with pressure. */
function lengthWeights(band: LengthBand, win: LengthWindow, pressure: number, counts: Readonly<Record<number, number>>, t: DirectorTuning): [number, number][] {
  const out: [number, number][] = [];
  const width = Math.max(1, win.hi - win.lo);
  for (let len = t.lengths.library[0]; len <= t.lengths.library[1]; len++) {
    const n = counts[len] ?? 0;
    if (n <= 0) continue;
    const m = membership(len, win, t);
    if (m <= 0.001) continue;
    const pos = (len - win.lo) / width;
    const affinity = Math.exp(-(((pos - BAND_PEAK[band]) / t.lengths.bandSpread) ** 2));
    const w = Math.sqrt(n) * m * affinity * Math.exp(t.lengthTilt * clamp01(pressure) * clamp01(pos));
    if (w > 1e-6) out.push([len, w]);
  }
  return out;
}

/** Outlier lengths just outside the window, each further letter rarer by `tailDecay`. */
function tailWeights(side: 'above' | 'below', win: LengthWindow, counts: Readonly<Record<number, number>>, t: DirectorTuning): [number, number][] {
  const out: [number, number][] = [];
  const [minLen, maxLen] = t.lengths.library;
  for (let k = 1; k <= 3; k++) {
    const len = side === 'above' ? win.dominant[1] + k : win.dominant[0] - k;
    if (len < minLen || len > maxLen || (counts[len] ?? 0) <= 0) continue;
    out.push([len, Math.sqrt(counts[len]!) * t.lengths.tailDecay ** (k - 1)]);
  }
  return out;
}

function pickWeighted(weights: [number, number][], r: number, fallback: number): number {
  const total = weights.reduce((sum, [, v]) => sum + v, 0);
  if (total <= 0) return fallback;
  let roll = r * total;
  for (const [len, v] of weights) {
    roll -= v;
    if (roll < 0) return len;
  }
  return weights[weights.length - 1]![0];
}

function expectedOf(weights: [number, number][], fallback: number): number {
  const total = weights.reduce((sum, [, v]) => sum + v, 0);
  return total > 0 ? weights.reduce((sum, [len, v]) => sum + len * v, 0) / total : fallback;
}

export function speedBandsAt(spec: Pick<DirectorSpec, 'mode' | 'apprenticeship'>, overdrive = 1, t: DirectorTuning = DIRECTOR_TUNING): Record<SpeedBand, Range> {
  const a = smoothstep(spec.apprenticeship);
  const scale = (spec.mode === 'hardcore' ? t.hardcoreSpeedScale : 1) / Math.max(1, overdrive);
  const band = (b: SpeedBand): Range => {
    const s = t.speeds.start[b];
    const e = t.speeds.end[b];
    return [lerp(s[0], e[0], a) * scale, lerp(s[1], e[1], a) * scale];
  };
  return { slow: band('slow'), medium: band('medium'), fast: band('fast') };
}

export function validateDirectorSpec(raw: unknown): string[] {
  const problems: string[] = [];
  const r = raw as Record<string, unknown> | null;
  if (typeof r !== 'object' || r === null) return ['director must be an object'];
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (r.version !== 1) problems.push('director.version must be 1');
  if (r.mode !== 'normal' && r.mode !== 'hardcore') problems.push('director.mode must be normal or hardcore');
  if (r.kind !== 'level' && r.kind !== 'boss' && r.kind !== 'endless') problems.push('director.kind must be level, boss or endless');
  for (const k of ['apprenticeship', 'arcPosition'] as const)
    if (!num(r[k]) || (r[k] as number) < 0 || (r[k] as number) > 1) problems.push(`director.${k} must be in [0, 1]`);
  if (!num(r.referenceLength) || (r.referenceLength as number) <= 0) problems.push('director.referenceLength must be positive');
  if (!Array.isArray(r.surges) || r.surges.some((s) => !num(s) || s < 0 || s > 1)) problems.push('director.surges must be numbers in [0, 1]');
  return problems;
}

/**
 * The stateful sampler for one engine. Its only state is its own seeded
 * random stream and a short history of what it has planned (for spike
 * spacing and guaranteed relief). It consumes exactly four random draws per
 * plan, so replays line up draw for draw.
 */
export class DifficultyDirector {
  private readonly rng: SeededRandom;
  private spawnIndex = 0;
  private lastSpike = -Infinity;
  private sinceRelief = 0;

  constructor(
    private spec: DirectorSpec,
    seed: number,
    /** Words available per length (after the level's complexity filter). */
    private readonly lengthCounts: Readonly<Record<number, number>>,
    private readonly tuning: DirectorTuning = DIRECTOR_TUNING,
  ) {
    const problems = validateDirectorSpec(spec);
    if (problems.length) throw new Error(`Invalid director spec: ${problems.join('; ')}`);
    this.rng = new SeededRandom((seed ^ 0xd1ec7041) >>> 0);
  }

  get currentSpec(): DirectorSpec {
    return this.spec;
  }

  /** Boss → Endless continues the same stream and history with the new encounter spec. */
  setSpec(spec: DirectorSpec): void {
    const problems = validateDirectorSpec(spec);
    if (problems.length) throw new Error(`Invalid director spec: ${problems.join('; ')}`);
    this.spec = spec;
  }

  /** Pure: the full envelope at a moment. Never consumes randomness. */
  envelope(ctx: DirectorContext): Envelope {
    const t = this.tuning;
    const spec = this.spec;
    const endless = spec.kind === 'endless' ? endlessState(spec, ctx.endlessSeconds ?? 0, t) : null;
    const pressure = endless ? endless.pressure : pressureAt(spec, ctx, t);
    const overdrive = endless?.overdrive ?? 1;
    const mix = mixAt(pressure, t);
    const lengthWindow = lengthWindowAt(spec, pressure, t);
    const speedBands = speedBandsAt(spec, overdrive, t);
    const mid = (lengthWindow.lo + lengthWindow.hi) / 2;
    let expectedLength = 0;
    LENGTH_BANDS.forEach((band, i) => {
      const share = mix[i]!.reduce((s, v) => s + v, 0);
      expectedLength += share * expectedOf(lengthWeights(band, lengthWindow, pressure, this.lengthCounts, t), mid);
    });
    const floor = spec.kind === 'endless' ? encounterBase({ ...spec, arcPosition: 1 }, t) : encounterBase(spec, t);
    const ceiling = spec.kind === 'endless' ? 1 : encounterCeiling(spec, t);
    const [d0, d1] = t.density;
    return {
      pressure, floor, ceiling, mix, lengthWindow, speedBands, expectedLength,
      spawnScale: Math.pow(expectedLength / spec.referenceLength, t.letterRateMatch) * lerp(d0, d1, pressure),
      referenceFallSeconds: (speedBands.medium[0] + speedBands.medium[1]) / 2,
      overdrive,
    };
  }

  /** Plan the next spawn. Exactly five draws, always in the same order. */
  next(ctx: DirectorContext): SpawnPlan {
    const t = this.tuning;
    const env = this.envelope(ctx);
    const rCell = this.rng.next();
    const rLength = this.rng.next();
    const rSpeed = this.rng.next();
    const rAdjust = this.rng.next();
    const rTail = this.rng.next();

    const weights = env.mix.map((row) => [...row]);
    let adjusted: SpawnPlan['adjusted'] = null;
    if (ctx.opening) {
      for (const row of weights) row[2] = 0;
      adjusted = 'opening';
    }
    const total = weights.flat().reduce((s, v) => s + v, 0);
    let roll = rCell * total;
    let li = 0;
    let si = 0;
    outer: for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        roll -= weights[i]![j]!;
        if (roll < 0) {
          li = i;
          si = j;
          break outer;
        }
      }
    if (roll >= 0) {
      li = 0;
      si = 0;
    }

    const gap = Math.round(lerp(t.spikeGap[0], t.spikeGap[1], clamp01(this.spec.apprenticeship)));
    if (li === 2 && si === 2 && this.spawnIndex - this.lastSpike <= gap) {
      // Too soon after the last spike: keep one lever, drop the other.
      if (rAdjust < 0.5) si = 1;
      else li = 1;
      adjusted = 'spike-spacing';
    }
    if (!(li === 0 && si === 0) && this.sinceRelief >= t.reliefEvery - 1) {
      li = 0;
      si = 0;
      adjusted = 'relief';
    }

    const lengthBand = LENGTH_BANDS[li]!;
    const speedBand = SPEED_BANDS[si]!;
    const win = env.lengthWindow;
    // D-098 tails: a rare word above the window (any cell), or a shorter
    // relief word below it (short cells only, scaled so the overall share
    // matches `below`). Openings never get an upper outlier.
    const shortShare = Math.max(1e-6, env.mix[0].reduce((sum, v) => sum + v, 0));
    const belowChance = Math.min(1 - win.above, win.below / shortShare);
    let outlier: SpawnPlan['outlier'] = null;
    // An outlier's length roll is rTail rescaled within its slice (uniform).
    let tailRoll = 0;
    if (!ctx.opening && rTail < win.above) {
      outlier = 'above';
      tailRoll = rTail / win.above;
    } else if (li === 0 && rTail >= win.above && rTail < win.above + belowChance) {
      outlier = 'below';
      tailRoll = (rTail - win.above) / belowChance;
    }
    const tail = outlier ? tailWeights(outlier, win, this.lengthCounts, t) : [];
    const length = tail.length > 0
      ? pickWeighted(tail, tailRoll, win.dominant[outlier === 'above' ? 1 : 0])
      : pickWeighted(lengthWeights(lengthBand, win, env.pressure, this.lengthCounts, t), rLength, Math.round((win.lo + win.hi) / 2));
    if (tail.length === 0) outlier = null;
    const [slowest, fastest] = env.speedBands[speedBand];
    const u = Math.pow(rSpeed, 1 / (1 + t.speedTilt * env.pressure));
    const fallSeconds = lerp(slowest, fastest, u);

    const plan: SpawnPlan = { spawnIndex: this.spawnIndex, length, fallSeconds, lengthBand, speedBand, pressure: env.pressure, adjusted, outlier };
    if (li === 2 && si === 2) this.lastSpike = this.spawnIndex;
    this.sinceRelief = li === 0 && si === 0 ? 0 : this.sinceRelief + 1;
    this.spawnIndex++;
    return plan;
  }
}
