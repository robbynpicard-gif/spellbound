import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { FIELD } from '../src/core/GameConfig';
import { WORDS } from '../src/data/wordList';
import { validateLevels } from '../src/difficulty/DifficultyConfig';
import {
  arcShape, convexRise, DIRECTOR_TUNING, DifficultyDirector, endlessState, floorAt, lengthWindowAt, mixAt, pressureAt, speedBandsAt,
  validateDirectorSpec, type DirectorSpec, type SpawnPlan,
} from '../src/difficulty/DifficultyDirector';
import { simulateRun, summarize } from '../src/difficulty/DirectorSimulation';
import { WordGenerator } from '../src/gameplay/WordGenerator';
import { SeededRandom } from '../src/core/Random';
import {
  BOSS_LEVEL, directorSandboxConfig, directorTrialEndless, directorTrialLevel, LEVELS_PER_TRIAL, sandboxConfig, trialEndless, trialLevel,
} from '../src/typel/apprenticeship';
import { directorEnabled } from '../src/typel/directorFlag';

/**
 * D-097 acceptance tests for the Difficulty Director prototype. They check
 * the *shape* the owner approved (shared loop, joint length × speed, rising
 * floor, convex arcs, relief, bounds, determinism, no regressions). They do
 * not lock in tuning numbers, which remain experimental.
 */

const COUNTS = new WordGenerator(WORDS, { minWordLength: 2, maxWordLength: 12 }, new SeededRandom(1)).lengthCounts();
const spec = (over: Partial<DirectorSpec> = {}): DirectorSpec => ({
  version: 1, mode: 'normal', apprenticeship: 0, arcPosition: 0, kind: 'level', referenceLength: 4, surges: [], ...over,
});
/** Plans drawn across a whole encounter arc (progress 0 → 1). */
function plans(s: DirectorSpec, n: number, seed = 11): SpawnPlan[] {
  const d = new DifficultyDirector(s, seed, COUNTS);
  return Array.from({ length: n }, (_, i) => d.next({ progress: i / (n - 1), endlessSeconds: i }));
}
const corner = (p: SpawnPlan) => `${p.lengthBand}-${p.speedBand}`;
const share = (ps: SpawnPlan[], f: (p: SpawnPlan) => boolean) => ps.filter(f).length / ps.length;

describe('Difficulty Director: shared language from the first lesson (acceptance 1, 3)', () => {
  it('the first apprenticeship can produce all four corner quadrants with meaningful probability', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      const mix = mixAt(floorAt({ mode, apprenticeship: 0 }));
      for (const [i, j] of [[0, 0], [2, 0], [0, 2], [2, 2]] as const) expect(mix[i][j]).toBeGreaterThanOrEqual(0.02);
      const ps = plans(spec({ mode }), 4000);
      for (const c of ['short-slow', 'long-slow', 'short-fast', 'long-fast']) expect(share(ps, (p) => corner(p) === c)).toBeGreaterThan(0.015);
    }
  });

  it('samples length and speed jointly: short-fast and long-slow are distinct, common scenarios', () => {
    const ps = plans(spec({ apprenticeship: 0.5 }), 4000);
    expect(share(ps, (p) => corner(p) === 'short-fast')).toBeGreaterThan(0.05);
    expect(share(ps, (p) => corner(p) === 'long-slow')).toBeGreaterThan(0.05);
    // Not a single "difficulty" dial: long words are not simply always fast.
    const longFastGivenLong = share(ps.filter((p) => p.lengthBand === 'long'), (p) => p.speedBand === 'fast');
    expect(longFastGivenLong).toBeLessThan(0.6);
  });
});

