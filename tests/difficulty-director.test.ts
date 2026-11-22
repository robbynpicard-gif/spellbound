import { describe, expect, it } from 'vitest';
import { GameEngine, type Command } from '../src/core/GameEngine';
import { FIELD } from '../src/core/GameConfig';
import { SeededRandom } from '../src/core/Random';
import { WORDS } from '../src/data/wordList';
import { DIRECTOR_TUNING, DifficultyDirector, journeyPosition, rise, type DirectorSettings, type SpawnPlan } from '../src/difficulty/DifficultyDirector';
import { demand, quadrantOf, simulateLevel } from '../src/difficulty/DirectorSimulation';
import { trialLevel, trialEndless, sandboxConfig, BOSS_LEVEL } from '../src/typel/apprenticeship';

const dir = (s: Partial<DirectorSettings> = {}) => new DifficultyDirector({ mode: 'normal', position: 0, encounter: 'level', ...s }, FIELD.height);

function sample(d: DifficultyDirector, n: number, seed = 7, progress?: number, lap = 0): SpawnPlan[] {
  const rng = new SeededRandom(seed);
  const pr = new SeededRandom(seed ^ 99);
  return Array.from({ length: n }, () => d.plan({ progress: progress ?? pr.next(), lap, longFastOnField: 0 }, rng));
}
const share = (plans: SpawnPlan[], l: string, s: string) => plans.filter((p) => p.lengthBand === l && p.speedBand === s).length / plans.length;

describe('Difficulty Director (D-097 prototype)', () => {
  it('first apprenticeship: all four length×speed quadrants appear, no length gate', () => {
    const plans = sample(dir(), 6000);
    for (const [l, s] of [['short', 'slow'], ['long', 'slow'], ['short', 'fast'], ['long', 'fast']])
      expect(share(plans, l, s)).toBeGreaterThan(0.02);
    expect(Math.max(...plans.map((p) => p.length))).toBeGreaterThanOrEqual(8);
    expect(Math.min(...plans.map((p) => p.length))).toBeLessThanOrEqual(3);
  });

  it('last apprenticeship keeps short+slow relief but is statistically harder', () => {
    const first = sample(dir({ position: 0 }), 6000);
    const last = sample(dir({ position: 1 }), 6000);
    expect(share(last, 'short', 'slow')).toBeGreaterThan(0.1);
    const mean = (ps: SpawnPlan[]) => ps.reduce((a, p) => a + demand(p), 0) / ps.length;
    expect(mean(last)).toBeGreaterThan(mean(first) * 1.3);
    const peak = (ps: SpawnPlan[]) => [...ps].map(demand).sort((a, b) => a - b)[Math.floor(ps.length * 0.95)]!;
    expect(peak(last)).toBeGreaterThan(peak(first));
  });

  it('samples length and speed jointly: distinct long+slow and short+fast scenarios', () => {
    const plans = sample(dir({ position: 0.5 }), 6000);
    const longSlow = plans.filter((p) => p.lengthBand === 'long' && p.speedBand === 'slow');
    const shortFast = plans.filter((p) => p.lengthBand === 'short' && p.speedBand === 'fast');
    expect(longSlow.length).toBeGreaterThan(0);
    expect(shortFast.length).toBeGreaterThan(0);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(longSlow.map((p) => p.fallSeconds))).toBeGreaterThan(avg(shortFast.map((p) => p.fallSeconds)) * 1.25);
    expect(avg(longSlow.map((p) => p.length))).toBeGreaterThan(avg(shortFast.map((p) => p.length)) + 3);
  });

  it('pressure inside an encounter is convex, with relief windows', () => {
    const k = DIRECTOR_TUNING.riseK.level;
    for (let p = 0.1; p < 0.95; p += 0.1) expect(rise(p + 0.05, k) - 2 * rise(p, k) + rise(p - 0.05, k)).toBeGreaterThan(0);
    const d = dir({ position: 0.4 });
    expect(d.pressure(1) - d.pressure(0.7)).toBeGreaterThan(d.pressure(0.3) - d.pressure(0));
    // a relief window dips below the pressure just before it
    expect(d.pressure(0.42)).toBeLessThan(d.pressure(0.36));
    expect(d.pressure(0.74)).toBeLessThan(d.pressure(0.66));
  });

  it('the floor rises slowly and monotonically across the journey', () => {
    let last = -1;
    for (let t = 1; t <= 9; t++) {
      const f = dir({ position: journeyPosition(t, 1) }).floor;
      expect(f).toBeGreaterThan(last);
      last = f;
    }
    expect(dir({ position: 1 }).floor - dir({ position: 0 }).floor).toBeLessThan(0.5);
  });

  it('is bounded: speed cap, fairness floor, saturating Endless laps', () => {
    for (const mode of ['normal', 'hardcore'] as const)
      for (const encounter of ['level', 'boss', 'endless'] as const)
        for (const position of [0, 0.5, 1])
          for (const lap of [0, 3, 50]) {
            const d = dir({ mode, encounter, position });
            expect(d.ceiling(lap)).toBeLessThanOrEqual(1);
            for (const p of sample(d, 400, 3, undefined, lap)) {
              expect(p.fallSeconds).toBeGreaterThanOrEqual(DIRECTOR_TUNING.minFallSeconds[mode] - 1e-9);
              expect(p.fallSeconds).toBeGreaterThanOrEqual(d.fairSeconds(p.length) - 1e-9);
            }
          }
    const e = dir({ encounter: 'endless', position: 1 });
    expect(e.speedFactor(1, 1000)).toBeLessThan(e.speedFactor(1, 10) * 1.05);
  });

  it('limits simultaneous long+fast words', () => {
    const d = dir({ position: 0 });
    const rng = new SeededRandom(5);
    for (let i = 0; i < 3000; i++) {
      const p = d.plan({ progress: 0, lap: 0, longFastOnField: 1 }, rng);
      expect(p.lengthBand === 'long' && p.speedBand === 'fast').toBe(false);
    }
  });

  it('is deterministic for a seed', () => {
    expect(sample(dir({ position: 0.3 }), 500, 42)).toEqual(sample(dir({ position: 0.3 }), 500, 42));
  });

  it('classic difficulty is unchanged unless the director is chosen', () => {
    expect(trialLevel('normal', 1, 1).director).toBeUndefined();
    expect(trialLevel('normal', 1, 1).maxWordLength).toBe(4);
    const d = trialLevel('normal', 1, 1, 'director');
    expect(d.director?.position).toBe(0);
    expect(d.maxWordLength).toBeGreaterThanOrEqual(9);
    expect(d.requiredWords).toBe(trialLevel('normal', 1, 1).requiredWords);
    expect(trialLevel('normal', 9, BOSS_LEVEL, 'director').director?.encounter).toBe('boss');
    expect(trialEndless('hardcore', 9, 'director').escalation).toBeNull();
    expect(sandboxConfig('normal', 3, 'director').director?.encounter).toBe('endless');
  });
});

