/**
 * D-097 simulation harness (offline tooling, never used by the game). Plays a
 * level with a simple bot typist so classic and director difficulty can be
 * compared on what actually spawns. The bot is deliberately plain: it aims at
 * the lowest word, types at a fixed rate with a short reaction pause, and
 * never casts spells. Its skill never changes the director (no adaptation).
 */
import { GameEngine } from '../core/GameEngine';
import { FIELD, SIMULATION_STEP_MS } from '../core/GameConfig';
import type { DifficultyConfig } from './DifficultyConfig';

export interface SimSpawn {
  /** Seconds since the level began. */
  t: number;
  length: number;
  /** Seconds to fall the whole field at spawn speed (time-to-Ward from the top). */
  fallSeconds: number;
  /** Encounter progress 0–1 when it spawned (quota share, timer share, or Endless lap share). */
  progress: number;
  /** Director pressure (null on classic). */
  pressure: number | null;
}

export interface SimResult {
  spawns: SimSpawn[];
  breaches: number;
  captures: number;
  result: 'won' | 'lost' | 'timeout';
  seconds: number;
}

export interface BotSkill {
  /** Characters per second while typing a word. */
  cps: number;
  /** Pause before starting each word, seconds. */
  reaction: number;
}

export function simulateLevel(config: DifficultyConfig, seed: number, words: readonly string[], skill: BotSkill, maxSeconds = 300): SimResult {
  const engine = new GameEngine({ config, seed, words, experimentalScoring: true });
  const spawns: SimSpawn[] = [];
  let breaches = 0;
  let captures = 0;
  const quota = config.requiredWords;
  const progressNow = () => {
    const s = engine.state;
    if (quota) return Math.min(1, s.completed / quota);
    if (config.survivalMs) return Math.min(1, (s.tick * SIMULATION_STEP_MS) / config.survivalMs);
    if (config.rampWords) return (s.completed % config.rampWords) / config.rampWords;
    return 0;
  };
  engine.events.on('wordSpawned', ({ word }) => {
    if (word.spawnTick !== engine.state.tick) return; // carried words
    spawns.push({
      t: (engine.state.tick * SIMULATION_STEP_MS) / 1000,
      length: word.text.length,
      fallSeconds: FIELD.height / word.speed,
      progress: progressNow(),
      pressure: config.director ? (engine.lastSpawnPlan?.pressure ?? null) : null,
    });
  });
  engine.events.on('wordMissed', () => breaches++);
  engine.events.on('wordCompleted', () => captures++);
  const ticksPerChar = Math.max(1, Math.round(1000 / skill.cps / SIMULATION_STEP_MS));
  const pauseTicks = Math.round((skill.reaction * 1000) / SIMULATION_STEP_MS);
  let targetId: number | null = null;
  let wait = pauseTicks;
  const maxTicks = Math.round((maxSeconds * 1000) / SIMULATION_STEP_MS);
  while (engine.status === 'playing' && engine.state.tick < maxTicks) {
    const s = engine.state;
    const target = targetId === null ? null : s.words.find((w) => w.id === targetId);
    if (targetId !== null && !target) {
      targetId = null;
      engine.clearInput();
      wait = pauseTicks;
    }
    if (targetId === null && wait <= 0 && s.words.length > 0) {
      const lowest = [...s.words].sort((a, b) => b.y - a.y)[0]!;
      targetId = lowest.id;
      engine.clearInput();
      wait = 0;
    }
    if (wait > 0) wait--;
    else if (targetId !== null && s.tick % ticksPerChar === 0) {
      const w = s.words.find((x) => x.id === targetId)!;
      if (s.input.length < w.match.length) engine.typeChar(w.match[s.input.length]!);
      if (s.input.length >= w.match.length) {
        engine.submit();
        targetId = null;
        wait = pauseTicks;
      }
    }
    engine.step();
  }
  const result = engine.status === 'won' ? 'won' : engine.status === 'lost' ? 'lost' : 'timeout';
  return { spawns, breaches, captures, result, seconds: (engine.state.tick * SIMULATION_STEP_MS) / 1000 };
}

/** Absolute quadrant thresholds used in reports (seconds to fall the field). */
export const QUADRANT = { shortMax: 4, longMin: 7, slowMin: 12, fastMax: 9 };

export type Quadrant = 'short-slow' | 'long-slow' | 'short-fast' | 'long-fast' | 'middle';
export function quadrantOf(s: { length: number; fallSeconds: number }): Quadrant {
  const short = s.length <= QUADRANT.shortMax;
  const long = s.length >= QUADRANT.longMin;
  const slow = s.fallSeconds >= QUADRANT.slowMin;
  const fast = s.fallSeconds <= QUADRANT.fastMax;
  if (short && slow) return 'short-slow';
  if (long && slow) return 'long-slow';
  if (short && fast) return 'short-fast';
  if (long && fast) return 'long-fast';
  return 'middle';
}

export const percentile = (xs: readonly number[], q: number) => {
  if (!xs.length) return NaN;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))))]!;
};

/** Typing demand of a word: letters per second of fall it asks for. */
export const demand = (s: { length: number; fallSeconds: number }) => s.length / s.fallSeconds;
