/**
 * D-123 report: immediate gratification and progressive mastery.
 * Seeded simulations of the Opening Trial, Academy Normal and the Crosswind
 * Trial across typing speeds, measuring:
 * - word lengths;
 * - time to the first capture, Combo ×2 and Arcane Rush;
 * - capture cadence and keystroke workload (Enter included);
 * - urgency, idle time, spell use and survival.
 *
 * Usage: bun tools/gratification-report.ts out.json [quick]
 * Diagnostic only: synthetic typists are not human players.
 */
import { writeFileSync } from 'node:fs';
import { WORDS } from '../src/data/wordList';
import { percentile, simulate, typistAt, type RunReport } from '../src/difficulty/DirectorSimulation';
import { apprenticeshipRun, openingRun, SPELL_ORDER, TRIALS } from '../src/typel/apprenticeship';
import { arcaneTrialConfig, CROSSWIND } from '../src/typel/arcaneTrials';
import { startingBank } from '../src/typel/progression';

const out = process.argv[2] ?? 'gratification.json';
const quick = process.argv[3] === 'quick';
const SEEDS = quick ? 2 : 4;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const med = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)]! : null;
};

function summarize(reps: RunReport[]) {
  const all = reps.flatMap((r) => r.timeline);
  const lengths = reps.flatMap((r) => r.spawns.map((s) => s.length));
  const minutes = reps.reduce((a, r) => a + r.seconds / 60, 0);
  const gaps = reps.flatMap((r) => r.captureTimes.slice(1).map((t, i) => t - r.captureTimes[i]!));
  return {
    cleared: reps.filter((r) => r.status === 'won').length / reps.length,
    minutes: mean(reps.map((r) => r.seconds / 60)),
    length: { mean: mean(lengths), le3: lengths.filter((n) => n <= 3).length / lengths.length, four: lengths.filter((n) => n === 4).length / lengths.length, ge7: lengths.filter((n) => n >= 7).length / lengths.length },
    firstCapture: med(reps.map((r) => r.firsts.capture)),
    firstCombo2: med(reps.map((r) => r.firsts.combo2)),
    firstRush: med(reps.map((r) => r.firsts.rush)),
    capturesPerMin: reps.reduce((a, r) => a + r.captureTimes.length, 0) / minutes,
    captureGapP50: gaps.length ? percentile(gaps, 0.5) : null,
    keystrokesPerMin: reps.reduce((a, r) => a + r.keystrokes, 0) / minutes,
    active: mean(all.map((s) => s.words)),
    urgent: { mean: mean(all.map((s) => s.urgent)), p95: percentile(all.map((s) => s.urgent), 0.95) },
    idleShare: all.filter((s) => s.words === 0).length / all.length,
    castsPerMin: reps.reduce((a, r) => a + r.casts.length, 0) / minutes,
    peakRush: mean(reps.map((r) => r.peakRush)),
    maxCombo: mean(reps.map((r) => r.maxCombo)),
  };
}

const rows: Record<string, unknown>[] = [];
const f = (x: number | null, d = 1) => (x === null || Number.isNaN(x) ? '—' : x.toFixed(d));
const run = (label: string, scenario: string, wpm: number, fn: (seed: number) => RunReport) => {
  const r = summarize(Array.from({ length: SEEDS }, (_, i) => fn(3000 + i * 41)));
  rows.push({ scenario, wpm, ...r });
  console.log(`${label.padEnd(14)} ${String(wpm).padStart(3)} | clear ${f(r.cleared * 100, 0).padStart(3)}% ${f(r.minutes)}m | len ${f(r.length.mean, 2)} ≤3 ${f(r.length.le3 * 100, 0)}% 4 ${f(r.length.four * 100, 0)}% ≥7 ${f(r.length.ge7 * 100, 0)}% | 1st cap ${f(r.firstCapture)}s combo×2 ${f(r.firstCombo2)}s rush ${f(r.firstRush)}s | cap/min ${f(r.capturesPerMin, 0)} gap50 ${f(r.captureGapP50, 2)}s keys/min ${f(r.keystrokesPerMin, 0)} | act ${f(r.active)} urg ${f(r.urgent.mean)}/${f(r.urgent.p95, 0)} idle ${f(r.idleShare * 100)}% | cast/min ${f(r.castsPerMin)} rush ${f(r.peakRush, 2)} combo ${f(r.maxCombo, 0)}`);
};

const WPMS = quick ? [45, 90] : [35, 45, 60, 90, 120];
for (const wpm of WPMS)
  run('opening', 'opening', wpm, (seed) => simulate({ plan: openingRun('normal'), words: WORDS, seed, typist: typistAt(wpm), maxSeconds: 900, sampleEvery: 0.5 }));
for (const trial of quick ? [1, 5] : [1, 2, 3, 5, 8])
  for (const wpm of WPMS) {
    const spells = SPELL_ORDER.slice(0, Math.min(8, trial));
    run(`academy T${trial}`, `academy-T${trial}`, wpm, (seed) => simulate({
      plan: apprenticeshipRun('normal', trial, 'learn', { spells }), words: WORDS, seed, typist: { ...typistAt(wpm), casts: true }, maxSeconds: 1500, sampleEvery: 0.5,
      initialSpells: startingBank(TRIALS[trial - 1]!, spells),
    }));
  }
for (const wpm of quick ? [90] : [60, 90, 120])
  for (const casts of [true, false])
    run(`crosswind ${casts ? 'spl' : 'hnd'}`, `crosswind-${casts ? 'spells' : 'hands'}`, wpm, (seed) => simulate({
      config: arcaneTrialConfig(CROSSWIND), words: WORDS, seed, typist: { ...typistAt(wpm), casts }, maxSeconds: 1800, sampleEvery: 0.5, initialSpells: CROSSWIND.startingBank,
    }));
writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(`wrote ${rows.length} rows to ${out}`);
