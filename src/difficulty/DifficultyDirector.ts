/**
 * Shared Apprenticeship Difficulty Director (D-097, PROTOTYPE).
 *
 * One typing-pressure language for every apprenticeship. Word LENGTH and FALL
 * SPEED are the primary levers from the first lesson, sampled *jointly* so
 * short/slow, long/slow, short/fast and long/fast words can all appear from
 * the start. Two layers set how hard things are:
 *
 *   1. A slowly rising FLOOR across the whole apprenticeship journey
 *      (`position` 0–1), shaped by smoothstep.
 *   2. A convex, exponential-feeling PRESSURE arc inside each encounter
 *      (`progress` 0–1), rise(p) = (e^{kp} − 1)/(e^k − 1), with deterministic
 *      relief windows. Endless repeats the arc in laps whose peak saturates;
 *      nothing grows without bound.
 *
 * Pressure shifts the joint length×speed distribution (towards longer and/or
 * faster, not necessarily both) and lifts speed a little. Spawn interval and
 * density are SECONDARY and follow from the same pressure.
 *
 * Pure and deterministic: no clocks, no player-skill adaptation. Every number
 * in DIRECTOR_TUNING is EXPERIMENTAL (owner calibration pending, D-097).
 */
import type { SeededRandom } from '../core/Random';

export type DirectorMode = 'normal' | 'hardcore';
export type Encounter = 'level' | 'boss' | 'endless';
export type LengthBand = 'short' | 'medium' | 'long';
export type SpeedBand = 'slow' | 'medium' | 'fast';
export const LENGTH_BANDS: readonly LengthBand[] = ['short', 'medium', 'long'];
export const SPEED_BANDS: readonly SpeedBand[] = ['slow', 'medium', 'fast'];

/** What a config asks of the director. */
export interface DirectorSettings {
  mode: DirectorMode;
  /** Normalized place in the whole apprenticeship journey: 0 = first lesson, 1 = the Grand Wizard's last stand. */
  position: number;
  encounter: Encounter;
}

type Matrix = readonly (readonly [number, number, number])[];

/**
 * EXPERIMENTAL tuning. Joint matrices are rows = length (short, medium,
 * long) × columns = speed (slow, medium, fast); each sums to 1.
 */
