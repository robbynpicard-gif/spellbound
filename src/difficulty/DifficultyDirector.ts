import { SeededRandom } from '../core/Random';

/**
 * TypeL Difficulty Director — the living, continuous version (D-102).
 *
 * One pure, deterministic module decides *what kind* of word comes next (its
 * length and its time to reach the Ward), how often words arrive and how many
 * may share the field. It drives a whole apprenticeship as ONE continuous run
 * (Learn → Master → Boss Examination) and the Endless continuation.
 *
 *   Baseline  rises slowly across the nine apprenticeships (the floor, by `a`)
 *             and convexly across one run (Learn + Master), then climbs through
 *             the boss to its climax. It never resets between checkpoints.
 *   Events    a seeded schedule of short pressure events (every ~8–15 s,
 *             3–7 s long) and major surges (every ~25–40 s), each followed by a
 *             short, shallow recovery that keeps words coming. The boss has
 *             fixed swells; its last recovery ends by 85 % and pressure then
 *             rises smoothly to the maximum at the final second.
 *   Joint mix a 3 × 3 grid of length part (short | medium | long of the
 *             apprenticeship's dominant D-098/D-101 window) × fall band
 *             (slow | medium | fast), weighted by pressure. Short/slow relief
 *             is reserved; long/fast spikes are spaced.
 *   Endless   an endless level L that keeps rising with time and NO ceiling.
 *             Each lever it drives is bounded (mix saturates, spawn interval has
 *             a floor, density a cap, fall speed a bounded overdrive and a
 *             minimum readable fall time), so effective demand keeps climbing
 *             until those bounds meet — at a demand above what even a 200-WPM
 *             typist can sustain (see the simulation report).
 *
 * It reads only the seed, the encounter spec, encounter progress and the
 * simulated clock — never WPM, accuracy, Ward, score or the field. Every
 * number in DIRECTOR_TUNING is an experimental prototype value.
 */

export type DirectorMode = 'normal' | 'hardcore';
/** 'run' = Learn + Master of one apprenticeship; 'boss' = the examination; 'endless'. */
export type EncounterKind = 'run' | 'boss' | 'endless';
export type RunPhase = 'learn' | 'master' | 'boss' | 'endless';
export const LENGTH_BANDS = ['short', 'medium', 'long'] as const;
export const SPEED_BANDS = ['slow', 'medium', 'fast'] as const;
export type LengthBand = (typeof LENGTH_BANDS)[number];
export type SpeedBand = (typeof SPEED_BANDS)[number];
/** Rows: length part (short, medium, long). Columns: speed band (slow, medium, fast). */
export type Mix = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
type Range = readonly [number, number];

/** The serializable description of one encounter. Lives on DifficultyConfig.director. */
export interface DirectorSpec {
  version: 2;
  mode: DirectorMode;
  /** Normalized apprenticeship progression a ∈ [0, 1]: first apprenticeship 0, last 1. */
  apprenticeship: number;
  kind: EncounterKind;
  /** Average length of the classic level this replaces (spawn-interval scaling). */
  referenceLength: number;
}

export interface DirectorContext {
  /** 'run': share of the Learn + Master quota; 'boss': share of the timer. Ignored in Endless. */
  progress: number;
  /** Simulated seconds since the run began (drives the event schedule). */
  seconds: number;
  /** Endless only: seconds since Endless began. */
  endlessSeconds?: number;
  /** Learn or Master (from the run's phase split). */
  phase?: RunPhase;
  /** An opening word placed partway down the field: never fast, never an upper outlier. */
  opening?: boolean;
}

export type PressureEvent = 'calm' | 'pressure' | 'surge' | 'recovery' | 'climax';

