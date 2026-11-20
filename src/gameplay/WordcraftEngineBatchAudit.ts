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
    return {
      scenario: scenario.name, trials: seeds.length, baseline: a, experimental: b,
      phraseGain: b.phrases - a.phrases,
      captureGain: b.captured - a.captured,
      missIncrease: b.missed - a.missed,
      replayFailures: [...baseline, ...experimental].filter((report) => !report.replayMatched).length,
    };
  });
}
