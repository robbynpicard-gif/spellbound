/**
 * D-113 / D-114 battlefield-pressure report: Opening Trial, Academy and
 * Endless, measured on the real engine with deterministic typists.
 * Run: npx tsx tools/battlefield-report.ts [out.json] [quick]
 *
 * A yardstick for finding problems, not a prediction of human enjoyment.
 */
import { writeFileSync } from 'node:fs';
import { WORDS } from '../src/data/wordList';
import { percentile, simulate, typistAt, type RunReport, type Typist } from '../src/difficulty/DirectorSimulation';
import { apprenticeshipEndless, apprenticeshipRun, openingRun, type Mode } from '../src/typel/apprenticeship';
import type { RunPlan } from '../src/core/GameEngine';

const out = process.argv[2] ?? 'battlefield-report.json';
const quick = process.argv[3] === 'quick';
const SEEDS = quick ? 2 : 4;
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const gaps = (t: number[]) => t.slice(1).map((x, i) => x - t[i]!);
const typist = (wpm: number, casts: boolean): Typist => ({ ...typistAt(wpm), casts });

function summarize(rs: RunReport[]) {
  const tl = rs.flatMap((r) => r.timeline);
  const sp = rs.flatMap((r) => r.spawns);
  const lengths = sp.map((s) => s.length);
  const falls = sp.map((s) => s.fallSeconds);
  const spawnGaps = rs.flatMap((r) => gaps(r.spawns.map((s) => s.seconds)));
  const minutes = rs.reduce((a, r) => a + r.seconds, 0) / 60;
  const failures: Record<string, number> = {};
  for (const r of rs) if (r.status === 'lost') failures[r.failure] = (failures[r.failure] ?? 0) + 1;
  // the three thirds of each run (by time): opening, development, climax
  const third = (k: number) => rs.flatMap((r) => r.timeline.filter((s) => s.t >= (r.seconds * k) / 3 && s.t < (r.seconds * (k + 1)) / 3));
  const phase = (k: number) => {
    const p = third(k);
    return { active: mean(p.map((s) => s.words)), urgent: mean(p.map((s) => s.urgent)), workload: mean(p.map((s) => s.workload)), required: mean(p.map((s) => s.requiredCps)) };
  };
  return {
    runs: rs.length,
    cleared: rs.filter((r) => r.status === 'won').length / rs.length,
    seconds: mean(rs.map((r) => r.seconds)),
    failures,
    active: { mean: mean(tl.map((s) => s.words)), p95: percentile(tl.map((s) => s.words), 0.95) },
    urgent: { mean: mean(tl.map((s) => s.urgent)), p95: percentile(tl.map((s) => s.urgent), 0.95) },
    workload: { mean: mean(tl.map((s) => s.workload)), p95: percentile(tl.map((s) => s.workload), 0.95) },
    requiredLps: { mean: mean(tl.map((s) => s.requiredCps)), p95: percentile(tl.map((s) => s.requiredCps), 0.95) },
    /** Mean count of scroll pairs due at the Ward within 0.45 s of each other, at any moment. */
    impacts: mean(tl.map((s) => s.impacts)),
    overlaps: mean(tl.map((s) => s.overlaps)),
    length: { mean: mean(lengths), p10: percentile(lengths, 0.1), p50: percentile(lengths, 0.5), p90: percentile(lengths, 0.9),
      short: lengths.filter((l) => l <= 4).length / Math.max(1, lengths.length), long: lengths.filter((l) => l >= 7).length / Math.max(1, lengths.length) },
    fall: { p10: percentile(falls, 0.1), p50: percentile(falls, 0.5), p90: percentile(falls, 0.9) },
    spawnGap: { mean: mean(spawnGaps), p10: percentile(spawnGaps, 0.1) },
    spells: {
      scrollEvery: mean(rs.flatMap((r) => gaps(r.spellScrolls))),
      collectedEvery: mean(rs.flatMap((r) => gaps(r.spellsCollected))),
      castEvery: mean(rs.flatMap((r) => gaps(r.casts.map((c) => c.t)))),
      castsPerMinute: minutes > 0 ? rs.reduce((a, r) => a + r.casts.length, 0) / minutes : 0,
    },
    thirds: [phase(0), phase(1), phase(2)],
  };
}

