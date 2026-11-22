import { FIELD, SIMULATION_HZ } from '../core/GameConfig';
import { GameEngine } from '../core/GameEngine';
import type { DifficultyConfig } from './DifficultyConfig';

/**
 * Difficulty simulation for D-097 (Phase 2). Runs the REAL GameEngine with a
 * deterministic synthetic typist and measures what the field asks of a
 * player. Used by tests and by tools/director-report.ts to compare the
 * classic difficulty with the Difficulty Director.
 *
 * The typist is a measuring stick, not a prediction of human play: it never
 * mistypes, never casts spells, always aims at the word nearest the Ward,
 * and types at a fixed rate with a fixed pause between words.
 */
export interface Typist {
  /** Characters per second while typing a word. */
  cps: number;
  /** Pause before starting each new word, in ms (reading / reaction). */
  reactionMs: number;
}

export interface SpawnSample {
  length: number;
  /** Time-to-Ward from the top of the field at spawn speed (seconds). */
  fallSeconds: number;
  /** Seconds from spawn to the Ward from where it spawned (opening words start lower). */
  timeToWard: number;
  /** Encounter progress (0–1 of elapsed time) when it spawned. */
  at: number;
  lengthBand?: string;
  speedBand?: string;
}

export interface SecondSample {
  t: number;
  /**
   * Typing rate (characters per second) needed to clear every word on the
   * field before it reaches the Ward, nearest-first: max over k of
   * (letters left in the k nearest words) / (time until the k-th lands).
   */
  requiredCps: number;
  words: number;
  pressure: number | null;
}

export interface RunReport {
  seed: number;
  status: string;
  seconds: number;
  captured: number;
  missed: number;
  spawns: SpawnSample[];
  timeline: SecondSample[];
}

const H = FIELD.height;

/** Nearest-first schedulability: the typing rate the field demands right now. */
export function requiredCps(words: readonly { y: number; speed: number; match: string; typed: number }[], reactionS: number): number {
  const rows = words
    .filter((w) => w.speed > 0)
    .map((w) => ({ t: Math.max(0.05, (H - w.y) / w.speed), letters: w.match.length - w.typed }))
    .sort((a, b) => a.t - b.t);
  let letters = 0;
  let worst = 0;
  rows.forEach((r, k) => {
    letters += r.letters;
    const time = Math.max(0.05, r.t - reactionS * (k + 1));
    worst = Math.max(worst, letters / time);
  });
  return worst;
}

export function simulateRun(config: DifficultyConfig, words: readonly string[], seed: number, typist: Typist, maxSeconds = 240): RunReport {
  const engine = new GameEngine({ config, seed, words, experimentalScoring: true });
  const spawns: SpawnSample[] = [];
  const timeline: SecondSample[] = [];
  const expected = config.survivalMs ? config.survivalMs / 1000 : null;
  engine.events.on('wordSpawned', ({ word }) => {
    const plan = engine.directorSnapshot?.lastPlan;
    spawns.push({
      length: word.text.length,
      fallSeconds: H / word.speed,
      timeToWard: (H - word.y) / word.speed,
      at: engine.state.tick,
      ...(plan ? { lengthBand: plan.lengthBand, speedBand: plan.speedBand } : {}),
    });
  });
  let budget = 0;
  let wait = 0;
  const reactionTicks = Math.round((typist.reactionMs / 1000) * SIMULATION_HZ);
  const maxTicks = maxSeconds * SIMULATION_HZ;
  while (engine.status === 'playing' && engine.state.tick < maxTicks) {
    engine.step();
    if (engine.status !== 'playing') break;
    const tick = engine.state.tick;
    if (tick % SIMULATION_HZ === 0) {
      timeline.push({
        t: tick / SIMULATION_HZ,
        requiredCps: requiredCps(engine.state.words, typist.reactionMs / 1000),
        words: engine.state.words.length,
        pressure: engine.directorSnapshot?.envelope.pressure ?? null,
      });
    }
    if (wait > 0) {
      wait--;
      continue;
    }
    budget += typist.cps / SIMULATION_HZ;
    const target = [...engine.state.words].sort((a, b) => b.y - a.y || a.id - b.id)[0];
    if (!target) {
      budget = Math.min(budget, 1);
      continue;
    }
    if (engine.state.pinnedId !== target.id && engine.state.input === '') engine.selectTarget(target.id);
    while (budget >= 1 && engine.status === 'playing') {
      const aimed = engine.state.words.find((w) => w.id === (engine.state.pinnedId ?? target.id));
      if (!aimed) break;
      const char = aimed.match[engine.state.input.length];
      if (!char) break;
      engine.typeChar(char);
      budget--;
      if (engine.state.input === aimed.match) {
        engine.submit();
        wait = reactionTicks;
        budget = 0;
        break;
      }
    }
  }
  const seconds = engine.state.tick / SIMULATION_HZ;
  const total = expected ?? seconds;
  for (const s of spawns) s.at = Math.min(1, s.at / SIMULATION_HZ / Math.max(1, total));
  return { seed, status: engine.status, seconds, captured: engine.state.completed, missed: engine.state.missed, spawns, timeline };
}

// ───────────── aggregation ─────────────