describe('Difficulty Director: rising floor, preserved relief (acceptance 2)', () => {
  it('the floor rises monotonically and slowly across the apprenticeship journey', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      let last = -1;
      for (let t = 1; t <= 9; t++) {
        const f = floorAt({ mode, apprenticeship: (t - 1) / 8 });
        expect(f).toBeGreaterThanOrEqual(last);
        if (last >= 0) expect(f - last).toBeLessThan(0.15);
        last = f;
      }
    }
  });

  it('the last apprenticeship is statistically harder in typical and peak moments', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      const first = plans(spec({ mode, apprenticeship: 0, arcPosition: 0.9, surges: [0.35, 0.75] }), 3000);
      const last = plans(spec({ mode, apprenticeship: 1, arcPosition: 0.9, surges: [0.35, 0.75] }), 3000);
      const mean = (ps: SpawnPlan[], f: (p: SpawnPlan) => number) => ps.reduce((s, p) => s + f(p), 0) / ps.length;
      expect(mean(last, (p) => p.length)).toBeGreaterThan(mean(first, (p) => p.length));
      expect(mean(last, (p) => p.fallSeconds)).toBeLessThan(mean(first, (p) => p.fallSeconds));
      expect(mean(last, (p) => p.pressure)).toBeGreaterThan(mean(first, (p) => p.pressure));
      const peakShare = (ps: SpawnPlan[]) => share(ps.slice(-600), (p) => corner(p) === 'long-fast');
      expect(peakShare(last)).toBeGreaterThan(peakShare(first));
    }
  });

  it('the last apprenticeship still has short/slow relief and is never uniformly long and fast', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      const ps = plans(spec({ mode, apprenticeship: 1, arcPosition: 1, kind: 'boss', surges: [0.3, 0.6, 0.85] }), 4000);
      expect(share(ps, (p) => corner(p) === 'short-slow')).toBeGreaterThanOrEqual(DIRECTOR_TUNING.reliefReserve * 0.8);
      expect(share(ps, (p) => corner(p) === 'long-fast')).toBeLessThan(0.3);
      // Guaranteed relief: no run of reliefEvery spawns without a short/slow word.
      let since = 0;
      for (const p of ps) {
        since = corner(p) === 'short-slow' ? 0 : since + 1;
        expect(since).toBeLessThan(DIRECTOR_TUNING.reliefEvery);
      }
      // Pressure at its maximum keeps the relief reserve.
      expect(mixAt(1)[0][0]).toBeGreaterThanOrEqual(DIRECTOR_TUNING.reliefReserve - 1e-9);
    }
  });

  it('spikes are spaced: two long/fast words are never planned back to back early on', () => {
    const ps = plans(spec({ apprenticeship: 0, arcPosition: 1 }), 4000);
    let last = -Infinity;
    for (const p of ps) {
      if (corner(p) !== 'long-fast') continue;
      expect(p.spawnIndex - last).toBeGreaterThan(DIRECTOR_TUNING.spikeGap[0]);
      last = p.spawnIndex;
    }
  });
});

describe('Difficulty Director: nonlinear, bounded escalation (acceptance 4, 5)', () => {
  it('the encounter arc is convex, not a fixed linear ramp', () => {
    expect(convexRise(0.5, 2.6)).toBeLessThan(0.5);
    const s = spec();
    const p = (x: number) => pressureAt(s, { progress: x });
    expect(p(0.5) - p(0)).toBeLessThan(p(1) - p(0.5));
    // Second differences are positive away from recovery breathers.
    for (const x of [0.1, 0.2, 0.8, 0.9]) expect(p(x + 0.05) - 2 * p(x) + p(x - 0.05)).toBeGreaterThan(0);
  });

  it('surges swell pressure and are followed by recovery dips', () => {
    const s = spec({ apprenticeship: 0.5, arcPosition: 0.9, surges: [0.55] });
    const during = arcShape(s, 0.59);
    const after = arcShape(s, 0.68);
    expect(after).toBeLessThan(during);
  });

  it('pressure and speeds are bounded everywhere, including very long Endless runs', () => {
    for (const mode of ['normal', 'hardcore'] as const)
      for (const a of [0, 0.5, 1])
        for (const kind of ['level', 'boss', 'endless'] as const)
          for (const x of [0, 0.25, 0.5, 0.75, 1]) {
            const s = spec({ mode, apprenticeship: a, arcPosition: x, kind, surges: [0.3, 0.6, 0.85] });
            const p = pressureAt(s, { progress: x, endlessSeconds: x * 60 * 500 });
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
          }
    const far = endlessState(spec({ mode: 'hardcore', apprenticeship: 1, kind: 'endless' }), 60 * 10_000);
    expect(far.overdrive).toBeLessThanOrEqual(1 + DIRECTOR_TUNING.endless.overdriveMax + 1e-9);
    const fastest = speedBandsAt({ mode: 'hardcore', apprenticeship: 1 }, far.overdrive).fast[1];
    expect(fastest).toBeGreaterThan(4.5); // a word always takes more than 4.5 s to reach the Ward
  });

  it('a calibrated typist clears early encounters cleanly (no unavoidable failure by construction)', () => {
    // A measuring stick, not a claim of universal fairness.
    for (const level of [1, 6, LEVELS_PER_TRIAL, BOSS_LEVEL]) {
      const reports = [3, 4, 5].map((seed) => simulateRun(directorTrialLevel('normal', 1, level), WORDS, seed, { cps: 3.5, reactionMs: 350 }));
      expect(reports.every((r) => r.status === 'won')).toBe(true);
    }
  });
});