export interface SpawnPlan {
  spawnIndex: number;
  length: number;
  /** Seconds a word spawned at the top takes to reach the Ward (time-to-Ward). */
  fallSeconds: number;
  lengthBand: LengthBand;
  speedBand: SpeedBand;
  pressure: number;
  adjusted: null | 'spike-spacing' | 'relief' | 'opening';
  outlier: null | 'below' | 'above';
  /** Multiplier for the gap before the NEXT spawn (timing variation). */
  gapFactor: number;
}

export interface LengthWindow {
  lo: number;
  hi: number;
  dominant: Range;
  above: number;
  below: number;
}

export interface Envelope {
  pressure: number;
  /** Baseline before events (the long-term trend). */
  baseline: number;
  event: PressureEvent;
  mix: Mix;
  lengthWindow: LengthWindow;
  speedBands: Record<SpeedBand, Range>;
  expectedLength: number;
  /** Multiplier for the classic spawn interval: length scaling × density × events × Endless growth. */
  spawnScale: number;
  /** Lowest spawn interval the engine may use (ms). */
  spawnFloorMs: number;
  /** Extra (or fewer) words allowed on the field right now. */
  extraWords: number;
  referenceFallSeconds: number;
  overdrive: number;
  /** Endless level (unbounded); null outside Endless. */
  endlessLevel: number | null;
  reliefReserve: number;
  reliefEvery: number;
}

interface EventTuning { gap: Range; duration: Range; intensity: Range; boost: number; spawn: number; extraWords: number }

export interface DirectorTuning {
  floor: Record<DirectorMode, Range>;
  /** Learn + Master: baseline = floor + span · rise(progress; k). */
  run: { span: Record<DirectorMode, number>; k: number };
  /** Boss: from the run's end baseline up by `rise`, with fixed swells (progress units) and a climax. */
  boss: { rise: number; k: number; surges: readonly number[]; surgeLength: number; recoveryLength: number; climaxFrom: number; climaxBoost: number; shortEventsUntil: number };
  short: EventTuning & { firstAt: number; learnSkip: number };
  major: EventTuning & { firstAt: number };
  recovery: { duration: Range; depth: number; spawn: number; extraWords: number };
  /** How much stronger events and weaker recoveries are in Hardcore; Learn's softer events. */
  hardcore: { eventScale: number; recoveryScale: number; speedScale: number };
  learnEventScale: number;
  endless: {
    /** L starts at the boss's final pressure plus this. */
    startOffset: number;
    /** L gained per minute (never capped). */
    growthPerMinute: Record<DirectorMode, number>;
    /** Spawn interval × e^(−k · (L − L0)), never below the floor. */
    spawnK: number;
    spawnFloorMs: Record<DirectorMode, number>;
    /** Extra words allowed per L above L0, up to a cap. */
    extraWordsPerLevel: number;
    maxExtraWords: number;
    /** Bounded fall-speed overdrive: 1 + (max − 1)(1 − e^(−(L − L0)/tau)). */
    overdriveMax: Record<DirectorMode, number>;
    overdriveTau: number;
    /** Short events come closer together as L rises; recoveries get shallower. */
    gapShrinkPerLevel: number;
    reliefReserveMin: number;
    reliefEveryMax: number;
    aboveTailPerLevel: number;
    aboveTailMax: number;
  };
  /** No word ever reaches the Ward faster than this from the top (readability). */
  minFallSeconds: number;
  openingMix: Mix;
  peakMix: Mix;
  reliefReserve: number;
  reliefEvery: number;
  spikeGap: Range;
  lengths: {
    start: Range; harvest: Range; end: Range; harvestAt: number; levelDrift: number; edge: number; bandSpread: number;
    above: { start: Range; harvest: Range };
    below: Range;
    tailDecay: number;
    library: Range;
  };
  lengthTilt: number;
  speeds: { start: Record<SpeedBand, Range>; end: Record<SpeedBand, Range> };
  speedTilt: number;
  /** Spawn interval × lerp(from, to, pressure). */
  density: Range;
  letterRateMatch: number;
  /** Each spawn's following gap × a value in this range (deterministic). */
  gapJitter: Range;
}