describe('Director in the engine', () => {
  it('first lesson spawns long words and fast words through the real engine', () => {
    const spawns = [11, 12, 13, 14, 15, 16].flatMap((seed) => simulateLevel(trialLevel('normal', 1, 6, 'director'), seed, WORDS, { cps: 4, reaction: 0.3 }, 200).spawns);
    expect(spawns.every((s) => s.pressure !== null)).toBe(true);
    const quads = new Set(spawns.map(quadrantOf));
    for (const q of ['short-slow', 'long-slow', 'short-fast', 'long-fast']) expect(quads.has(q as never)).toBe(true);
  });

  it('replaying a seed and its commands reproduces every word, speed and timing', () => {
    const config = trialLevel('normal', 4, 8, 'director');
    const options = { config, seed: 2024, words: WORDS, experimentalScoring: true };
    const live = new GameEngine(options);
    const seen: string[] = [];
    live.events.on('wordSpawned', ({ word }) => seen.push(`${live.state.tick}:${word.text}:${word.speed.toFixed(6)}`));
    for (let t = 0; t < 2400; t++) {
      const w = [...live.state.words].sort((a, b) => b.y - a.y)[0];
      if (w && t % 9 === 0) {
        if (live.state.input.length < w.match.length && w.match.startsWith(live.state.input)) live.typeChar(w.match[live.state.input.length]!);
        else live.submit();
      }
      live.step();
    }
    const replayedEngine = GameEngine.replay(options, live.commands as readonly Command[], live.state.tick);
    const snapshot = (e: GameEngine) => ({
      tick: e.state.tick,
      spawned: e.state.nextWordId,
      score: e.state.score,
      words: e.state.words.map((w) => `${w.text}:${w.y.toFixed(6)}:${w.speed.toFixed(6)}`),
    });
    expect(snapshot(replayedEngine)).toEqual(snapshot(live));
    const replayed = seen;
    expect(replayed.length).toBeGreaterThan(20);
  });
});