describe('Difficulty Director: determinism and no hidden adaptation (acceptance 6)', () => {
  it('the same seed and progress give identical plans; a different seed differs', () => {
    const s = spec({ apprenticeship: 0.4, surges: [0.55] });
    expect(plans(s, 300, 9)).toEqual(plans(s, 300, 9));
    expect(plans(s, 300, 9)).not.toEqual(plans(s, 300, 10));
  });

  it('envelope() is pure: reading it never changes the next plan', () => {
    const a = new DifficultyDirector(spec(), 3, COUNTS);
    const b = new DifficultyDirector(spec(), 3, COUNTS);
    for (let i = 0; i < 50; i++) a.envelope({ progress: i / 50 });
    expect(a.next({ progress: 0.2 })).toEqual(b.next({ progress: 0.2 }));
  });

  it('a recorded game with the director replays exactly: every word, speed and timing', () => {
    const options = { config: directorTrialLevel('normal', 5, 9), seed: 4242, words: WORDS, experimentalScoring: true };
    const play = () => {
      const live = new GameEngine(options);
      const spawned: string[] = [];
      live.events.on('wordSpawned', ({ word }) => spawned.push(`${live.state.tick}:${word.text}:${word.speed.toFixed(6)}`));
      for (let i = 0; i < 2400 && live.status === 'playing'; i++) {
        live.step();
        if (i % 9 !== 0) continue;
        const target = [...live.state.words].sort((a, b) => b.y - a.y || a.id - b.id)[0];
        if (!target) continue;
        if (live.state.input === '') live.selectTarget(target.id);
        // An occasional deliberate wrong submission exercises the catch loop.
        if (i % 450 === 0) {
          live.typeChar('q');
          live.submit();
          continue;
        }
        const aimed = live.state.words.find((w) => w.id === live.state.pinnedId) ?? target;
        const ch = aimed.match[live.state.input.length];
        if (ch) live.typeChar(ch);
        if (live.state.input === aimed.match) live.submit();
      }
      return { live, spawned };
    };
    const a = play();
    const b = play();
    expect(b.spawned).toEqual(a.spawned);
    expect(b.live.commands).toEqual(a.live.commands);
    expect(a.spawned.length).toBeGreaterThan(10);
    const replayed = GameEngine.replay(options, a.live.commands, a.live.state.tick);
    expect(replayed.state).toEqual(a.live.state);
    expect(replayed.stats()).toEqual(a.live.stats());
  });

  it('reads no player skill: the plan sequence depends only on seed, spec and progress', () => {
    // The director API has no inputs for WPM, accuracy, Ward or field contents.
    expect(DifficultyDirector.prototype.next.length).toBe(1);
    const ctxKeys = new Set<string>();
    const probe = new Proxy({ progress: 0.3 }, { get: (o, k) => (ctxKeys.add(String(k)), (o as Record<string | symbol, unknown>)[k]) });
    new DifficultyDirector(spec({ kind: 'level' }), 1, COUNTS).next(probe);
    for (const k of ctxKeys) expect(['progress', 'endlessSeconds', 'opening']).toContain(k);
  });
});

