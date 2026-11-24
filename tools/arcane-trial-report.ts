/**
 * D-120 Arcane Trial prototype report: deterministic simulations of one
 * representative trial across typing speeds and accuracy, with spells and
 * without, and with the authored fixed profile versus Academy-style
 * adaptation ('both') and upward-only adaptation ('up').
 *
 * Usage: bun tools/arcane-trial-report.ts out.json [quick]
 * Diagnostic only: synthetic typists are not human players.
 */
import { writeFileSync } from 'node:fs';
import { WORDS } from '../src/data/wordList';
import { percentile, simulate, typistAt, type RunReport, type Typist } from '../src/difficulty/DirectorSimulation';
import { arcaneTrialConfig, CROSSWIND, type TrialAdaptation } from '../src/typel/arcaneTrials';

const out = process.argv[2] ?? 'arcane-trial.json';
const quick = process.argv[3] === 'quick';
const SEEDS = quick ? 3 : 6;
const SAMPLE = 0.5;

type Band = 'clean' | 'sloppy';
const typist = (wpm: number, band: Band, casts: boolean): Typist => {
  const t = typistAt(wpm);
  return { ...t, errorRate: band === 'sloppy' ? Math.min(0.12, t.errorRate * 2.5) : t.errorRate, casts };
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function summarize(reps: RunReport[]) {
  const all = reps.flatMap((r) => r.timeline);
  const won = reps.filter((r) => r.status === 'won');
  let longestIdle = 0;
  for (const r of reps) {
    let run = 0;
    for (const s of r.timeline) longestIdle = Math.max(longestIdle, (run = s.words === 0 ? run + 1 : 0) * SAMPLE);
  }
  // Pressure fluctuation: how often the field's urgency crosses between calm (≤1 urgent) and a peak (≥4).
  let peaks = 0;
  let minutes = 0;
  for (const r of reps) {
    let inPeak = false;
    for (const s of r.timeline) {
      if (!inPeak && s.urgent >= 4) (inPeak = true), peaks++;
      else if (inPeak && s.urgent <= 1) inPeak = false;
    }
    minutes += r.seconds / 60;
  }
  const casts = reps.flatMap((r) => r.casts);
  const bySpell: Record<string, number> = {};
  for (const c of casts) bySpell[c.spell] = (bySpell[c.spell] ?? 0) + 1;
  const totalScore = reps.reduce((a, r) => a + r.score, 0);
  const spellPts = reps.reduce((a, r) => a + r.spellPoints, 0);
  const runePts = reps.reduce((a, r) => a + r.runePoints, 0);
  return {
    runs: reps.length,
    cleared: won.length / reps.length,
    minutes: { all: mean(reps.map((r) => r.seconds / 60)), won: mean(won.map((r) => r.seconds / 60)), wonMin: won.length ? Math.min(...won.map((r) => r.seconds / 60)) : null, wonMax: won.length ? Math.max(...won.map((r) => r.seconds / 60)) : null },
    lostAtMinutes: reps.filter((r) => r.status === 'lost').map((r) => +(r.seconds / 60).toFixed(1)),
    active: { mean: mean(all.map((s) => s.words)), p95: percentile(all.map((s) => s.words), 0.95) },
    urgent: { mean: mean(all.map((s) => s.urgent)), p95: percentile(all.map((s) => s.urgent), 0.95) },
    impacts: mean(all.map((s) => s.impacts)),
    idleShare: all.filter((s) => s.words === 0).length / Math.max(1, all.length),
    longestIdle,
    peaksPerMin: peaks / Math.max(1e-6, minutes),
    castsPerMin: casts.length / Math.max(1e-6, minutes),
    bySpell,
    typedShare: totalScore > 0 ? (totalScore - spellPts - runePts) / totalScore : 0,
    spellShare: totalScore > 0 ? spellPts / totalScore : 0,
    meanLength: mean(reps.flatMap((r) => r.spawns.map((s) => s.length))),
    longShare: (() => { const l = reps.flatMap((r) => r.spawns.map((s) => s.length)); return l.filter((n) => n >= 7).length / Math.max(1, l.length); })(),
    score: mean(reps.map((r) => r.score)),
  };
}

const rows: Record<string, unknown>[] = [];
const WPMS = quick ? [60, 90, 120] : [45, 60, 75, 90, 120, 160];
const f = (x: number, d = 1) => x.toFixed(d);
for (const adaptation of ['off', 'both', 'up'] as TrialAdaptation[])
  for (const wpm of WPMS)
    for (const band of (adaptation === 'off' ? ['clean', 'sloppy'] : ['clean']) as Band[])
      for (const casts of adaptation === 'off' && band === 'clean' ? [true, false] : [true]) {
        const config = arcaneTrialConfig(CROSSWIND, adaptation);
        const reps = Array.from({ length: SEEDS }, (_, i) => simulate({
          config, words: WORDS, seed: 2000 + i * 53, typist: typist(wpm, band, casts), maxSeconds: 1800, sampleEvery: SAMPLE,
          initialSpells: CROSSWIND.startingBank,
        }));
        const r = summarize(reps);
        rows.push({ trial: CROSSWIND.id, adaptation, wpm, band, casts, ...r });
        console.log(`${adaptation.padEnd(4)} ${String(wpm).padStart(3)}wpm ${band.padEnd(6)} ${casts ? 'spells' : 'hands '} | clear ${f(r.cleared * 100, 0).padStart(3)}% won ${f(r.minutes.won)}m [${r.minutes.wonMin === null ? '—' : f(r.minutes.wonMin)}–${r.minutes.wonMax === null ? '—' : f(r.minutes.wonMax)}] lost@${JSON.stringify(r.lostAtMinutes)} | act ${f(r.active.mean)}/${f(r.active.p95, 0)} urg ${f(r.urgent.mean)}/${f(r.urgent.p95, 0)} imp ${f(r.impacts, 2)} | idle ${f(r.idleShare * 100)}% longest ${f(r.longestIdle)}s peaks/min ${f(r.peaksPerMin, 2)} | cast/min ${f(r.castsPerMin)} typed ${f(r.typedShare * 100, 0)}% spell ${f(r.spellShare * 100, 0)}% | len ${f(r.meanLength, 2)} ≥7 ${f(r.longShare * 100, 0)}%`);
      }
writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(`wrote ${rows.length} rows to ${out}`);
