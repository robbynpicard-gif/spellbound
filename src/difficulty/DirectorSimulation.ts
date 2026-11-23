import { FIELD, SIMULATION_HZ } from '../core/GameConfig';
import { GameEngine, type RunPlan } from '../core/GameEngine';
import { SeededRandom } from '../core/Random';
import type { DifficultyConfig } from './DifficultyConfig';
import { measurePressure } from './BattlefieldPressure';
import type { SpellId } from '../gameplay/SpellManager';

/**
 * D-102 simulation harness. Runs the REAL GameEngine through a whole
 * continuous apprenticeship (and optionally its Endless) with a synthetic
 * typist, and measures what the field asks of a player. A measuring stick,
 * not a prediction of human play: the typist never casts spells and always
 * aims at the word nearest the Ward.
 */
export interface Typist {
  /** Typing speed while a word is being typed. */
  wpm: number;
  /** Reading a word before starting it after a quiet field. */
  reactionMs: number;
  /** Moving attention to the next target after a capture. */
  switchMs: number;
  /** Chance per keystroke of a typo (typed, noticed after `noticeMs`, erased, retyped). */
  errorRate: number;
  noticeMs: number;
  /**
   * D-113: cast learned spells by typing their names (+ Enter) when a simple,
   * documented policy sees a reason (see `castDecision`). Off = never casts.
   */
  casts?: boolean;
}

/** Realistic typists from 45 to 200 WPM: faster typists read and switch faster and err less, but never instantly. */
export function typistAt(wpm: number): Typist {
  const t = Math.min(1, Math.max(0, (wpm - 45) / 155));
  return {
    wpm,
    reactionMs: Math.round(480 - 260 * t), // 480 → 220 ms
    switchMs: Math.round(320 - 170 * t), // 320 → 150 ms
    errorRate: 0.05 - 0.035 * t, // 5 % → 1.5 %
    noticeMs: Math.round(300 - 120 * t),
  };
}

export const cpsOf = (t: Typist) => (t.wpm * 5) / 60;

export interface SpawnSample {
  length: number;
  fallSeconds: number;
  timeToWard: number;
  seconds: number;
  phase: string;
  lengthBand?: string;
  speedBand?: string;
}

export interface SecondSample {
  t: number;
  phase: string;
  event: string;
  pressure: number | null;
  endlessLevel: number | null;
  words: number;
  maxActive: number;
  spawnMs: number;
  /** Nearest-first typing rate (chars/s) the field needs, with per-word switching cost. */
  requiredCps: number;
  /** Word pairs whose labels overlap on screen (readability). */
  overlaps: number;
  combo: number;
  rush: number;
  /** D-113 battlefield pressure (see BattlefieldPressure.ts). */
  urgent: number;
  workload: number;
  impacts: number;
}

export type FailureCause = 'typing demand' | 'reaction and switching' | 'visual clutter' | 'none';

export interface RunReport {
  seed: number;
  status: string;
  /** Where the run ended: learn, master, boss, endless; 'cleared' when it was won; '… (time cap)' when the cap stopped it. */
  endedIn: string;
  seconds: number;
  endlessSeconds: number;
  score: number;
  captured: number;
  missed: number;
  maxCombo: number;
  peakRush: number;
  checkpoints: { t: number; phase: string; score: number; combo: number; rush: number }[];
  /** Seconds at which spell scrolls appeared, were collected, and spells were cast. */
  spellScrolls: number[];
  spellsCollected: number[];
  casts: { t: number; spell: SpellId }[];
  spawns: SpawnSample[];
  timeline: SecondSample[];
  failure: FailureCause;
}

const H = FIELD.height;

export function requiredCps(words: readonly { y: number; speed: number; match: string; typed: number }[], switchS: number): number {
  const rows = words
    .filter((w) => w.speed > 0)
    .map((w) => ({ t: Math.max(0.05, (H - w.y) / w.speed), letters: w.match.length - w.typed }))
    .sort((a, b) => a.t - b.t);
  let letters = 0;
  let worst = 0;
  rows.forEach((r, k) => {
    letters += r.letters;
    const time = Math.max(0.05, r.t - switchS * (k + 1));
    worst = Math.max(worst, letters / time);
  });
  return worst;
}

function overlapPairs(words: readonly { x: number; y: number; text: string }[]): number {
  let n = 0;
  for (let i = 0; i < words.length; i++)
    for (let j = i + 1; j < words.length; j++) {
      const a = words[i]!;
      const b = words[j]!;
      const half = ((a.text.length + b.text.length) * FIELD.approxCharWidth) / 2;
      if (Math.abs(a.x - b.x) < half && Math.abs(a.y - b.y) < 28) n++;
    }
  return n;
}

