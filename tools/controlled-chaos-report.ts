/**
 * D-116 controlled-chaos report: deterministic simulations of the Opening
 * Trial, Academy Normal, Hardcore and Endless across typing speeds and
 * accuracy bands, with the pressure controller on and off.
 *
 * Usage: bun tools/controlled-chaos-report.ts out.json [quick]
 * Diagnostic only: synthetic typists are not human players.
 */
import { writeFileSync } from 'node:fs';
import { WORDS } from '../src/data/wordList';
import { percentile, simulate, typistAt, type RunReport, type Typist } from '../src/difficulty/DirectorSimulation';
import { apprenticeshipEndless, apprenticeshipRun, openingRun, SPELL_ORDER, type Mode } from '../src/typel/apprenticeship';
import { startingBank } from '../src/typel/progression';
import { TRIALS } from '../src/typel/apprenticeship';

const out = process.argv[2] ?? 'controlled-chaos.json';
const quick = process.argv[3] === 'quick';
const SEEDS = quick ? 2 : 3;
const SAMPLE = 0.5;

type Band = 'clean' | 'sloppy';
const typist = (wpm: number, band: Band, casts: boolean): Typist => {
  const t = typistAt(wpm);
  return { ...t, errorRate: band === 'sloppy' ? Math.min(0.12, t.errorRate * 2.5) : t.errorRate, casts };
};

interface Row {
  scenario: string; mode: Mode; trial: number | null; wpm: number; band: Band; control: 'on' | 'off';
  runs: number; cleared: number; seconds: number;
  idleShare: number; longestIdle: number; lowShare: number;
  active: { mean: number; p95: number }; urgentP95: number;
  offset: { mean: number; last: number; min: number; max: number }; reversalsPerMin: number;
  castsPerMin: number; reliefSeconds: number | null;
}

function summarize(base: Omit<Row, 'runs' | 'cleared' | 'seconds' | 'idleShare' | 'longestIdle' | 'lowShare' | 'active' | 'urgentP95' | 'offset' | 'reversalsPerMin' | 'castsPerMin' | 'reliefSeconds'>, reps: RunReport[]): Row {
  const all = reps.flatMap((r) => r.timeline);
  const idle = all.filter((s) => s.words === 0).length;
  const low = all.filter((s) => s.workload < 4 && s.urgent === 0).length;
  let longest = 0;
  for (const r of reps) {
    let run = 0;
    for (const s of r.timeline) {
      run = s.words === 0 ? run + 1 : 0;
      longest = Math.max(longest, run * SAMPLE);
    }
  }
  const offsets = all.map((s) => s.offset).filter((x): x is number => x !== null);
  // Oscillation: direction changes of the offset's 5-second trend, ignoring changes under 0.02.
  let reversals = 0;
  let minutes = 0;
  for (const r of reps) {
    const pts = r.timeline.filter((_, i) => i % Math.round(5 / SAMPLE) === 0).map((s) => s.offset ?? 0);
    let dir = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i]! - pts[i - 1]!;
      if (Math.abs(d) < 0.02) continue;
      const nd = Math.sign(d);
      if (dir !== 0 && nd !== dir) reversals++;
      dir = nd;
    }
    minutes += r.seconds / 60;
  }
  // Relief: after a field-clearing spell, seconds until the field holds as many scrolls as just before it.
  const relief: number[] = [];
  for (const r of reps)
    for (const c of r.casts) {
      if (!['fire', 'harvest', 'shock', 'wind'].includes(c.spell)) continue;
      const before = r.timeline.filter((s) => s.t <= c.t).at(-1);
      if (!before || before.words < 3) continue;
      const back = r.timeline.find((s) => s.t > c.t + 0.5 && s.words >= before.words);
      if (back) relief.push(back.t - c.t);
    }
  return {
    ...base,
    runs: reps.length,
    cleared: reps.filter((r) => r.status === 'won').length / reps.length,
    seconds: reps.reduce((a, r) => a + r.seconds, 0) / reps.length,
    idleShare: idle / Math.max(1, all.length),
    longestIdle: longest,
    lowShare: low / Math.max(1, all.length),
    active: { mean: all.reduce((a, s) => a + s.words, 0) / Math.max(1, all.length), p95: percentile(all.map((s) => s.words), 0.95) },
    urgentP95: percentile(all.map((s) => s.urgent), 0.95),
    offset: offsets.length
      ? { mean: offsets.reduce((a, b) => a + b, 0) / offsets.length, last: reps.reduce((a, r) => a + (r.timeline.at(-1)?.offset ?? 0), 0) / reps.length, min: Math.min(...offsets), max: Math.max(...offsets) }
      : { mean: 0, last: 0, min: 0, max: 0 },
    reversalsPerMin: reversals / Math.max(1e-6, minutes),
    castsPerMin: reps.reduce((a, r) => a + r.casts.length, 0) / Math.max(1e-6, minutes),
    reliefSeconds: relief.length ? percentile(relief, 0.5) : null,
  };
}