export const DIRECTOR_TUNING = {
  /** Pressure floor at journey start and end (smoothstep between). */
  floor: { normal: [0.08, 0.42], hardcore: [0.22, 0.58] } as Record<DirectorMode, readonly [number, number]>,
  /** How far above the floor an encounter's peak reaches. */
  span: { level: 0.55, boss: 0.65, endless: 0.55 } as Record<Encounter, number>,
  /** Convexity k of rise(p): higher = calmer opening, sharper climax. */
  riseK: { level: 3.0, boss: 3.4, endless: 2.6 } as Record<Encounter, number>,
  /** Relief windows: pressure dips back toward the floor (share of the climb removed). */
  relief: [
    { at: 0.42, width: 0.05, depth: 0.55 },
    { at: 0.74, width: 0.045, depth: 0.6 },
  ],
  /** Endless: each lap's peak climbs toward pressure 1 by this saturating factor. */
  endlessLapGrowth: 0.72,
  /** Length bands from the actual word library (2–12 letters exist; 7–10 well stocked). */
  lengths: { short: [2, 4], medium: [5, 6], long: { normal: [7, 9], hardcore: [7, 10] } } as const,
  /** Past this journey position the long band reaches one letter further. */
  longExtendAt: 0.55,
  /** Seconds to fall the whole field for each speed band, at journey start and zero pressure. */
  fallSeconds: { normal: { slow: 16, medium: 12, fast: 8.6 }, hardcore: { slow: 14, medium: 10.5, fast: 7.4 } } as Record<DirectorMode, Record<SpeedBand, number>>,
  /** Whole-journey speed lift: ×(1 + this·smoothstep(position)). */
  journeySpeedup: { normal: 0.3, hardcore: 0.32 } as Record<DirectorMode, number>,
  /** In-encounter speed lift at the arc's peak: ×(1 + this·rise·bandWeight). */
  pressureSpeedup: 0.3,
  /**
   * How much each speed band takes part in the journey and arc speed-ups. The
   * slow band barely speeds up, so genuine breathers survive to the last
   * apprenticeship; the rising floor lives in the medium and fast bands.
   */
  bandSpeedup: { slow: 0.35, medium: 0.8, fast: 1 } as Record<SpeedBand, number>,
  arcBandSpeedup: { slow: 0.5, medium: 0.85, fast: 1 } as Record<SpeedBand, number>,
  /** Endless: extra speed per lap, saturating at this. */
  endlessSpeedLift: 0.15,
  /** Per-word speed jitter inside its band (±). */
  jitter: 0.08,
  /** Hard cap: no word ever falls the field faster than this. */
  minFallSeconds: { normal: 5.0, hardcore: 4.3 } as Record<DirectorMode, number>,
  /** Joint distribution at pressure 0 (calm) and pressure 1 (peak). */
  joint: {
    calm: [
      [0.28, 0.16, 0.06],
      [0.15, 0.12, 0.04],
      [0.1, 0.06, 0.03],
    ] as Matrix,
    peak: [
      [0.12, 0.08, 0.14],
      [0.06, 0.12, 0.13],
      [0.08, 0.1, 0.17],
    ] as Matrix,
  },
  /** Relief is never removed: short+slow keeps at least this share. */
  shortSlowMin: 0.12,
  /** Fairness reference typist (characters/second) at journey start and end; reaction seconds; safety margin. */
  refCps: { normal: [3.0, 4.6], hardcore: [3.8, 5.6] } as Record<DirectorMode, readonly [number, number]>,
  reactionSeconds: 0.9,
  fairnessMargin: 1.5,
  /** Long+fast words allowed on the field at once (calm → peak). */
  maxLongFast: [1, 2] as const,
  /** Secondary lever: arrival pace in gameplay WPM across the journey, and the in-arc swing. */
  wpm: { normal: [30, 58], hardcore: [40, 72] } as Record<DirectorMode, readonly [number, number]>,
  arrival: { calm: 0.88, peak: 1.25, relief: 0.82 },
  /** Word complexity ceiling across the journey (rare letters, clusters, names); null = none. */
  complexity: { normal: [0.5, 1, 1.5, 2, null], hardcore: [1, 1.5, 2, 2.5, null] } as Record<DirectorMode, readonly (number | null)[]>,
};

