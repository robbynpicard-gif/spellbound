import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { simulate, typistAt } from '../src/difficulty/DirectorSimulation';
import { WORDS } from '../src/data/wordList';
import { OPENING_TUNING, openingRun } from '../src/typel/apprenticeship';

/** D-112 / GAME-002: the Academy opens with a fair, finite, spell-free typing trial. */
describe('Opening Trial', () => {
  it('has no spells and drops no spell scrolls anywhere', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      const plan = openingRun(mode);
      expect(plan.segments).toHaveLength(OPENING_TUNING.path.length);
      for (const s of plan.segments) {
        expect(s.config.availableSpells).toEqual([]);
        expect(s.config.spellDropChance).toBe(0);
        expect(s.config.requiredWords).toBeGreaterThan(0);
        expect(s.phase).not.toBe('boss');
      }
    }
  });

  it('never spawns a spell scroll in play', () => {
    const plan = openingRun('normal');
    const engine = new GameEngine({ config: plan.segments[0]!.config, run: plan, seed: 9, words: WORDS, experimentalScoring: true });
    for (let i = 0; i < 60 * 90; i++) {
      engine.step();
      expect(engine.state.words.every((w) => w.spell === null)).toBe(true);
      if (engine.state.status !== 'playing') break;
    }
  });

  it('is finite and clearable by a skilled typist, with no scripted failure', () => {
    const r = simulate({ plan: openingRun('normal'), words: WORDS, seed: 17, typist: typistAt(100), maxSeconds: 600 });
    expect(r.status).toBe('won');
    // D-116: a skilled typist is kept busy, so it no longer drags; still a real stretch of play.
    expect(r.seconds).toBeGreaterThan(60);
    expect(r.seconds).toBeLessThan(240);
  });

  it('escalates until hands alone are not enough for a slow typist', () => {
    // The authored curve alone (D-112/D-113); with D-116 adaptation a 45 WPM typist is eased and can sometimes clear it.
    const r = simulate({ plan: openingRun('normal'), words: WORDS, seed: 17, typist: typistAt(45), maxSeconds: 600, pressureControl: false });
    expect(r.status).not.toBe('won');
    // ...but only after a real stretch of play, not at the start
    expect(r.seconds).toBeGreaterThan(90);
  });

  it('is deterministic for a seed', () => {
    const a = simulate({ plan: openingRun('normal'), words: WORDS, seed: 5, typist: typistAt(80), maxSeconds: 600 });
    const b = simulate({ plan: openingRun('normal'), words: WORDS, seed: 5, typist: typistAt(80), maxSeconds: 600 });
    expect(b.score).toBe(a.score);
    expect(b.seconds).toBe(a.seconds);
  });
});
