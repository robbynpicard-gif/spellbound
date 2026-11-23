import { describe, expect, it } from 'vitest';
import { FIELD } from '../src/core/GameConfig';
import { GameEngine, SPAWN_FAIRNESS } from '../src/core/GameEngine';
import { SeededRandom } from '../src/core/Random';
import { measurePressure } from '../src/difficulty/BattlefieldPressure';
import { DIRECTOR_TUNING, DifficultyDirector, lengthWindowAt, validateDirectorSpec, type DirectorSpec } from '../src/difficulty/DifficultyDirector';
import { simulate, typistAt } from '../src/difficulty/DirectorSimulation';
import { WORDS } from '../src/data/wordList';
import { WordGenerator } from '../src/gameplay/WordGenerator';
import { apprenticeshipEndless, apprenticeshipRun, openingRun } from '../src/typel/apprenticeship';

const H = FIELD.height;
const COUNTS = new WordGenerator(WORDS, { minWordLength: 2, maxWordLength: 12 }, new SeededRandom(1)).lengthCounts();
const word = (match: string, y: number, speed: number) => ({ match, typed: 0, y, speed });

/** D-113: battlefield pressure is measured, readable and fair. */
describe('battlefield pressure metric', () => {
  it('counts urgent scrolls, workload and near-simultaneous impacts', () => {
    const p = measurePressure([word('ash', H - 60, 30), word('ember', H - 70, 30), word('river', 0, 30)]);
    expect(p.active).toBe(3);
    expect(p.urgent).toBe(2); // 2 s and 2.3 s from the Ward
    expect(p.impacts).toBe(1); // those two land 0.33 s apart
    expect(p.workload).toBe(8);
    expect(p.requiredLps).toBeGreaterThan(0);
  });

  it('is empty for an empty field', () => {
    expect(measurePressure([])).toMatchObject({ active: 0, urgent: 0, workload: 0, impacts: 0 });
  });
});

describe('D-113 tuning', () => {
  it('vocabulary decouples the words from the pressure position', () => {
    const early = lengthWindowAt({ apprenticeship: 0, arcPosition: 0.5 }, 0.8);
    const spec: DirectorSpec = { version: 2, mode: 'normal', apprenticeship: 0.9, kind: 'run', referenceLength: 5, vocabulary: 0 };
    expect(validateDirectorSpec(spec)).toEqual([]);
    expect(validateDirectorSpec({ ...spec, vocabulary: 2 })).not.toEqual([]);
    const env = new DifficultyDirector(spec, 3, COUNTS).envelope({ progress: 0.5, seconds: 60 });
    expect(env.lengthWindow.lo).toBeCloseTo(early.lo, 5);
    expect(env.lengthWindow.hi).toBeCloseTo(early.hi, 5);
  });

  it('early apprenticeships keep short and medium windows for longer', () => {
    const t3 = lengthWindowAt({ apprenticeship: 2 / 8, arcPosition: 1 }, 0.5);
    expect(t3.hi).toBeLessThanOrEqual(6.6);
    expect(t3.tilt).toBeLessThan(0.5);
    const t9 = lengthWindowAt({ apprenticeship: 1, arcPosition: 1 }, 0.5);
    expect(t9.tilt).toBeCloseTo(1, 5);
  });

  it('the Opening Trial mostly uses short and medium words, and its pressure rises', () => {
    const r = simulate({ plan: openingRun('normal'), words: WORDS, seed: 11, typist: typistAt(90), maxSeconds: 600, pressureControl: false });
    const lengths = r.spawns.map((s) => s.length);
    const long = lengths.filter((n) => n >= 7).length / lengths.length;
    expect(long).toBeLessThanOrEqual(0.06);
    expect(lengths.reduce((a, b) => a + b, 0) / lengths.length).toBeLessThan(5);
    const third = Math.floor(r.spawns.length / 3);
    const gap = (xs: typeof r.spawns) => (xs[xs.length - 1]!.seconds - xs[0]!.seconds) / (xs.length - 1);
    expect(gap(r.spawns.slice(-third))).toBeLessThan(gap(r.spawns.slice(0, third)));
  });

  it('new Director scrolls avoid landing with another when a small slowdown allows it', () => {
    const plan = apprenticeshipRun('normal', 7);
    let checked = 0;
    let clashes = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const engine = new GameEngine({ config: plan.segments[0]!.config, run: plan, seed, words: WORDS, experimentalScoring: true });
      engine.events.on('wordSpawned', ({ word: w }) => {
        const own = (H - w.y) / w.speed;
        const others = engine.state.words.filter((o) => o.id !== w.id && o.speed > 0 && o.y < H).map((o) => (H - o.y) / o.speed);
        checked++;
        if (others.some((a) => Math.abs(a - own) < SPAWN_FAIRNESS.impactGapSeconds - 1e-6)) clashes++;
      });
      for (let i = 0; i < 60 * 240 && engine.status === 'playing'; i++) engine.step();
    }
    expect(checked).toBeGreaterThan(60);
    expect(clashes / checked).toBeLessThan(0.1);
  });

  it('Endless bursts grow with time but stay bounded', () => {
    const t = DIRECTOR_TUNING;
    expect(t.endlessBurst.spawnCap).toBeLessThan(1);
    const spec = apprenticeshipEndless('normal', 9).director!;
    const d = new DifficultyDirector({ ...spec, kind: 'endless' }, 4, COUNTS);
    for (const s of [600, 3600, 7200, 36000]) {
      const env = d.envelope({ progress: 1, seconds: s, endlessSeconds: s });
      expect(Number.isFinite(env.spawnScale)).toBe(true);
      expect(env.spawnScale).toBeGreaterThan(0);
    }
  });
});