function run(plan: RunPlan | null, config: Parameters<typeof simulate>[0]['config'], mode: Mode, wpm: number, casts: boolean, maxSeconds: number, sampleEvery = 1) {
  return summarize(Array.from({ length: SEEDS }, (_, i) =>
    simulate({ plan: plan ?? undefined, config, hardcore: mode === 'hardcore', words: WORDS, seed: 5000 + 131 * i, typist: typist(wpm, casts), maxSeconds, sampleEvery })));
}

const results: Record<string, unknown>[] = [];
const SPEEDS = [45, 60, 90, 120, 200];
for (const mode of ['normal', 'hardcore'] as Mode[]) {
  // Opening Trial (no spells), and the same trial if SLOW were available: does SLOW help?
  for (const wpm of SPEEDS) {
    results.push({ scenario: 'opening', mode, wpm, ...run(openingRun(mode), undefined, mode, wpm, false, 600) });
    const withSlow = openingRun(mode);
    // Measurement only: the Opening Trial stays spell-free (D-112).
    const slowPlan: RunPlan = { ...withSlow, segments: withSlow.segments.map((seg) => ({ ...seg, config: { ...seg.config, availableSpells: ['slow'], introducesSpell: 'slow', spellDropChance: 0.144 } })) };
    results.push({ scenario: 'opening+slow', mode, wpm, ...run(slowPlan, undefined, mode, wpm, true, 600) });
  }
  // Academy apprenticeships, typists who cast
  for (const trial of quick ? [1, 5, 9] : [1, 3, 5, 8, 9])
    for (const wpm of SPEEDS) results.push({ scenario: 'academy', mode, trial, wpm, ...run(apprenticeshipRun(mode, trial), undefined, mode, wpm, true, 1500) });
  // Endless, typists who cast
  for (const trial of [1, 9])
    for (const wpm of quick ? [90, 200] : [60, 120, 200]) results.push({ scenario: 'endless', mode, trial, wpm, ...run(null, apprenticeshipEndless(mode, trial), mode, wpm, true, 3600, 2) });
}
writeFileSync(out, JSON.stringify(results, null, 1));
const pct = (v: number) => `${Math.round(v * 100)}%`;
for (const r of results as Record<string, any>[]) {
  console.log(`${r.scenario.padEnd(12)} ${r.mode.padEnd(8)} ${String(r.trial ?? '').padStart(1)} ${String(r.wpm).padStart(3)}wpm | clear ${pct(r.cleared).padStart(4)} ${(r.seconds / 60).toFixed(1).padStart(5)}m | act ${r.active.mean.toFixed(1)}/${r.active.p95.toFixed(0)} urg ${r.urgent.mean.toFixed(1)}/${r.urgent.p95.toFixed(0)} work ${r.workload.mean.toFixed(0)}/${r.workload.p95.toFixed(0)} req ${r.requiredLps.mean.toFixed(1)}/${r.requiredLps.p95.toFixed(1)} | len ${r.length.mean.toFixed(1)} ≤4 ${pct(r.length.short)} ≥7 ${pct(r.length.long)} | fall ${r.fall.p10.toFixed(1)}/${r.fall.p50.toFixed(1)} gap ${r.spawnGap.mean.toFixed(2)} | cast/min ${r.spells.castsPerMinute.toFixed(1)} every ${r.spells.castEvery.toFixed(0)}s | imp ${r.impacts.toFixed(2)} ovl ${r.overlaps.toFixed(2)} ${Object.entries(r.failures).map(([k, v]) => `${k}:${v}`).join(' ')}`);
}