export interface SimOptions {
  /** A continuous run, or a single config (sandbox/Endless directly). */
  plan?: RunPlan;
  config?: DifficultyConfig;
  /** Continue into this Endless config after the boss. */
  endless?: DifficultyConfig;
  hardcore?: boolean;
  words: readonly string[];
  seed: number;
  typist: Typist;
  maxSeconds?: number;
  /** Record a timeline sample every N seconds. */
  sampleEvery?: number;
}

export function simulate(o: SimOptions): RunReport {
  const config = o.plan ? o.plan.segments[0]!.config : o.config!;
  const engine = new GameEngine({ config, run: o.plan, seed: o.seed, words: o.words, hardcore: o.hardcore, experimentalScoring: true });
  const hands = new SeededRandom((o.seed ^ 0x7a9e57) >>> 0);
  const spawns: SpawnSample[] = [];
  const timeline: SecondSample[] = [];
  const checkpoints: RunReport['checkpoints'] = [];
  const phase = () => engine.runInfo?.phase ?? (engine.config.director?.kind ?? 'level');
  engine.events.on('wordSpawned', ({ word }) => {
    const plan = engine.directorSnapshot?.lastPlan;
    spawns.push({
      length: word.text.length, fallSeconds: H / word.speed, timeToWard: (H - word.y) / word.speed,
      seconds: engine.state.tick / SIMULATION_HZ, phase: phase(),
      ...(plan ? { lengthBand: plan.lengthBand, speedBand: plan.speedBand } : {}),
    });
  });
  const spellScrolls: number[] = [];
  const spellsCollected: number[] = [];
  const casts: RunReport['casts'] = [];
  engine.events.on('wordSpawned', ({ word }) => {
    if (word.spell) spellScrolls.push(engine.state.tick / SIMULATION_HZ);
  });
  engine.events.on('spellCollected', () => spellsCollected.push(engine.state.tick / SIMULATION_HZ));
  engine.events.on('spellCast', ({ spell }) => casts.push({ t: engine.state.tick / SIMULATION_HZ, spell }));
  engine.events.on('checkpoint', () => checkpoints.push({ t: engine.state.tick / SIMULATION_HZ, phase: phase(), score: engine.state.score, combo: engine.state.combo, rush: engine.volleyMultiplier }));
  const T = o.typist;
  const cps = cpsOf(T);
  const ticks = (ms: number) => Math.max(0, Math.round((ms / 1000) * SIMULATION_HZ));
  let wait = ticks(T.reactionMs);
  let budget = 0;
  let typo = false;
  let endlessStart: number | null = null;
  let peakRush = 1;
  let casting: string | null = null;
  let nextCastCheck = 0;
  let currentAim: number | null = null;
  const maxTicks = (o.maxSeconds ?? 3600) * SIMULATION_HZ;
  const every = Math.max(1, Math.round((o.sampleEvery ?? 1) * SIMULATION_HZ));
  for (;;) {
    if (engine.status === 'won' && o.endless && endlessStart === null) {
      engine.continueIntoEndless(o.endless);
      endlessStart = engine.state.tick;
    }
    if (engine.status !== 'playing' || engine.state.tick >= maxTicks) break;
    engine.step();
    if (engine.status !== 'playing') continue;
    const s = engine.state;
    peakRush = Math.max(peakRush, engine.volleyMultiplier);
    if (s.tick % every === 0) {
      const snap = engine.directorSnapshot;
      const pace = engine.pace;
      const bp = measurePressure(s.words, { slowFactor: s.slowFactor, slowStacks: s.slowStacks.length, frozen: s.freezeTicks > 0 });
      timeline.push({
        t: s.tick / SIMULATION_HZ, phase: phase(), event: snap?.envelope.event ?? 'calm', pressure: snap?.envelope.pressure ?? null,
        endlessLevel: snap?.envelope.endlessLevel ?? null, words: s.words.length, maxActive: pace.maxActiveWords, spawnMs: pace.spawnInterval,
        requiredCps: requiredCps(s.words, T.switchMs / 1000), overlaps: overlapPairs(s.words), combo: s.combo, rush: engine.volleyMultiplier,
        urgent: bp.urgent, workload: bp.workload, impacts: bp.impacts,
      });
    }
    if (wait > 0) {
      wait--;
      continue;
    }
    if (T.casts && s.input === '' && !casting && s.tick >= nextCastCheck) {
      nextCastCheck = s.tick + ticks(500);
      casting = castDecision(engine, T);
    }
    if (casting) {
      // Typing the spell's name, then Enter (typing is the only input, D-107).
      budget += cps / SIMULATION_HZ;
      while (budget >= 1 && casting) {
        engine.typeChar(casting[s.input.length]!);
        budget--;
        if (s.input === casting) {
          engine.submit();
          casting = null;
          budget = 0;
          wait = ticks(T.switchMs);
        }
      }
      continue;
    }
    const target = [...s.words].sort((a, b) => b.y - a.y || a.id - b.id)[0];
    if (!target) {
      budget = 0;
      wait = ticks(T.reactionMs); // a new word must be read first
      continue;
    }
    // Typing only (D-111): the typist simply types the nearest word; no clicking or pinning.
    budget += cps / SIMULATION_HZ;
    while (budget >= 1 && engine.status === 'playing') {
      const aimed = s.words.find((w) => w.id === (s.pinnedId ?? currentAim ?? target.id)) ?? target;
      currentAim = aimed.id;
      if (typo) {
        engine.backspace();
        typo = false;
        budget--;
        continue;
      }
      const ch = aimed.match[s.input.length];
      if (!ch) break;
      if (hands.next() < T.errorRate) {
        engine.typeChar(ch === 'q' ? 'z' : 'q');
        typo = true;
        budget = 0;
        wait = ticks(T.noticeMs);
        break;
      }
      engine.typeChar(ch);
      budget--;
      if (s.input === aimed.match) {
        engine.submit();
        currentAim = null;
        budget = 0;
        wait = ticks(T.switchMs);
        break;
      }
    }
  }
  const seconds = engine.state.tick / SIMULATION_HZ;
  const st = engine.stats();
  const lost = engine.status === 'lost';
  return {
    seed: o.seed, status: engine.status,
    endedIn: lost ? phase() : engine.status === 'won' ? 'cleared' : `${phase()} (time cap)`,
    seconds, endlessSeconds: endlessStart === null ? 0 : (engine.state.tick - endlessStart) / SIMULATION_HZ,
    score: engine.state.score, captured: st.completed, missed: st.missed, maxCombo: st.maxCombo, peakRush,
    checkpoints, spellScrolls, spellsCollected, casts, spawns, timeline, failure: lost ? classifyFailure(timeline.slice(-12), T) : 'none',
  };
}

