import { describe, expect, it } from 'vitest';
import { FIELD } from '../src/core/GameConfig';
import { GameEngine } from '../src/core/GameEngine';
import { WORDS } from '../src/data/wordList';
import { validateLevels } from '../src/difficulty/DifficultyConfig';
import { trialBaseline } from '../src/difficulty/DifficultyDirector';
import { simulate, typistAt } from '../src/difficulty/DirectorSimulation';
import { SpawnFormation } from '../src/difficulty/SpawnFormation';
import { apprenticeshipEndless, apprenticeshipRun } from '../src/typel/apprenticeship';
import { arcaneTrialConfig, CROSSWIND } from '../src/typel/arcaneTrials';

/** D-120: the representative Arcane Trial prototype. Simulations are diagnostic, not proof of fun. */
const formation = CROSSWIND.profile.formation!;

describe('Crosswind formation (D-109 behaviours 4 and 5)', () => {
  it('is deterministic for a seed and sweeps between sides in runs', () => {
    const a = new SpawnFormation(formation, 7);
    const b = new SpawnFormation(formation, 7);
    const steps = Array.from({ length: 200 }, () => a.next());
    expect(Array.from({ length: 200 }, () => b.next())).toEqual(steps);
    const switches = steps.filter((s) => s.switched).length;
    expect(switches).toBeGreaterThan(200 / (formation.run[1] + 1) - 2);
    expect(switches).toBeLessThan(200 / formation.run[0] + 2);
    const sided = steps.filter((s) => s.side !== null).length / steps.length;
    expect(sided).toBeGreaterThan(formation.edgeShare - 0.12);
    expect(sided).toBeLessThan(formation.edgeShare + 0.12);
  });

  it('staggered entries stay inside their authored depth', () => {
    const f = new SpawnFormation(formation, 3);
    const depths = Array.from({ length: 400 }, () => f.next().startShare).filter((d) => d > 0);
    expect(depths.length / 400).toBeGreaterThan(formation.stagger.chance - 0.08);
    for (const d of depths) {
      expect(d).toBeGreaterThanOrEqual(formation.stagger.depth[0]);
      expect(d).toBeLessThanOrEqual(formation.stagger.depth[1]);
    }
  });

  it('only the trial has a formation: Academy and Endless placement are untouched', () => {
    expect(arcaneTrialConfig(CROSSWIND).director!.trial!.formation).toBeDefined();
    for (const seg of apprenticeshipRun('normal', 5).segments) expect(seg.config.director!.trial).toBeUndefined();
    expect(apprenticeshipEndless('normal', 5).director!.trial).toBeUndefined();
  });
});

describe('The Crosswind Trial', () => {
  it('is a valid single continuous encounter with a fixed authored profile', () => {
    const config = arcaneTrialConfig(CROSSWIND);
    expect(() => validateLevels([{ ...config, level: 1 }])).not.toThrow();
    expect(config.director!.kind).toBe('trial');
    expect(config.director!.adaptive).toBe('off');
    expect(config.availableSpells).toHaveLength(8);
    // Continuous: the authored baseline never jumps (no phase boundaries).
    let prev = trialBaseline(config.director!, 0, 0);
    for (let s = 0.5; s <= 600; s += 0.5) {
      const b = trialBaseline(config.director!, s / 600, s);
      expect(Math.abs(b - prev)).toBeLessThan(0.02);
      prev = b;
    }
  });

  it('places every scroll inside the field, with staggered scrolls never fast', () => {
    const e = new GameEngine({ config: arcaneTrialConfig(CROSSWIND), seed: 5, words: WORDS, experimentalScoring: true });
    let staggered = 0;
    e.events.on('wordSpawned', ({ word, formation: f }) => {
      expect(word.x).toBeGreaterThanOrEqual(FIELD.sideMargin);
      expect(word.x).toBeLessThanOrEqual(FIELD.width - FIELD.sideMargin);
      expect(word.y).toBeLessThan(FIELD.height * 0.35);
      if (f?.staggered) {
        staggered++;
        expect((FIELD.height - word.y) / word.speed).toBeGreaterThan(3);
      }
    });
    for (let i = 0; i < 60 * 90 && e.status === 'playing'; i++) e.step();
    expect(staggered).toBeGreaterThan(5);
  });

  it('a capable typist with spells survives in about 8–12 minutes; hands alone at the same speed fall', () => {
    const run = (casts: boolean, seed: number) => simulate({
      config: arcaneTrialConfig(CROSSWIND), words: WORDS, seed, typist: { ...typistAt(90), casts }, maxSeconds: 1500, sampleEvery: 0.5,
      initialSpells: CROSSWIND.startingBank,
    });
    const withSpells = run(true, 2000);
    expect(withSpells.status).toBe('won');
    expect(withSpells.seconds / 60).toBeGreaterThan(7);
    expect(withSpells.seconds / 60).toBeLessThan(12);
    expect(withSpells.checkpoints).toHaveLength(0); // no phases or intermissions
    expect(withSpells.timeline.every((s) => s.offset === null)).toBe(true); // authored, not adaptive
    let run0 = 0;
    let longest = 0;
    for (const s of withSpells.timeline) longest = Math.max(longest, (run0 = s.words === 0 ? run0 + 1 : 0));
    expect(longest * 0.5).toBeLessThanOrEqual(3);
    // D-119: typing stays the main source of score.
    expect(withSpells.spellPoints / withSpells.score).toBeLessThan(0.25);
    expect(run(false, 2000).status).toBe('lost');
  });

  it('replays exactly from its command log', () => {
    const options = { config: arcaneTrialConfig(CROSSWIND), seed: 31, words: WORDS, experimentalScoring: true, initialSpells: CROSSWIND.startingBank };
    const e = new GameEngine(options);
    for (let t = 0; t < 60 * 60 && e.status === 'playing'; t++) {
      if (t % 50 === 0 && e.state.words.length > 0) {
        const w = [...e.state.words].sort((a, b) => b.y - a.y)[0]!;
        for (const ch of w.match) e.typeChar(ch);
        e.submit();
      }
      if (t === 1800) (['w', 'i', 'n', 'd'].forEach((c) => e.typeChar(c)), e.submit());
      e.step();
    }
    const r = GameEngine.replay(options, e.commands, e.state.tick);
    expect(r.state.score).toBe(e.state.score);
    expect(r.state.words.map((w) => [w.id, w.text, Math.round(w.x), Math.round(w.y)])).toEqual(e.state.words.map((w) => [w.id, w.text, Math.round(w.x), Math.round(w.y)]));
  });
});