export const QUADRANT_THRESHOLDS = { shortMax: 4, longMin: 7, slowMinSeconds: 13.5, fastMaxSeconds: 10 };

export function lengthClass(len: number): 'short' | 'medium' | 'long' {
  return len <= QUADRANT_THRESHOLDS.shortMax ? 'short' : len >= QUADRANT_THRESHOLDS.longMin ? 'long' : 'medium';
}
export function speedClass(fall: number): 'slow' | 'medium' | 'fast' {
  return fall >= QUADRANT_THRESHOLDS.slowMinSeconds ? 'slow' : fall <= QUADRANT_THRESHOLDS.fastMaxSeconds ? 'fast' : 'medium';
}

export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * q));
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

export interface Summary {
  runs: number;
  spawns: number;
  lengthHistogram: Record<number, number>;
  meanLength: number;
  fall: { p10: number; p50: number; p90: number; min: number };
  /** Shares of the 3 × 3 grid, by absolute thresholds (same for both systems). */
  grid: Record<string, number>;
  corners: { shortSlow: number; longSlow: number; shortFast: number; longFast: number };
  /** time-to-Ward ÷ time to type it alone at the typist's rate. Lower = tighter. */
  slack: { p10: number; p50: number };
  /** Share of words whose slack is under 2 (tight on their own). */
  tightShare: number;
  /** Required typing rate (cps) by tenth of the encounter (mean across runs). */
  pressureCurve: number[];
  /** Director pressure by tenth (null for classic). */
  directorCurve: (number | null)[];
  peakRequiredCps: number;
  /** Relief windows per minute: ≥ 2 s at or below half of the run's 80th-percentile demand, right after reaching it. */
  recoveriesPerMinute: number;
  /** Mean seconds to clear the encounter (quota levels) among runs that cleared it. */
  meanSeconds: number;
  winRate: number;
  missesPerRun: number;
}

export function summarize(reports: readonly RunReport[], typist: Typist): Summary {
  const spawns = reports.flatMap((r) => r.spawns);
  const hist: Record<number, number> = {};
  for (const s of spawns) hist[s.length] = (hist[s.length] ?? 0) + 1;
  const n = Math.max(1, spawns.length);
  for (const k of Object.keys(hist)) hist[Number(k)] = hist[Number(k)]! / n;
  const grid: Record<string, number> = {};
  for (const l of ['short', 'medium', 'long']) for (const v of ['slow', 'medium', 'fast']) grid[`${l}-${v}`] = 0;
  for (const s of spawns) grid[`${lengthClass(s.length)}-${speedClass(s.fallSeconds)}`]! += 1 / n;
  const falls = spawns.map((s) => s.fallSeconds);
  const slack = spawns.map((s) => s.timeToWard / (s.length / typist.cps + typist.reactionMs / 1000));
  const curve = Array.from({ length: 10 }, () => [] as number[]);
  const dcurve = Array.from({ length: 10 }, () => [] as number[]);
  let recoveries = 0;
  let minutes = 0;
  for (const r of reports) {
    minutes += r.seconds / 60;
    const total = Math.max(1, r.timeline.length);
    r.timeline.forEach((s, i) => {
      const bin = Math.min(9, Math.floor((i / total) * 10));
      curve[bin]!.push(s.requiredCps);
      if (s.pressure !== null) dcurve[bin]!.push(s.pressure);
    });
    // Relative to the run's own peaks, so a gentle level's breathers count too.
    const peak = Math.max(0.5, percentile(r.timeline.map((s) => s.requiredCps), 0.8));
    let armed = false;
    let calm = 0;
    for (const s of r.timeline) {
      if (s.requiredCps >= peak) {
        armed = true;
        calm = 0;
      } else if (armed && s.requiredCps <= 0.5 * peak) {
        calm++;
        if (calm >= 2) {
          recoveries++;
          armed = false;
          calm = 0;
        }
      } else calm = 0;
    }
  }
  const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
  const won = reports.filter((r) => r.status === 'won');
  return {
    runs: reports.length,
    spawns: spawns.length,
    lengthHistogram: hist,
    meanLength: mean(spawns.map((s) => s.length)),
    fall: { p10: percentile(falls, 0.1), p50: percentile(falls, 0.5), p90: percentile(falls, 0.9), min: Math.min(...falls) },
    grid,
    corners: { shortSlow: grid['short-slow']!, longSlow: grid['long-slow']!, shortFast: grid['short-fast']!, longFast: grid['long-fast']! },
    slack: { p10: percentile(slack, 0.1), p50: percentile(slack, 0.5) },
    tightShare: slack.filter((v) => v < 2).length / n,
    pressureCurve: curve.map(mean),
    directorCurve: dcurve.map((v) => (v.length ? mean(v) : null)),
    peakRequiredCps: percentile(reports.flatMap((r) => r.timeline.map((s) => s.requiredCps)), 0.95),
    recoveriesPerMinute: minutes > 0 ? recoveries / minutes : 0,
    meanSeconds: mean(won.map((r) => r.seconds)),
    winRate: won.length / Math.max(1, reports.length),
    missesPerRun: mean(reports.map((r) => r.missed)),
  };
}