/** EXPERIMENTAL prototype values (D-102). Centralized so they can be tuned in one place. */
export const DIRECTOR_TUNING: DirectorTuning = {
  floor: { normal: [0, 0.36], hardcore: [0.15, 0.55] },
  run: { span: { normal: 0.4, hardcore: 0.4 }, k: 1.6 },
  boss: { rise: 0.22, k: 1.8, surges: [0.22, 0.47, 0.68], surgeLength: 0.07, recoveryLength: 0.05, climaxFrom: 0.85, climaxBoost: 0.36, shortEventsUntil: 0.8 },
  short: { gap: [8, 15], duration: [3, 7], intensity: [0.5, 1], boost: 0.13, spawn: 0.18, extraWords: 1, firstAt: 6, learnSkip: 0.3 },
  major: { gap: [25, 40], duration: [5, 8], intensity: [0.75, 1], boost: 0.3, spawn: 0.34, extraWords: 3, firstAt: 18 },
  // D-102: about half the old recovery depth (0.45 → 0.22) and ~40 % shorter (≈ 5 s → ≈ 3 s); words keep coming.
  recovery: { duration: [2.5, 3.5], depth: 0.22, spawn: 0.12, extraWords: -1 },
  hardcore: { eventScale: 1.15, recoveryScale: 0.75, speedScale: 0.9 },
  learnEventScale: 0.8,
  endless: {
    startOffset: 0,
    growthPerMinute: { normal: 0.1, hardcore: 0.15 },
    spawnK: 0.35,
    spawnFloorMs: { normal: 260, hardcore: 220 },
    extraWordsPerLevel: 2,
    maxExtraWords: 6,
    overdriveMax: { normal: 2.3, hardcore: 2.5 },
    overdriveTau: 2.5,
    gapShrinkPerLevel: 0.2,
    reliefReserveMin: 0.04,
    reliefEveryMax: 14,
    aboveTailPerLevel: 0.015,
    aboveTailMax: 0.06,
  },
  minFallSeconds: 3,
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
  speedTilt: 1,
  density: [1.12, 0.9],
  letterRateMatch: 0.6,
  gapJitter: [0.7, 1.3],
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
/** A smooth 0 → 1 → 0 bump across [start, end]. */
const window01 = (x: number, start: number, end: number) => (x <= start || x >= end ? 0 : Math.sin((Math.PI * (x - start)) / (end - start)));

/** The apprenticeship floor. Monotonic, slow, independent of level counts. */
export function floorAt(spec: Pick<DirectorSpec, 'mode' | 'apprenticeship'>, t: DirectorTuning = DIRECTOR_TUNING): number {
  const [from, to] = t.floor[spec.mode];
  return lerp(from, to, smoothstep(spec.apprenticeship));
}

/** Learn + Master baseline at run progress R. */
export function runBaseline(spec: Pick<DirectorSpec, 'mode' | 'apprenticeship'>, progress: number, t: DirectorTuning = DIRECTOR_TUNING): number {
  return clamp01(floorAt(spec, t) + t.run.span[spec.mode] * convexRise(progress, t.run.k));
}

/** Boss baseline: continues from the run's end, climbs convexly, then the climax ramp to the maximum. */
export function bossBaseline(spec: Pick<DirectorSpec, 'mode' | 'apprenticeship'>, progress: number, t: DirectorTuning = DIRECTOR_TUNING): number {
  const start = runBaseline(spec, 1, t);
  const p = clamp01(progress);
  const b = t.boss;
  const climax = b.climaxBoost * smoothstep((p - b.climaxFrom) / (1 - b.climaxFrom));
  return clamp01(start + b.rise * convexRise(p, b.k) + climax);
}

/** The boss's maximum (its final second). */
export const bossPeak = (spec: Pick<DirectorSpec, 'mode' | 'apprenticeship'>, t: DirectorTuning = DIRECTOR_TUNING) => bossBaseline(spec, 1, t);

/** Endless level L: starts at the boss's peak and rises forever (no ceiling). */
export function endlessLevel(spec: Pick<DirectorSpec, 'mode' | 'apprenticeship'>, seconds: number, t: DirectorTuning = DIRECTOR_TUNING): number {
  const s = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return bossPeak(spec, t) + t.endless.startOffset + t.endless.growthPerMinute[spec.mode] * (s / 60);
}

// ───────────────────────── event schedule ─────────────────────────

export interface ScheduledEvent { kind: 'pressure' | 'surge'; start: number; end: number; intensity: number; recoveryEnd: number; tag: number }

/**
 * Deterministic event timeline (seconds) from the seed. Short events never
 * start inside a surge's recovery. In Endless, gaps shrink as L rises.
 */
export class EventSchedule {
  private readonly events: ScheduledEvent[] = [];
  private shortNext: number;
  private majorNext: number;
  private readonly rng: SeededRandom;

  constructor(seed: number, private readonly t: DirectorTuning, private readonly gapScaleAt: (seconds: number) => number = () => 1) {
    this.rng = new SeededRandom(seed >>> 0);
    this.shortNext = t.short.firstAt;
    this.majorNext = t.major.firstAt;
  }

  private extend(until: number): void {
    while (Math.min(this.shortNext, this.majorNext) <= until + 60) {
      const major = this.majorNext <= this.shortNext;
      const e = major ? this.t.major : this.t.short;
      const start = major ? this.majorNext : this.shortNext;
      const duration = lerp(e.duration[0], e.duration[1], this.rng.next());
      const intensity = lerp(e.intensity[0], e.intensity[1], this.rng.next());
      const tag = this.rng.next();
      const recovery = major ? lerp(this.t.recovery.duration[0], this.t.recovery.duration[1], this.rng.next()) : 0;
      const gap = lerp(e.gap[0], e.gap[1], this.rng.next()) * this.gapScaleAt(start);
      const ev: ScheduledEvent = { kind: major ? 'surge' : 'pressure', start, end: start + duration, intensity, recoveryEnd: start + duration + recovery, tag };
      if (!major) {
        // Never start a short event inside a recovery: push it past.
        const blocking = this.events.find((x) => x.kind === 'surge' && start >= x.end && start < x.recoveryEnd);
        if (blocking) {
          const shift = blocking.recoveryEnd + 0.5 - start;
          ev.start += shift;
          ev.end += shift;
          ev.recoveryEnd = ev.end;
        }
      }
      this.events.push(ev);
      // Gaps are start-to-start, never shorter than the event (and its recovery) plus a breath.
      if (major) this.majorNext = start + Math.max(gap, duration + recovery + 2);
      else this.shortNext = ev.start + Math.max(gap, duration + 1);
    }
  }

  /** Events overlapping [from, to] seconds. */
  between(from: number, to: number): ScheduledEvent[] {
    this.extend(to);
    return this.events.filter((e) => e.recoveryEnd >= from && e.start <= to);
  }

  at(seconds: number): ScheduledEvent[] {
    return this.between(seconds, seconds);
  }
}

// ───────────────────────── joint length × speed ─────────────────────────

function normalize(cells: number[][]): Mix {
  const total = cells.flat().reduce((s, v) => s + v, 0);
  return cells.map((row) => row.map((v) => (total > 0 ? v / total : 0))) as unknown as Mix;
}

/** Layer 3: the joint length × speed mix at a pressure, with the relief reserve enforced. */
export function mixAt(pressure: number, t: DirectorTuning = DIRECTOR_TUNING, reserve = t.reliefReserve): Mix {
  const p = clamp01(pressure);
  const cells = t.openingMix.map((row, i) => row.map((v, j) => lerp(v, t.peakMix[i]![j]!, p)));
  const mix = normalize(cells) as unknown as number[][];
  if (mix[0]![0]! < reserve) {
    const others = 1 - mix[0]![0]!;
    const scale = (1 - reserve) / others;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) mix[i]![j]! *= scale;
    mix[0]![0] = reserve;
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

/**
 * D-101 (formerly the duplicate D-098): the dominant length window. `drift` is
 * how far through the apprenticeship the encounter is (run progress; 1 for the
 * boss and Endless).
 */
export function lengthWindowAt(spec: Pick<DirectorSpec, 'apprenticeship'> & { arcPosition: number }, pressure = 0, t: DirectorTuning = DIRECTOR_TUNING, extraAbove = 0): LengthWindow {
  const L = t.lengths;
  const w = windowProgress(spec.apprenticeship, spec.arcPosition, t);
  const s = smoothstep(Math.min(1, w));
  const [lo, hi] = w <= 1
    ? [lerp(L.start[0], L.harvest[0], s), lerp(L.start[1], L.harvest[1], s)]
    : [lerp(L.harvest[0], L.end[0], w - 1), lerp(L.harvest[1], L.end[1], w - 1)];
  const p = clamp01(pressure);
  const above = lerp(lerp(L.above.start[0], L.above.harvest[0], s), lerp(L.above.start[1], L.above.harvest[1], s), p);
  return { lo, hi, dominant: [Math.round(lo), Math.round(hi)], above: above + extraAbove, below: lerp(L.below[0], L.below[1], s) };
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
  const scale = (spec.mode === 'hardcore' ? t.hardcore.speedScale : 1) / Math.max(1, overdrive);
  const band = (b: SpeedBand): Range => {
    const s = t.speeds.start[b];
    const e = t.speeds.end[b];
    return [Math.max(t.minFallSeconds, lerp(s[0], e[0], a) * scale), Math.max(t.minFallSeconds, lerp(s[1], e[1], a) * scale)];
  };
  return { slow: band('slow'), medium: band('medium'), fast: band('fast') };
}


export function validateDirectorSpec(raw: unknown): string[] {
  const problems: string[] = [];
  const r = raw as Record<string, unknown> | null;
  if (typeof r !== 'object' || r === null) return ['director must be an object'];
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (r.version !== 2) problems.push('director.version must be 2');
  if (r.mode !== 'normal' && r.mode !== 'hardcore') problems.push('director.mode must be normal or hardcore');
  if (r.kind !== 'run' && r.kind !== 'boss' && r.kind !== 'endless') problems.push('director.kind must be run, boss or endless');
  if (!num(r.apprenticeship) || (r.apprenticeship as number) < 0 || (r.apprenticeship as number) > 1) problems.push('director.apprenticeship must be in [0, 1]');
  if (!num(r.referenceLength) || (r.referenceLength as number) <= 0) problems.push('director.referenceLength must be positive');
  return problems;
}

interface EventEffect { boost: number; dip: number; spawn: number; extra: number; event: PressureEvent }

/**
 * The stateful sampler for one engine. State: its own seeded streams, the
 * deterministic event schedules, and a short plan history (spike spacing,
 * guaranteed relief). Exactly six draws per plan, so replays line up.
 */
export class DifficultyDirector {
  private readonly rng: SeededRandom;
  private readonly runEvents: EventSchedule;
  private endlessEvents: EventSchedule | null = null;
  private spawnIndex = 0;
  private lastSpike = -Infinity;
  private sinceRelief = 0;

  constructor(
    private spec: DirectorSpec,
    private readonly seed: number,
    private readonly lengthCounts: Readonly<Record<number, number>>,
    private readonly tuning: DirectorTuning = DIRECTOR_TUNING,
  ) {
    const problems = validateDirectorSpec(spec);
    if (problems.length) throw new Error(`Invalid director spec: ${problems.join('; ')}`);
    this.rng = new SeededRandom((seed ^ 0xd1ec7041) >>> 0);
    this.runEvents = new EventSchedule((seed ^ 0x5eed1234) >>> 0, tuning);
  }

  get currentSpec(): DirectorSpec {
    return this.spec;
  }

  /** Checkpoints, the boss and Endless keep the same streams and history. */
  setSpec(spec: DirectorSpec): void {
    const problems = validateDirectorSpec(spec);
    if (problems.length) throw new Error(`Invalid director spec: ${problems.join('; ')}`);
    this.spec = spec;
  }

  private endlessSchedule(): EventSchedule {
    if (!this.endlessEvents) {
      const t = this.tuning;
      const L0 = endlessLevel(this.spec, 0, t);
      this.endlessEvents = new EventSchedule((this.seed ^ 0x0e7d1e55) >>> 0, t,
        (s) => 1 / (1 + t.endless.gapShrinkPerLevel * Math.max(0, endlessLevel(this.spec, s, t) - L0)));
    }
    return this.endlessEvents;
  }

  /** Pure given the schedule: what the event timeline adds or takes away right now. */
  private effects(ctx: DirectorContext): EventEffect {
    const t = this.tuning;
    const kind = this.spec.kind;
    const hard = this.spec.mode === 'hardcore';
    const scale = (hard ? t.hardcore.eventScale : 1) * (ctx.phase === 'learn' ? t.learnEventScale : 1);
    let sStr = 0;
    let mStr = 0;
    let rec = 0;
    const p = clamp01(ctx.progress);
    if (kind === 'boss') {
      const b = t.boss;
      for (const at of b.surges) {
        mStr = Math.max(mStr, window01(p, at, at + b.surgeLength));
        rec = Math.max(rec, window01(p, at + b.surgeLength, at + b.surgeLength + b.recoveryLength));
      }
    }
    const endless = kind === 'endless';
    const seconds = endless ? Math.max(0, ctx.endlessSeconds ?? 0) : Math.max(0, ctx.seconds);
    const schedule = endless ? this.endlessSchedule() : this.runEvents;
    for (const e of schedule.at(seconds)) {
      if (e.kind === 'pressure') {
        if (ctx.phase === 'learn' && e.tag < t.short.learnSkip) continue;
        if (kind === 'boss' && p > t.boss.shortEventsUntil) continue;
        sStr = Math.max(sStr, window01(seconds, e.start, e.end) * e.intensity);
      } else if (kind !== 'boss') {
        mStr = Math.max(mStr, window01(seconds, e.start, e.end) * e.intensity);
        rec = Math.max(rec, window01(seconds, e.end, e.recoveryEnd) * e.intensity);
      }
    }
    sStr *= scale;
    mStr *= scale;
    const sb = t.short.boost * sStr;
    const mb = t.major.boost * mStr;
    let dip = t.recovery.depth * rec * (hard ? t.hardcore.recoveryScale : 1);
    if (endless) {
      const L = endlessLevel(this.spec, seconds, t);
      dip /= 1 + Math.max(0, L - endlessLevel(this.spec, 0, t));
    }
    const climax = kind === 'boss' && p >= t.boss.climaxFrom;
    return {
      boost: Math.max(sb, mb) + 0.3 * Math.min(sb, mb),
      dip,
      spawn: (1 - t.short.spawn * Math.min(1, sStr)) * (1 - t.major.spawn * Math.min(1, mStr)) * (1 + t.recovery.spawn * rec),
      extra: t.short.extraWords * sStr + t.major.extraWords * mStr + t.recovery.extraWords * rec,
      event: mStr > 0.05 ? 'surge' : climax ? 'climax' : sStr > 0.05 ? 'pressure' : rec > 0.05 ? 'recovery' : 'calm',
    };
  }

  /** The full envelope at a moment. Never consumes the sampling stream. */
  envelope(ctx: DirectorContext): Envelope {
    const t = this.tuning;
    const spec = this.spec;
    const fx = this.effects(ctx);
    let baseline: number;
    let mixBase: number;
    let L: number | null = null;
    let overdrive = 1;
    let endlessSpawn = 1;
    let endlessExtra = 0;
    let reliefReserve = t.reliefReserve;
    let reliefEvery = t.reliefEvery;
    let extraAbove = 0;
    if (spec.kind === 'endless') {
      L = endlessLevel(spec, ctx.endlessSeconds ?? 0, t);
      const over = Math.max(0, L - endlessLevel(spec, 0, t));
      const e = t.endless;
      baseline = L;
      mixBase = Math.min(1, L);
      overdrive = 1 + (e.overdriveMax[spec.mode] - 1) * (1 - Math.exp(-over / e.overdriveTau));
      endlessSpawn = Math.exp(-e.spawnK * over);
      endlessExtra = Math.min(e.maxExtraWords, Math.floor(e.extraWordsPerLevel * over));
      reliefReserve = Math.max(e.reliefReserveMin, t.reliefReserve - 0.02 * over);
      reliefEvery = Math.min(e.reliefEveryMax, Math.round(t.reliefEvery + 2 * over));
      extraAbove = Math.min(e.aboveTailMax, e.aboveTailPerLevel * over);
    } else {
      baseline = spec.kind === 'boss' ? bossBaseline(spec, ctx.progress, t) : runBaseline(spec, ctx.progress, t);
      mixBase = baseline;
    }
    const pressure = clamp01(mixBase + fx.boost - fx.dip);
    const mix = mixAt(pressure, t, reliefReserve);
    const drift = spec.kind === 'run' ? clamp01(ctx.progress) : 1;
    const lengthWindow = lengthWindowAt({ apprenticeship: spec.apprenticeship, arcPosition: drift }, pressure, t, extraAbove);
    const speedBands = speedBandsAt(spec, overdrive, t);
    const mid = (lengthWindow.lo + lengthWindow.hi) / 2;
    let expectedLength = 0;
    LENGTH_BANDS.forEach((band, i) => {
      const share = mix[i]!.reduce((s, v) => s + v, 0);
      expectedLength += share * expectedOf(lengthWeights(band, lengthWindow, pressure, this.lengthCounts, t), mid);
    });
    const [d0, d1] = t.density;
    return {
      pressure, baseline, event: fx.event, mix, lengthWindow, speedBands, expectedLength,
      spawnScale: Math.pow(expectedLength / spec.referenceLength, t.letterRateMatch) * lerp(d0, d1, pressure) * fx.spawn * endlessSpawn,
      spawnFloorMs: spec.kind === 'endless' ? t.endless.spawnFloorMs[spec.mode] : 120,
      extraWords: Math.round(fx.extra) + endlessExtra,
      referenceFallSeconds: (speedBands.medium[0] + speedBands.medium[1]) / 2,
      overdrive, endlessLevel: L, reliefReserve, reliefEvery,
    };
  }

  /** Plan the next spawn. Exactly six draws, always in the same order. */
  next(ctx: DirectorContext): SpawnPlan {
    const t = this.tuning;
    const env = this.envelope(ctx);
    const rCell = this.rng.next();
    const rLength = this.rng.next();
    const rSpeed = this.rng.next();
    const rAdjust = this.rng.next();
    const rTail = this.rng.next();
    const rGap = this.rng.next();
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
    if (!(li === 0 && si === 0) && this.sinceRelief >= env.reliefEvery - 1) {
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

    const gapFactor = lerp(t.gapJitter[0], t.gapJitter[1], rGap);
    const plan: SpawnPlan = { spawnIndex: this.spawnIndex, length, fallSeconds, lengthBand, speedBand, pressure: env.pressure, adjusted, outlier, gapFactor };
    if (li === 2 && si === 2) this.lastSpike = this.spawnIndex;
    this.sinceRelief = li === 0 && si === 0 ? 0 : this.sinceRelief + 1;
    this.spawnIndex++;
    return plan;
  }
}