describe('Difficulty Director: integration preserves classic behavior (acceptance 7, 9)', () => {
  it('is off by default; classic configs carry no director', () => {
    expect(directorEnabled()).toBe(false);
    for (let t = 1; t <= 9; t++) for (let l = 1; l <= BOSS_LEVEL; l++) expect(trialLevel('normal', t, l).director).toBeUndefined();
    expect(trialEndless('hardcore', 3).director).toBeUndefined();
    expect(sandboxConfig('normal', 2).director).toBeUndefined();
  });

  it('director configs keep every classic supporting lever: quota, timer, surges, spells, ward rules', () => {
    for (const mode of ['normal', 'hardcore'] as const)
      for (let t = 1; t <= 9; t++)
        for (let l = 1; l <= BOSS_LEVEL; l++) {
          const c = trialLevel(mode, t, l);
          const d = directorTrialLevel(mode, t, l);
          expect(validateDirectorSpec(d.director)).toEqual([]);
          for (const k of ['requiredWords', 'survivalMs', 'spawnInterval', 'maxActiveWords', 'surges', 'availableSpells', 'spellDropChance',
            'instabilityPerMiss', 'errorAcceleration', 'introducesSpell', 'openingWords', 'ramp', 'maxComplexity'] as const)
            expect(d[k]).toEqual(c[k]);
        }
  });

  it('director configs pass level validation', () => {
    const levels = Array.from({ length: BOSS_LEVEL }, (_, k) => ({ ...directorTrialLevel('normal', 4, k + 1), level: k + 1 }));
    expect(() => validateLevels(levels)).not.toThrow();
    expect(() => validateLevels([{ ...levels[0]!, director: { ...levels[0]!.director!, apprenticeship: 2 } }])).toThrow(/apprenticeship/);
  });

  it('Endless and Sandbox use the director without compounding fall speed', () => {
    const e = directorTrialEndless('normal', 9);
    expect(e.director?.kind).toBe('endless');
    expect(e.escalation?.speed).toBe(0);
    expect(directorSandboxConfig('hardcore', 5).director?.apprenticeship).toBe(1);
  });

  it('boss → Endless continues the same field and director stream', () => {
    const engine = new GameEngine({ config: { ...directorTrialLevel('normal', 2, BOSS_LEVEL), survivalMs: 2000 }, seed: 8, words: WORDS, experimentalScoring: true });
    for (let i = 0; i < 400 && engine.status === 'playing'; i++) {
      engine.step();
      for (const w of [...engine.state.words]) if (w.y > FIELD.height * 0.6) {
        engine.selectTarget(w.id);
        for (const ch of w.match) engine.typeChar(ch);
        engine.submit();
      }
    }
    // Survive the timer, then clear the field to win.
    for (let i = 0; i < 3000 && engine.status === 'playing'; i++) {
      engine.step();
      const w = engine.state.words[0];
      if (w) {
        engine.selectTarget(w.id);
        for (const ch of w.match) engine.typeChar(ch);
        engine.submit();
      }
    }
    expect(engine.status).toBe('won');
    const before = engine.state.words.map((w) => w.id);
    engine.continueIntoEndless(directorTrialEndless('normal', 2));
    expect(engine.status).toBe('playing');
    expect(engine.state.words.map((w) => w.id)).toEqual(before);
    expect(engine.directorSnapshot?.envelope.overdrive).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 600; i++) engine.step();
    expect(engine.directorSnapshot?.lastPlan).not.toBeNull();
  });

  it('a word keeps its planned speed: Wind-style speed reset never slows director words below spawn speed', () => {
    const engine = new GameEngine({ config: directorTrialLevel('normal', 9, 6), seed: 77, words: WORDS, experimentalScoring: true, initialSpells: { wind: 2 }, initialInstability: 50 });
    for (let i = 0; i < 400; i++) engine.step();
    const before = engine.state.words.map((w) => [w.id, w.baseSpeed] as const);
    expect(engine.quickCast('wind')).toBe(true);
    for (const [id, base] of before) {
      const w = engine.state.words.find((x) => x.id === id);
      if (w) expect(w.speed).toBeCloseTo(base, 6);
    }
  });

  it('opening words are never fast (they start partway down the field)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const engine = new GameEngine({ config: directorTrialLevel('hardcore', 9, 12), seed, words: WORDS, experimentalScoring: true });
      const bands: string[] = [];
      engine.events.on('wordSpawned', () => bands.push(engine.directorSnapshot!.lastPlan!.speedBand));
      engine.step();
      expect(bands.length).toBeGreaterThan(0);
      expect(bands).not.toContain('fast');
    }
  });
});

