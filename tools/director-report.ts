/**
 * D-102 simulation report: the continuous apprenticeship and its Endless.
 * Run: npx tsx tools/director-report.ts [seeds] [out.json]
 * Deterministic: the same seeds give the same report.
 */
import { writeFileSync } from 'node:fs';
import { WORDS } from '../src/data/wordList';
import { DifficultyDirector, DIRECTOR_TUNING } from '../src/difficulty/DifficultyDirector';
import { eventDurations, eventGaps, percentile, simulate, typistAt } from '../src/difficulty/DirectorSimulation';
import { WordGenerator } from '../src/gameplay/WordGenerator';
import { SeededRandom } from '../src/core/Random';
import { apprenticeshipEndless, apprenticeshipRun, TRIALS, type Mode } from '../src/typel/apprenticeship';

const seeds = Number(process.argv[2] ?? 3);
const out = process.argv[3] ?? 'director-report.json';
const SPEEDS = [45, 60, 90, 120, 160, 200];
const MODES: Mode[] = ['normal', 'hardcore'];
const pct = (v: number) => `${Math.round(v * 100)}%`;

// A. Every apprenticeship, every typist.
const runs: Record<string, unknown>[] = [];
for (const mode of MODES)
  for (let t = 1; t <= 9; t++)
    for (const wpm of SPEEDS) {
      const rs = Array.from({ length: seeds }, (_, i) =>
        simulate({ plan: apprenticeshipRun(mode, t), hardcore: mode === 'hardcore', words: WORDS, seed: 1000 + 97 * i + t, typist: typistAt(wpm), maxSeconds: 1500, sampleEvery: 1 }));
      const pre = rs.flatMap((r) => r.timeline.filter((s) => s.phase === 'learn' || s.phase === 'master'));
      runs.push({
        mode, trial: t, wpm,
        cleared: rs.filter((r) => r.status === 'won').length / rs.length,
        endedIn: rs.filter((r) => r.status !== 'won').map((r) => r.endedIn),
        failures: rs.filter((r) => r.status === 'lost').map((r) => r.failure),
        minutes: rs.reduce((a, r) => a + r.seconds, 0) / rs.length / 60,
        score: Math.round(rs.reduce((a, r) => a + r.score, 0) / rs.length),
        maxCombo: Math.max(...rs.map((r) => r.maxCombo)),
        pressureGapMedian: percentile(eventGaps(pre, 'pressure'), 0.5),
        surgeGapMedian: percentile(eventGaps(pre, 'surge'), 0.5),
        recoveryMedian: percentile(eventDurations(pre, 'recovery'), 0.5),
        overlapMean: pre.reduce((a, s) => a + s.overlaps, 0) / Math.max(1, pre.length),
      });
    }

// B. Endless survival.
const endless: Record<string, unknown>[] = [];
for (const mode of MODES)
  for (const t of [1, 5, 8, 9])
    for (const wpm of SPEEDS) {
      const r = simulate({ config: apprenticeshipEndless(mode, t), hardcore: mode === 'hardcore', words: WORDS, seed: 77 + t, typist: typistAt(wpm), maxSeconds: 3600, sampleEvery: 2 });
      endless.push({ mode, trial: t, wpm, minutes: r.seconds / 60, lost: r.status === 'lost', failure: r.failure, levelAtEnd: r.timeline.at(-1)?.endlessLevel ?? null, score: r.score });
    }

// C. Endless bottleneck: when each bounded lever reaches its limit, and the arrival rate it allows.
const counts = new WordGenerator(WORDS, { minWordLength: 2, maxWordLength: 12 }, new SeededRandom(1)).lengthCounts();
const bottleneck: Record<string, unknown>[] = [];
for (const mode of MODES)
  for (const t of [1, 9]) {
    const cfg = apprenticeshipEndless(mode, t);
    const d = new DifficultyDirector(cfg.director!, 1, counts);
    const rows = [0, 5, 10, 20, 30, 45, 60, 90].map((min) => {
      const e = d.envelope({ progress: 0, seconds: 0, endlessSeconds: min * 60 });
      const spawnMs = Math.max(e.spawnFloorMs, cfg.spawnInterval * e.spawnScale);
      const maxActive = Math.max(3, Math.min(16, cfg.maxActiveWords + e.extraWords));
      const meanFall = (e.speedBands.slow[1] + e.speedBands.medium[1] + e.speedBands.fast[1]) / 3;
      const wordsPerSecond = Math.min(1000 / spawnMs, maxActive / meanFall);
      return { min, level: e.endlessLevel, spawnMs: Math.round(spawnMs), maxActive, overdrive: e.overdrive, meanFall, wordsPerSecond, lettersPerSecond: wordsPerSecond * e.expectedLength,
        limitedBy: 1000 / spawnMs < maxActive / meanFall ? 'spawn interval' : 'words on field ÷ fall time' };
    });
    bottleneck.push({ mode, trial: t, rows });
  }

writeFileSync(out, JSON.stringify({ seeds, tuning: DIRECTOR_TUNING, runs, endless, bottleneck }, null, 1));

console.log('\nA. Continuous apprenticeship: clear rate by typist (endedIn: l = Learn, m = Master, b = Boss)');
for (const mode of MODES) {
  console.log(`\n${mode} | ${SPEEDS.map((w) => `${w} WPM`).join(' | ')}`);
  for (let t = 1; t <= 9; t++) {
    const cells = SPEEDS.map((wpm) => {
      const r = runs.find((x) => x.mode === mode && x.trial === t && x.wpm === wpm)!;
      const where = (r.endedIn as string[]).map((e) => e[0]).join('');
      return `${pct(r.cleared as number)}${where ? ` ${where}` : ''}`;
    });
    console.log(`${t} ${TRIALS[t - 1]!.title.replace('The Apprenticeship of ', '')} | ${cells.join(' | ')}`);
  }
}
console.log('\nB. Endless survival (minutes, failure cause)');
for (const r of endless) console.log(`${r.mode} ${r.trial} ${r.wpm} WPM: ${(r.minutes as number).toFixed(1)} min ${r.lost ? '' : '(still alive)'} ${r.failure} L=${(r.levelAtEnd as number)?.toFixed(2)}`);
console.log('\nC. Endless bottleneck');
for (const b of bottleneck) for (const row of b.rows as Record<string, number | string>[])
  console.log(`${b.mode} ${b.trial} ${row.min} min: L ${(row.level as number).toFixed(2)} spawn ${row.spawnMs} ms, max ${row.maxActive}, overdrive ×${(row.overdrive as number).toFixed(2)}, ${(row.wordsPerSecond as number).toFixed(2)} words/s (${(row.lettersPerSecond as number).toFixed(1)} letters/s), limited by ${row.limitedBy}`);
const cad = runs.filter((r) => r.wpm === 200);
console.log(`\nD. Cadence (200 WPM runs): pressure gap median ${percentile(cad.map((r) => r.pressureGapMedian as number), 0.5).toFixed(1)} s, surge gap median ${percentile(cad.map((r) => r.surgeGapMedian as number), 0.5).toFixed(1)} s, recovery ${percentile(cad.map((r) => r.recoveryMedian as number), 0.5).toFixed(1)} s, overlapping word pairs ${(cad.reduce((a, r) => a + (r.overlapMean as number), 0) / cad.length).toFixed(2)} on average`);