const rows: Row[] = [];
const run = (label: string, fn: (seed: number) => RunReport, base: Parameters<typeof summarize>[0]) => {
  const reps = Array.from({ length: SEEDS }, (_, i) => fn(1000 + i * 37));
  const row = summarize(base, reps);
  rows.push(row);
  const f = (x: number, d = 1) => x.toFixed(d);
  console.log(`${label.padEnd(30)} ${String(row.wpm).padStart(3)}wpm ${row.band.padEnd(6)} ${row.control.padEnd(3)} | clear ${f(row.cleared * 100, 0).padStart(3)}% ${f(row.seconds / 60)}m | idle ${f(row.idleShare * 100)}% longest ${f(row.longestIdle)}s low ${f(row.lowShare * 100, 0)}% | act ${f(row.active.mean)}/${f(row.active.p95, 0)} urg95 ${f(row.urgentP95, 0)} | L ${f(row.offset.mean, 2)} [${f(row.offset.min, 2)},${f(row.offset.max, 2)}] rev/min ${f(row.reversalsPerMin, 2)} | cast/min ${f(row.castsPerMin)} relief ${row.reliefSeconds === null ? '—' : f(row.reliefSeconds) + 's'}`);
};

const WPMS = quick ? [45, 90, 160] : [35, 45, 60, 90, 120, 160];
const TRIAL_SET = quick ? [1, 5, 9] : [1, 3, 5, 8, 9];
const allSpells = (trial: number) => SPELL_ORDER.slice(0, Math.min(8, trial));

for (const control of ['on', 'off'] as const) {
  const pc = control === 'off' ? (false as const) : undefined;
  for (const wpm of WPMS)
    run('opening', (seed) => simulate({ plan: openingRun('normal'), words: WORDS, seed, typist: typist(wpm, 'clean', false), maxSeconds: 900, sampleEvery: SAMPLE, pressureControl: pc }),
      { scenario: 'opening', mode: 'normal', trial: null, wpm, band: 'clean', control });
  for (const trial of TRIAL_SET)
    for (const wpm of WPMS)
      for (const band of (wpm === 60 || wpm === 120 ? ['clean', 'sloppy'] : ['clean']) as Band[]) {
        if (control === 'off' && band === 'sloppy') continue;
        const spells = allSpells(trial);
        run(`academy T${trial}`, (seed) => simulate({
          plan: apprenticeshipRun('normal', trial, 'learn', { spells }), words: WORDS, seed, typist: typist(wpm, band, true), maxSeconds: 1500, sampleEvery: SAMPLE,
          pressureControl: pc, initialSpells: startingBank(TRIALS[trial - 1]!, spells),
        }), { scenario: 'academy', mode: 'normal', trial, wpm, band, control });
      }
}
for (const trial of quick ? [5] : [3, 5, 8])
  for (const wpm of [90, 120, 160]) {
    // Hardcore with the full repertoire vs only the stage's own: the expanded-repertoire reward.
    for (const rep of ['stage', 'full'] as const) {
      const spells = rep === 'full' ? [...SPELL_ORDER] : allSpells(trial);
      run(`hardcore T${trial} ${rep}`, (seed) => simulate({
        plan: apprenticeshipRun('hardcore', trial, 'learn', { spells }), hardcore: true, words: WORDS, seed, typist: typist(wpm, 'clean', true), maxSeconds: 1500, sampleEvery: SAMPLE,
        initialSpells: startingBank(TRIALS[trial - 1]!, spells),
      }), { scenario: `hardcore-${rep}`, mode: 'hardcore', trial, wpm, band: 'clean', control: 'off' });
    }
  }
for (const control of ['on', 'off'] as const)
  for (const wpm of quick ? [160] : [90, 160, 200])
    run('endless T5', (seed) => simulate({
      config: apprenticeshipEndless('normal', 5, allSpells(5)), words: WORDS, seed, typist: typist(wpm, 'clean', true), maxSeconds: 3600, sampleEvery: 1,
      pressureControl: control === 'off' ? false : undefined, initialSpells: startingBank(TRIALS[4]!, allSpells(5)),
    }), { scenario: 'endless', mode: 'normal', trial: 5, wpm, band: 'clean', control });

writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(`wrote ${rows.length} rows to ${out}`);
