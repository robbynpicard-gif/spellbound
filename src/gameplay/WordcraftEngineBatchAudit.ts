import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { simulateEngineWordcraft, type EngineWordcraftReport } from './WordcraftEngineSimulation';

export interface WordcraftBatchScenario {
  name: string;
  config: DifficultyConfig;
  ticksPerCharacter: number;
}

export interface WordcraftBatchRow {
  scenario: string;
  trials: number;
  baseline: BatchTotals;
  experimental: BatchTotals;
  phraseGain: number;
  captureGain: number;
  missIncrease: number;
  replayFailures: number;
  decision: 'insufficient-data' | 'reject' | 'review';
  rates: { baselinePhrasesPer100Captures: number; experimentalPhrasesPer100Captures: number; baselineMissesPer100Spawns: number; experimentalMissesPer100Spawns: number; baselineInitialCollisionsPer100Spawns: number; experimentalInitialCollisionsPer100Spawns: number };
}

export interface BatchTotals {
  phrases: number;
  captured: number;
  missed: number;
  spawned: number;
  recentDuplicates: number;
  initialCollisions: number;
  meanSpawnLength: number;
}

function total(reports: readonly EngineWordcraftReport[]): BatchTotals {
  const sum = (key: 'phrases' | 'captured' | 'missed' | 'spawned' | 'repeatedRecentWords' | 'repeatedRecentInitials') =>
    reports.reduce((n, report) => n + report[key], 0);
  const spawned = sum('spawned');
  return {
    phrases: sum('phrases'), captured: sum('captured'), missed: sum('missed'), spawned,
    recentDuplicates: sum('repeatedRecentWords'), initialCollisions: sum('repeatedRecentInitials'),
    meanSpawnLength: spawned
      ? reports.reduce((n, report) => n + report.averageSpawnLength * report.spawned, 0) / spawned
      : 0,
  };
}

/** Fixed-seed, real-engine A/B batch. Offline tests only; not live telemetry.
 * A positive phraseGain is not sufficient for rollout: inspect misses, capture
 * rate, repeated words, and the individual scenario results as well. */
export function auditEngineWordcraftBatch(
  words: readonly string[],
  scenarios: readonly WordcraftBatchScenario[],
  seeds: readonly number[],
  maxTicks = 1800,
): WordcraftBatchRow[] {
  return scenarios.map((scenario) => {
    const baseline = seeds.map((seed) =>
      simulateEngineWordcraft(words, scenario.config, seed, maxTicks, scenario.ticksPerCharacter, 'baseline'));
    const experimental = seeds.map((seed) =>
      simulateEngineWordcraft(words, scenario.config, seed, maxTicks, scenario.ticksPerCharacter, 'experimental'));
    const a = total(baseline);
    const b = total(experimental);
    const per100 = (numerator: number, denominator: number) => denominator ? 100 * numerator / denominator : 0;
    const rates = {
      baselinePhrasesPer100Captures: per100(a.phrases, a.captured),
      experimentalPhrasesPer100Captures: per100(b.phrases, b.captured),
      baselineMissesPer100Spawns: per100(a.missed, a.spawned),
      experimentalMissesPer100Spawns: per100(b.missed, b.spawned),
      baselineInitialCollisionsPer100Spawns: per100(a.initialCollisions, a.spawned),
      experimentalInitialCollisionsPer100Spawns: per100(b.initialCollisions, b.spawned),
    };
    // Conservative screening thresholds, not a rollout authorization.
    // Require at least 100 captures per arm before interpreting rates.
    const decision = Math.min(a.captured, b.captured) < 100 ? 'insufficient-data'
      : rates.experimentalPhrasesPer100Captures <= rates.baselinePhrasesPer100Captures
        || rates.experimentalMissesPer100Spawns > rates.baselineMissesPer100Spawns + 2
        || rates.experimentalInitialCollisionsPer100Spawns > rates.baselineInitialCollisionsPer100Spawns + 2
        || b.recentDuplicates > a.recentDuplicates
        ? 'reject' : 'review';
    return {
      rates, decision,
      scenario: scenario.name, trials: seeds.length, baseline: a, experimental: b,
      phraseGain: b.phrases - a.phrases,
      captureGain: b.captured - a.captured,
      missIncrease: b.missed - a.missed,
      replayFailures: [...baseline, ...experimental].filter((report) => !report.replayMatched).length,
    };
  });
}
