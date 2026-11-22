/**
 * D-097 Phase 2 simulation report: classic difficulty vs the Difficulty Director.
 * Run: npx tsx tools/director-report.ts [seeds] [out.json]
 * Deterministic: the same seeds give the same report.
 */
import { writeFileSync } from 'node:fs';
import { WORDS } from '../src/data/wordList';
import { simulateRun, summarize, type Summary, type Typist } from '../src/difficulty/DirectorSimulation';
import { BOSS_LEVEL, directorTrialLevel, trialLevel, type Mode } from '../src/typel/apprenticeship';

const seeds = Number(process.argv[2] ?? 24);
const out = process.argv[3] ?? 'director-report.json';
/** Reference typists: a steady intermediate for Normal, a stronger one for Hardcore. Measuring sticks, not predictions. */
const TYPISTS: Record<Mode, Typist> = { normal: { cps: 5, reactionMs: 300 }, hardcore: { cps: 6.5, reactionMs: 250 } };
const TRIALS = [1, 5, 9];
const LEVELS = [1, 6, 12, BOSS_LEVEL];

interface Row { mode: Mode; trial: number; level: number; system: 'classic' | 'director'; summary: Summary }
const rows: Row[] = [];
for (const mode of ['normal', 'hardcore'] as const)
  for (const trial of TRIALS)
    for (const level of LEVELS)
      for (const system of ['classic', 'director'] as const) {
        const config = system === 'classic' ? trialLevel(mode, trial, level) : directorTrialLevel(mode, trial, level);
        const reports = Array.from({ length: seeds }, (_, i) => simulateRun(config, WORDS, 1000 + i * 7919, TYPISTS[mode]));
        rows.push({ mode, trial, level, system, summary: summarize(reports, TYPISTS[mode]) });
      }

writeFileSync(out, JSON.stringify({ seeds, typists: TYPISTS, rows }, null, 1));
const pct = (v: number) => `${Math.round(v * 100)}%`;
console.log('mode     T  L  system   meanLen fall p10/p50/p90   SS   LS   SF   LF  tight  peakCps recov/min  secs  win  miss');
for (const r of rows) {
  const s = r.summary;
  console.log([r.mode.padEnd(8), String(r.trial).padStart(2), String(r.level).padStart(2), r.system.padEnd(8),
    s.meanLength.toFixed(2).padStart(6), `${s.fall.p10.toFixed(1)}/${s.fall.p50.toFixed(1)}/${s.fall.p90.toFixed(1)}`.padStart(15),
    pct(s.corners.shortSlow).padStart(4), pct(s.corners.longSlow).padStart(4), pct(s.corners.shortFast).padStart(4), pct(s.corners.longFast).padStart(4),
    pct(s.tightShare).padStart(5), s.peakRequiredCps.toFixed(2).padStart(7), s.recoveriesPerMinute.toFixed(2).padStart(8),
    s.meanSeconds.toFixed(0).padStart(5), pct(s.winRate).padStart(4), s.missesPerRun.toFixed(1).padStart(5)].join(' '));
}
