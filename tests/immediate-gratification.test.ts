import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/Random';
import { WORDS } from '../src/data/wordList';
import { simulate, typistAt } from '../src/difficulty/DirectorSimulation';
import { SPELL_IDS } from '../src/gameplay/SpellManager';
import { WordGenerator } from '../src/gameplay/WordGenerator';
import { apprenticeshipRun, openingRun, SPELL_ORDER, TRIALS } from '../src/typel/apprenticeship';
import { startingBank } from '../src/typel/progression';

/** D-123 / GAME-009: immediate gratification, progressive mastery. Simulations are diagnostic. */
describe('D-123 immediate gratification', () => {
  it('never spawns a word equal to, or in a prefix relation with, one already on the field', () => {
    const g = new WordGenerator(WORDS, { minWordLength: 2, maxWordLength: 12, maxActiveWords: 4 }, new SeededRandom(9));
    const active = ['to', 'at', 'in', 'on', 'go', 'up', 'it', 'is', 'an', 'be', 'do', 'me', 'we'];
    for (let i = 0; i < 400; i++) {
      const w = g.nextOfLength(2 + (i % 3), active).toLowerCase();
      for (const a of active) {
        expect(w.startsWith(a)).toBe(false);
        expect(a.startsWith(w)).toBe(false);
      }
    }
  });

  it('the word bank keeps reserved spell names out (no word equals, prefixes or extends one)', () => {
    for (const w of WORDS) for (const s of SPELL_IDS) {
      const l = w.toLowerCase();
      expect(l === s || s.startsWith(l) || l.startsWith(s)).toBe(false);
    }
  });

  it('rewards arrive early through ordinary typing in the Opening Trial and the first apprenticeship', () => {
    const opening = simulate({ plan: openingRun('normal'), words: WORDS, seed: 3000, typist: typistAt(45), maxSeconds: 600, sampleEvery: 0.5 });
    const spells = SPELL_ORDER.slice(0, 1);
    const t1 = simulate({ plan: apprenticeshipRun('normal', 1, 'learn', { spells }), words: WORDS, seed: 3000, typist: { ...typistAt(45), casts: true }, maxSeconds: 900, sampleEvery: 0.5, initialSpells: startingBank(TRIALS[0]!, spells) });
    for (const r of [opening, t1]) {
      expect(r.firsts.capture!).toBeLessThan(3);
      expect(r.firsts.rush!).toBeLessThan(6);
      expect(r.firsts.combo2!).toBeLessThan(40);
      const minutes = r.seconds / 60;
      expect(r.captureTimes.length / minutes).toBeGreaterThan(40); // frequent captures at 45 WPM
    }
  });

  it('difficulty comes from the field, not word length, early on: a fast typist faces a busy sky of short words', () => {
    const spells = SPELL_ORDER.slice(0, 1);
    const r = simulate({ plan: apprenticeshipRun('normal', 1, 'learn', { spells }), words: WORDS, seed: 3001, typist: { ...typistAt(120), casts: true }, maxSeconds: 900, sampleEvery: 0.5, initialSpells: startingBank(TRIALS[0]!, spells) });
    const lengths = r.spawns.map((s) => s.length);
    expect(lengths.reduce((a, b) => a + b, 0) / lengths.length).toBeLessThan(3.2);
    expect(r.timeline.reduce((a, s) => a + s.words, 0) / r.timeline.length).toBeGreaterThan(5);
  });
});