/**
 * D-113 simulated spell policy: a plain, documented heuristic so simulations
 * can measure spell cadence and value. It is not a model of good play, and it
 * never reads anything the player couldn't see.
 */
export function castDecision(engine: GameEngine, t: Typist): string | null {
  const s = engine.state;
  const learned = new Set(engine.config.availableSpells);
  const has = (id: SpellId) => learned.has(id) && (s.spells[id] ?? 0) > 0;
  const time = { slowFactor: s.slowFactor, slowStacks: s.slowStacks.length, frozen: s.freezeTicks > 0 };
  const bp = measurePressure(s.words, time, { urgentSeconds: 3, windowSeconds: 6, switchSeconds: t.switchMs / 1000, impactGapSeconds: 0.45 });
  const cps = cpsOf(t);
  const lower = s.words.filter((w) => w.y > FIELD.height * 0.5).length;
  const doomed = s.words.some((w) => {
    const ttw = (FIELD.height - w.y) / Math.max(1e-6, w.speed);
    return ttw < 1.2 && (w.match.length - w.typed) / cps + t.switchMs / 1000 > ttw;
  });
  if (doomed && has('shock')) return 'shock';
  if (bp.requiredLps > cps * 0.85 && s.slowStacks.length === 0 && s.freezeTicks === 0 && has('slow')) return 'slow';
  if (bp.urgent >= 3 && s.freezeTicks === 0 && has('ice')) return 'ice';
  if (lower >= 3 && has('fire')) return 'fire';
  if (s.words.length >= 6 && has('alter')) return 'alter';
  if (s.barrier === 0 && s.combo >= 15 && has('barrier')) return 'barrier';
  if (s.instability >= 40 && has('wind')) return 'wind';
  if (engine.volleyMultiplier >= 2.5 && s.words.length >= 4 && has('harvest')) return 'harvest';
  return null;
}

/** Why the Ward fell, from the last ~12 s: too much to type, too little time per word, or an unreadable field. */
export function classifyFailure(last: readonly SecondSample[], t: Typist): FailureCause {
  if (last.length === 0) return 'reaction and switching';
  const mean = (f: (s: SecondSample) => number) => last.reduce((a, s) => a + f(s), 0) / last.length;
  if (mean((s) => s.overlaps) >= 2) return 'visual clutter';
  return mean((s) => s.requiredCps) > cpsOf(t) * 0.9 ? 'typing demand' : 'reaction and switching';
}

// ───────────── aggregation helpers ─────────────

export function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * q));
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/** Seconds between the starts of consecutive events of one kind in a timeline. */
export function eventGaps(timeline: readonly SecondSample[], kind: string): number[] {
  const starts: number[] = [];
  let prev = '';
  for (const s of timeline) {
    if (s.event === kind && prev !== kind) starts.push(s.t);
    prev = s.event;
  }
  return starts.slice(1).map((t, i) => t - starts[i]!);
}

/** Lengths (seconds) of consecutive runs of one event kind. */
export function eventDurations(timeline: readonly SecondSample[], kind: string): number[] {
  const out: number[] = [];
  let run = 0;
  for (const s of timeline) {
    if (s.event === kind) run++;
    else if (run > 0) {
      out.push(run);
      run = 0;
    }
  }
  return out;
}