describe('Difficulty Director: simulation comparison (Phase 2 smoke)', () => {
  it('classic late apprenticeships lose relief; the director keeps it while staying harder than its first', () => {
    const typist = { cps: 5, reactionMs: 300 };
    const windowOf = (t: number, l: number) => lengthWindowAt(directorTrialLevel('normal', t, l).director!).dominant;
    const sum = (make: (seed: number) => ReturnType<typeof simulateRun>, w: readonly [number, number]) => summarize([1, 2, 3, 4].map(make), typist, w);
    const directorFirst = sum((s) => simulateRun(directorTrialLevel('normal', 1, 6), WORDS, s, typist), windowOf(1, 6));
    const classicLast = sum((s) => simulateRun(trialLevel('normal', 9, 12), WORDS, s, typist), windowOf(9, 12));
    const directorLast = sum((s) => simulateRun(directorTrialLevel('normal', 9, 12), WORDS, s, typist), windowOf(9, 12));
    expect(classicLast.corners.shortSlow).toBeLessThan(0.12);
    expect(directorLast.corners.shortSlow).toBeGreaterThan(0.12);
    expect(directorLast.meanLength).toBeGreaterThan(directorFirst.meanLength + 2);
    expect(directorLast.fall.p50).toBeLessThan(directorFirst.fall.p50);
  });
});

/**
 * D-098: dominant, softly bounded word-length windows with rare outliers.
 * EXPERIMENTAL prototype tolerances, not approved balance. They exist so a
 * regression that floods Slow level 1 with seven-letter words, or Harvest
 * with short words, fails loudly.
 */
const D098_TOLERANCES = {
  slowLevel1: { window: [3, 6] as const, minWithin: 0.95, maxSevenPlus: 0.02, maxSevenPlusOpening: 0.01 },
  harvest: { minSixPlus: 0.85, maxFourOrLess: 0.03, minRelief: 0.01, maxRelief: 0.15, minMedian: 7 },
};
const lengthsOf = (ps: { length: number }[]) => ps.map((p) => p.length);
const shareOf = (ls: number[], f: (l: number) => boolean) => ls.filter(f).length / ls.length;
const quantile = (ls: number[], q: number) => [...ls].sort((a, b) => a - b)[Math.floor((ls.length - 1) * q)]!;

describe('D-098: Slow level 1 keeps the familiar 3–6 letter window', () => {
  const T = D098_TOLERANCES.slowLevel1;
  for (const mode of ['normal', 'hardcore'] as const) {
    it(`${mode}: deterministic sampling across the whole level stays recognizably 3–6, 7+ genuinely rare`, () => {
      const s = directorTrialLevel(mode, 1, 1).director!;
      expect(lengthWindowAt(s).dominant).toEqual(T.window);
      const ps = plans(s, 20000, 98);
      const ls = lengthsOf(ps);
      expect(shareOf(ls, (l) => l >= 3 && l <= 6)).toBeGreaterThanOrEqual(T.minWithin);
      expect(shareOf(ls, (l) => l >= 7)).toBeLessThanOrEqual(T.maxSevenPlus);
      // Opening-lesson safety envelope: the first quarter of the level is even stricter.
      expect(shareOf(lengthsOf(ps.slice(0, 5000)), (l) => l >= 7)).toBeLessThanOrEqual(T.maxSevenPlusOpening);
      expect(quantile(ls, 0.1)).toBeGreaterThanOrEqual(3);
      expect(quantile(ls, 0.9)).toBeLessThanOrEqual(6);
      // Soft, not hard: outliers exist on both sides, every window length is used.
      expect(ls.some((l) => l >= 7)).toBe(true);
      expect(ls.some((l) => l < 3)).toBe(true);
      for (const l of [3, 4, 5, 6]) expect(shareOf(ls, (x) => x === l)).toBeGreaterThan(0.03);
    });

    it(`${mode}: in the real engine, Slow level 1 spawns stay in the window and opening words are never 7+`, () => {
      const spawns = Array.from({ length: 40 }, (_, i) => simulateRun(directorTrialLevel(mode, 1, 1), WORDS, 300 + i, { cps: 5, reactionMs: 300 })).flatMap((r) => r.spawns);
      const ls = spawns.map((x) => x.length);
      expect(ls.length).toBeGreaterThan(500);
      expect(shareOf(ls, (l) => l >= 3 && l <= 6)).toBeGreaterThanOrEqual(T.minWithin);
      expect(shareOf(ls, (l) => l >= 7)).toBeLessThanOrEqual(T.maxSevenPlus);
      const openers = spawns.filter((x) => x.timeToWard < x.fallSeconds - 0.01);
      expect(openers.length).toBeGreaterThan(0);
      expect(openers.every((x) => x.length <= 6)).toBe(true);
    });
  }

  it('early long-fast is rare and the four combinations are far from equal at Slow level 1', () => {
    const ps = plans(directorTrialLevel('normal', 1, 1).director!, 20000, 5);
    const ss = share(ps, (p) => corner(p) === 'short-slow');
    const lf = share(ps, (p) => corner(p) === 'long-fast');
    expect(lf).toBeLessThan(0.04);
    expect(ss).toBeGreaterThan(5 * lf);
    // Absolute long (7+) and fast together: almost never.
    expect(share(ps, (p) => p.length >= 7 && p.speedBand === 'fast')).toBeLessThan(0.003);
  });
});