export const smoothstep = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
/** Convex normalized rise: 0 at p=0, 1 at p=1, steeper as k grows. */
export const rise = (p: number, k: number) => (Math.exp(k * Math.max(0, Math.min(1, p))) - 1) / (Math.exp(k) - 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface SpawnPlan {
  length: number;
  lengthBand: LengthBand;
  speedBand: SpeedBand;
  /** Seconds this word takes to fall the whole field (time-to-Ward from the top). */
  fallSeconds: number;
  /** Absolute pressure 0–1 at the moment of spawning. */
  pressure: number;
  /** True if the fairness bound or the speed cap slowed this word. */
  clamped: boolean;
}

export interface DirectorPace {
  /** Fastest fall speed (px/s) allowed right now; spells that reset speeds use it as their cap. */
  fallSpeed: number;
  spawnInterval: number;
  maxActiveWords: number;
}

/** Field facts the director may consider for fairness (never the player's skill). */
export interface FieldFacts {
  progress: number;
  lap: number;
  longFastOnField: number;
}

export class DifficultyDirector {
  private readonly t = DIRECTOR_TUNING;
  readonly position: number;

  constructor(readonly settings: DirectorSettings, private readonly fieldHeight: number) {
    this.position = clamp01(settings.position);
  }

  /** The journey floor at this apprenticeship position. */
  get floor(): number {
    const [f0, f1] = this.t.floor[this.settings.mode];
    return lerp(f0, f1, smoothstep(this.position));
  }

  /** The encounter's peak pressure (Endless laps climb toward 1, saturating). */
  ceiling(lap = 0): number {
    const base = Math.min(1, this.floor + this.t.span[this.settings.encounter]);
    if (this.settings.encounter !== 'endless' || lap <= 0) return base;
    return base + (1 - base) * (1 - Math.pow(this.t.endlessLapGrowth, lap));
  }

  /** Share of the encounter's climb removed by relief windows at this point (0–1). */
  relief(progress: number): number {
    let r = 0;
    for (const w of this.t.relief) {
      const d = (progress - w.at) / w.width;
      r = Math.max(r, w.depth * Math.exp(-d * d));
    }
    return r;
  }

  /** In-arc climb 0–1 after relief. */
  climb(progress: number): number {
    return rise(progress, this.t.riseK[this.settings.encounter]) * (1 - this.relief(progress));
  }

  /** Absolute pressure 0–1. */
  pressure(progress: number, lap = 0): number {
    return clamp01(this.floor + (this.ceiling(lap) - this.floor) * this.climb(progress));
  }

  /** Joint length×speed weights at this pressure (rows length, columns speed). */
  joint(pressure: number): number[][] {
    const { calm, peak } = this.t.joint;
    const m = calm.map((row, i) => row.map((v, j) => lerp(v, peak[i]![j]!, clamp01(pressure))));
    if (m[0]![0]! < this.t.shortSlowMin) m[0]![0] = this.t.shortSlowMin;
    const sum = m.flat().reduce((a, b) => a + b, 0);
    return m.map((row) => row.map((v) => v / sum));
  }

  lengthRange(band: LengthBand): readonly [number, number] {
    if (band !== 'long') return this.t.lengths[band];
    const [lo, hi] = this.t.lengths.long[this.settings.mode];
    return [lo, hi + (this.position >= this.t.longExtendAt ? 1 : 0)];
  }

  get maxLength(): number {
    return this.lengthRange('long')[1];
  }

  get maxComplexity(): number | null {
    const table = this.t.complexity[this.settings.mode];
    return table[Math.min(table.length - 1, Math.floor(this.position * table.length))] ?? null;
  }

  /** Speed multiplier from the journey, the arc, and Endless laps, for one speed band. */
  speedFactor(progress: number, lap = 0, band: SpeedBand = 'fast'): number {
    const journey = 1 + this.t.journeySpeedup[this.settings.mode] * this.t.bandSpeedup[band] * smoothstep(this.position);
    const arc = 1 + this.t.pressureSpeedup * this.t.arcBandSpeedup[band] * this.climb(progress);
    const laps = this.settings.encounter === 'endless' ? 1 + this.t.endlessSpeedLift * (1 - Math.pow(this.t.endlessLapGrowth, Math.max(0, lap))) : 1;
    return journey * arc * laps;
  }

  bandSeconds(band: SpeedBand, progress: number, lap = 0): number {
    return Math.max(this.t.minFallSeconds[this.settings.mode], this.t.fallSeconds[this.settings.mode][band] / this.speedFactor(progress, lap, band));
  }

  /** Words falling the field faster than this count as "fast" for fairness and reporting. */
  fastSeconds(progress: number, lap = 0): number {
    return (this.bandSeconds('medium', progress, lap) + this.bandSeconds('fast', progress, lap)) / 2;
  }

  /** Least time a word of this length must be given (reference typist, with margin). */
  fairSeconds(length: number): number {
    const [c0, c1] = this.t.refCps[this.settings.mode];
    const cps = lerp(c0, c1, smoothstep(this.position));
    return this.t.fairnessMargin * (length / cps + this.t.reactionSeconds);
  }

  /**
   * Plan one spawn. Always draws exactly three numbers from `rng`, in a fixed
   * order (cell, length, jitter), so replays stay aligned whatever happens.
   */
  plan(facts: FieldFacts, rng: SeededRandom): SpawnPlan {
    const pressure = this.pressure(facts.progress, facts.lap);
    const r1 = rng.next();
    const r2 = rng.next();
    const r3 = rng.next();
    const m = this.joint(pressure);
    let acc = 0;
    let li = 2;
    let si = 2;
    find: for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        acc += m[i]![j]!;
        if (r1 < acc) {
          li = i;
          si = j;
          break find;
        }
      }
    // Never more long+fast words at once than the moment allows.
    const allowed = Math.round(lerp(this.t.maxLongFast[0], this.t.maxLongFast[1], pressure));
    if (li === 2 && si === 2 && facts.longFastOnField >= allowed) si = 1;
    const lengthBand = LENGTH_BANDS[li]!;
    const speedBand = SPEED_BANDS[si]!;
    const [lo, hi] = this.lengthRange(lengthBand);
    // lengths lean toward the middle of their band: average r2 with a second
    // uniform derived from it (no extra draw), giving a triangular spread
    const tri = (r2 + ((r2 * 7919) % 1)) / 2;
    const length = Math.min(hi, lo + Math.floor(tri * (hi - lo + 1)));
    let fall = this.bandSeconds(speedBand, facts.progress, facts.lap) * (1 + (r3 * 2 - 1) * this.t.jitter);
    const floorSeconds = Math.max(this.t.minFallSeconds[this.settings.mode], this.fairSeconds(length));
    const clamped = fall < floorSeconds;
    if (clamped) fall = floorSeconds;
    return { length, lengthBand, speedBand, fallSeconds: fall, pressure, clamped };
  }

  /** Expected word length at this pressure (for the secondary arrival pace). */
  expectedLength(pressure: number): number {
    const m = this.joint(pressure);
    return LENGTH_BANDS.reduce((sum, band, i) => {
      const [lo, hi] = this.lengthRange(band);
      return sum + ((lo + hi) / 2) * m[i]!.reduce((a, b) => a + b, 0);
    }, 0);
  }

  /** Secondary levers: arrival interval and room on the field, from the same pressure. */
  pace(progress: number, lap = 0): DirectorPace {
    const pressure = this.pressure(progress, lap);
    const [w0, w1] = this.t.wpm[this.settings.mode];
    const climb = this.climb(progress);
    const relief = this.relief(progress);
    const swing = lerp(this.t.arrival.calm, this.t.arrival.peak, climb) * lerp(1, this.t.arrival.relief, relief);
    const lapLift = this.settings.encounter === 'endless' ? 1 + 0.12 * (1 - Math.pow(this.t.endlessLapGrowth, Math.max(0, lap))) : 1;
    const wpm = lerp(w0, w1, smoothstep(this.position)) * swing * lapLift;
    const spawnInterval = Math.max(450, Math.round((60000 * this.expectedLength(pressure)) / (wpm * 5)));
    const typical = this.bandSeconds('medium', progress, lap);
    const maxActiveWords = Math.min(16, Math.max(6, Math.ceil((typical * 1000) / spawnInterval) + 2));
    const fastest = this.bandSeconds('fast', progress, lap) / (1 + this.t.jitter);
    return { fallSpeed: this.fieldHeight / Math.max(this.t.minFallSeconds[this.settings.mode], fastest), spawnInterval, maxActiveWords };
  }

  /** Surges placed on the arc's swells (climaxes); recovery follows each (engine). */
  surges(levelInTrial: number, boss: boolean): { at: number; ms: number }[] {
    const extra = this.settings.mode === 'hardcore' ? 1000 : 0;
    if (boss) return [0.35, 0.62, 0.88].map((at) => ({ at, ms: 6000 + extra }));
    if (this.settings.encounter === 'endless') return [0.6, 0.88].map((at) => ({ at, ms: 5000 + extra }));
    if (levelInTrial <= 3) return [];
    if (levelInTrial <= 8) return [{ at: 0.66, ms: 5000 + extra }];
    return [0.6, 0.88].map((at) => ({ at, ms: 4500 + extra }));
  }
}

/** Normalized journey position for apprenticeship `trial` (1–9), level (1–13, 13 = boss). */
export function journeyPosition(trial: number, level: number, trials = 9, levels = 13): number {
  return clamp01(((trial - 1) * levels + (level - 1)) / (trials * levels - 1));
}
