import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { SeededRandom } from '../src/core/Random';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import { combustionChain, FIRE_TUNING, shockChain } from '../src/gameplay/SpellChains';
import { RUNES } from '../src/gameplay/runes/RuneCatalogue';

const W = (id: number, x: number, y: number) => ({ id, x, y });

describe('Shock seeded chain (provisional)', () => {
  it('always strikes the first word and is deterministic for a seed', () => {
    const field = [W(1, 100, 700), W(2, 160, 660), W(3, 230, 620), W(4, 900, 100)];
    const a = shockChain(field, field[0]!, new SeededRandom(42));
    const b = shockChain(field, field[0]!, new SeededRandom(42));
    expect(a.struck[0]!.id).toBe(1);
    expect(a.struck.map((w) => w.id)).toEqual(b.struck.map((w) => w.id));
    expect(a.struck.some((w) => w.id === 4)).toBe(false); // out of reach
  });

  it('chains further on a dense field than a sparse one, capped', () => {
    const dense = Array.from({ length: 16 }, (_, i) => W(i + 1, 100 + (i % 4) * 90, 400 + Math.floor(i / 4) * 80));
    const sparse = Array.from({ length: 16 }, (_, i) => W(i + 1, 100 + i * 400, 400));
    let d = 0;
    let s = 0;
    for (let seed = 1; seed <= 40; seed++) {
      d += shockChain(dense, dense[0]!, new SeededRandom(seed)).struck.length;
      s += shockChain(sparse, sparse[0]!, new SeededRandom(seed)).struck.length;
      expect(shockChain(dense, dense[0]!, new SeededRandom(seed)).struck.length).toBeLessThanOrEqual(10);
    }
    expect(d).toBeGreaterThan(s * 2);
  });
});

describe('Fire Combustion Chain (provisional)', () => {
  it('ignites the lower half, spreads to neighbours, and spares the top fifth', () => {
    const field = [W(1, 300, 400), W(2, 380, 250), W(3, 500, 180), W(4, 420, 60), W(5, 1200, 300)];
    const { burned } = combustionChain(field, 760);
    const ids = burned.map((b) => b.word.id);
    expect(ids).toContain(1); // lower half
    expect(ids).toContain(2); // spread
    expect(ids).toContain(3); // second generation
    expect(ids).not.toContain(4); // top fifth is spared
    expect(ids).not.toContain(5); // isolated, upper half
    expect(burned.find((b) => b.word.id === 3)!.depth).toBe(2);
    expect(FIRE_TUNING.spareAbove).toBe(0.2);
  });
});

describe('Runes', () => {
  const CONFIG: DifficultyConfig = {
    speedVariance: 0, speedRamp: 0, level: 0, name: 'T', requiredWords: null, initialFallSpeed: 10, spawnInterval: 150,
    maxActiveWords: 12, minWordLength: 3, maxWordLength: 6, modifierProbabilities: {}, instabilityPerMiss: 10,
    errorAcceleration: 0, availableSpells: [], spellDropChance: 0,
  };
  const WORDS = ['ember', 'frost', 'wand', 'rune', 'owl', 'gale', 'quill', 'mist', 'yew', 'orb', 'elk', 'bell', 'lamp', 'ink'];

  it('catalogue ids are unique and every Rune has a rule', () => {
    expect(new Set(RUNES.map((r) => r.id)).size).toBe(RUNES.length);
    for (const r of RUNES) expect(r.how.length).toBeGreaterThan(5);
  });

  it('awards Frostscribe for 3 perfect captures in one freeze, and pays fixed points', () => {
    const e = new GameEngine({ config: CONFIG, seed: 5, words: WORDS, experimentalScoring: true, initialSpells: { ice: 1 } });
    for (let i = 0; i < 5000 && e.state.words.length < 5; i++) e.step();
    const awarded: string[] = [];
    e.events.on('runeAwarded', ({ id }) => awarded.push(id));
    e.clearInput();
    for (const c of 'ice') e.typeChar(c);
    e.submit();
    for (let i = 0; i < 3; i++) {
      const w = [...e.state.words].sort((a, b) => b.y - a.y)[0]!;
      for (const c of w.match) e.typeChar(c);
      e.submit();
    }
    expect(awarded).toContain('frost-3');
    expect(e.stats().runeCounts?.['frost-3']).toBe(1);
  });
});