describe('D-098: Harvest is dominated by 6+ letters with rare shorter relief', () => {
  const T = D098_TOLERANCES.harvest;
  for (const mode of ['normal', 'hardcore'] as const)
    for (const level of [1, 6, LEVELS_PER_TRIAL, BOSS_LEVEL])
      it(`${mode} Harvest ${level === BOSS_LEVEL ? 'boss' : `level ${level}`}: 6+ dominant, short words rare but present`, () => {
        const ls = lengthsOf(plans(directorTrialLevel(mode, 8, level).director!, 20000, 13));
        expect(shareOf(ls, (l) => l >= 6)).toBeGreaterThanOrEqual(T.minSixPlus);
        expect(shareOf(ls, (l) => l <= 4)).toBeLessThanOrEqual(T.maxFourOrLess);
        const relief = shareOf(ls, (l) => l <= 5);
        expect(relief).toBeGreaterThanOrEqual(T.minRelief);
        expect(relief).toBeLessThanOrEqual(T.maxRelief);
        expect(quantile(ls, 0.5)).toBeGreaterThanOrEqual(T.minMedian);
        // 6+ is a lower anchor, not a licence for endless length.
        expect(shareOf(ls, (l) => l >= 11)).toBeLessThan(0.08);
      });

  it('in the real engine, Harvest spawns are dominated by 6+ letters', () => {
    const ls = Array.from({ length: 30 }, (_, i) => simulateRun(directorTrialLevel('normal', 8, 6), WORDS, 500 + i, { cps: 6, reactionMs: 300 }))
      .flatMap((r) => r.spawns.map((x) => x.length));
    expect(ls.length).toBeGreaterThan(500);
    expect(shareOf(ls, (l) => l >= 6)).toBeGreaterThanOrEqual(T.minSixPlus);
    expect(shareOf(ls, (l) => l <= 4)).toBeLessThanOrEqual(T.maxFourOrLess);
  });
});

describe('D-098: intermediate apprenticeships move naturally between the anchors', () => {
  it('window bounds, median and lower quantile rise monotonically; each window stays dominant', () => {
    let last = { lo: 0, hi: 0, p10: 0, p50: 0 };
    for (let t = 1; t <= 9; t++) {
      const s = directorTrialLevel('normal', t, 1).director!;
      const w = lengthWindowAt(s);
      const ls = lengthsOf(plans(s, 8000, 21));
      const now = { lo: w.lo, hi: w.hi, p10: quantile(ls, 0.1), p50: quantile(ls, 0.5) };
      expect(now.lo).toBeGreaterThanOrEqual(last.lo);
      expect(now.hi).toBeGreaterThanOrEqual(last.hi);
      expect(now.p10).toBeGreaterThanOrEqual(last.p10);
      expect(now.p50).toBeGreaterThanOrEqual(last.p50);
      if (t > 1) expect(now.hi - last.hi).toBeLessThanOrEqual(1.01); // no jumps
      expect(shareOf(ls, (l) => l >= w.dominant[0] && l <= w.dominant[1])).toBeGreaterThan(0.85);
      last = now;
    }
  });

  it('the window also drifts gently within an apprenticeship (level 1 → boss), never backwards', () => {
    for (let t = 1; t <= 9; t++) {
      const first = lengthWindowAt(directorTrialLevel('normal', t, 1).director!);
      const boss = lengthWindowAt(directorTrialLevel('normal', t, BOSS_LEVEL).director!);
      expect(boss.lo).toBeGreaterThanOrEqual(first.lo);
      expect(boss.hi - first.hi).toBeLessThan(0.6);
    }
  });
});
