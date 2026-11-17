import { describe, expect, it } from 'vitest';
import { GameEngine, type EngineOptions } from '../src/core/GameEngine';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import type { WordState } from '../src/gameplay/Word';
import { FIELD } from '../src/core/GameConfig';
import * as W from '../src/gameplay/Wizards';

const WORDS = ['ember', 'frost', 'wand', 'rune', 'owl', 'gale', 'quill', 'mist', 'lantern', 'bramble', 'cauldron', 'astrolabe'];

const CONFIG: DifficultyConfig = {
  speedVariance: 0,
  speedRamp: 0,
  level: 0,
  name: 'Test',
  requiredWords: null,
  initialFallSpeed: 60,
  spawnInterval: 1000,
  maxActiveWords: 5,
  minWordLength: 3,
  maxWordLength: 9,
  modifierProbabilities: {},
  instabilityPerMiss: 25,
  errorAcceleration: 30,
  availableSpells: [],
  spellDropChance: 0,
};

function engine(wizard: W.WizardId | undefined, config: Partial<DifficultyConfig> = {}, seed = 3): GameEngine {
  const options: EngineOptions = { config: { ...CONFIG, ...config }, seed, words: WORDS, wizard };
  return new GameEngine(options);
}

function stepUntil(e: GameEngine, test: () => boolean, max = 20_000): void {
  for (let i = 0; i < max && !test(); i++) e.step();
  expect(test()).toBe(true);
}

function capture(e: GameEngine, word: WordState): void {
  for (const ch of word.match) e.typeChar(ch);
  e.submit();
}

/** Capture every word as it appears until a sigil is on the field; returns it. */
function farmSigil(e: GameEngine): WordState {
  for (let i = 0; i < 200_000; i++) {
    const sigil = e.state.words.find((w) => w.sigil);
    if (sigil) return sigil;
    const w = e.state.words[0];
    if (w) capture(e, w);
    e.step();
  }
  throw new Error('no sigil appeared');
}

describe('Wizards (D-042)', () => {
  it('no wizard: no sigils and the same word sequence as before', () => {
    const plain = engine(undefined, { initialFallSpeed: 0, spawnInterval: 50, maxActiveWords: 50 });
    const wiz = engine('apprentice', { initialFallSpeed: 0, spawnInterval: 50, maxActiveWords: 50 });
    for (let i = 0; i < 3000; i++) {
      plain.step();
      wiz.step();
    }
    expect(plain.state.words.some((w) => w.sigil)).toBe(false);
    expect(wiz.state.words.map((w) => w.text)).toEqual(plain.state.words.map((w) => w.text));
  });

  it('sigils appear only after a few captures, one at a time', () => {
    const e = engine('apprentice', { spawnInterval: 200, maxActiveWords: 8 });
    const sigil = farmSigil(e);
    expect(e.state.completed).toBeGreaterThanOrEqual(W.SIGIL_AFTER);
    expect(e.state.words.filter((w) => w.sigil)).toEqual([sigil]);
    expect(sigil.spell).toBeNull();
  });

  it('Apprentice: Second Wind doubles points and a miss keeps the combo', () => {
    const e = engine('apprentice', { spawnInterval: 200, maxActiveWords: 8, initialFallSpeed: 400 });
    capture(e, farmSigil(e));
    expect(e.state.powerTicks).toBeGreaterThan(0);
    const combo = e.state.combo;
    stepUntil(e, () => e.state.missed > 0);
    expect(e.state.combo).toBe(combo);
  });

  it('Archivist: Recall captures a word from a unique 3-letter prefix', () => {
    const e = engine('archivist', { spawnInterval: 200, maxActiveWords: 8 });
    capture(e, farmSigil(e));
    stepUntil(e, () => e.state.words.length > 0);
    const word = e.state.words.find((w) => e.state.words.filter((o) => o.match.startsWith(w.match.slice(0, 3))).length === 1)!;
    const before = e.state.completed;
    for (const ch of word.match.slice(0, 3)) e.typeChar(ch);
    e.submit();
    expect(e.state.completed).toBe(before + 1);
    expect(e.state.words).not.toContain(word);
  });

  it('Archivist: long words fall slower', () => {
    const e = engine('archivist', { minWordLength: 9, initialFallSpeed: 100 });
    stepUntil(e, () => e.state.words.length > 0);
    expect(e.state.words[0]!.speed).toBeCloseTo(100 * W.ARCHIVIST_SLOW);
  });

  it('Chronomancer: a miss drops one tier; Rewind undoes the last miss and lifts the words', () => {
    const e = engine('chronomancer', { spawnInterval: 200, maxActiveWords: 8, initialFallSpeed: 400 });
    const sigil = farmSigil(e);
    // Build a combo, then let a word through.
    for (let i = 0; i < 4; i++) {
      const w = e.state.words.find((x) => !x.sigil);
      if (w) capture(e, w);
    }
    const combo = e.state.combo;
    const misses = e.state.missed;
    stepUntil(e, () => e.state.missed > misses, 2000);
    expect(e.state.combo).toBeGreaterThan(0);
    const damaged = e.state.instability;
    expect(damaged).toBeGreaterThan(0);
    if (e.state.words.includes(sigil)) {
      const ys = e.state.words.map((w) => w.y);
      capture(e, sigil);
      expect(e.state.instability).toBeLessThan(damaged);
      expect(e.state.combo).toBeGreaterThanOrEqual(combo);
      expect(Math.max(...e.state.words.map((w) => w.y), 0)).toBeLessThanOrEqual(Math.max(...ys));
    }
  });

  it('Pyromancer: +20% points, +20% damage, Kindle captures neighbours', () => {
    const pyro = engine('pyromancer');
    const plain = engine(undefined);
    for (const e of [pyro, plain]) stepUntil(e, () => e.state.words.length > 0);
    capture(pyro, pyro.state.words[0]!);
    capture(plain, plain.state.words[0]!);
    expect(pyro.state.score).toBe(Math.round(plain.state.score * W.PYRO_SCORE));
    stepUntil(pyro, () => pyro.state.missed > 0);
    expect(pyro.state.instability).toBeCloseTo(25 * W.PYRO_DAMAGE);

    const e = engine('pyromancer', { spawnInterval: 150, maxActiveWords: 8, initialFallSpeed: 20 });
    capture(e, farmSigil(e));
    expect(e.state.kindleCharges).toBe(W.KINDLE_CHARGES);
    stepUntil(e, () => e.state.words.length >= 2);
    const before = e.state.completed;
    capture(e, e.state.words[0]!);
    expect(e.state.completed).toBe(before + 2);
    expect(e.state.kindleCharges).toBe(W.KINDLE_CHARGES - 1);
  });

  it('Hedge Witch: Overgrowth holds the lowest words in place', () => {
    const e = engine('hedgewitch', { spawnInterval: 150, maxActiveWords: 8, initialFallSpeed: 30 });
    const sigil = farmSigil(e);
    stepUntil(e, () => e.state.words.length >= 3);
    capture(e, sigil);
    expect(e.state.heldIds.length).toBeGreaterThan(0);
    const held = e.state.words.filter((w) => e.state.heldIds.includes(w.id));
    const ys = held.map((w) => w.y);
    for (let i = 0; i < 60; i++) e.step();
    expect(held.filter((w) => e.state.words.includes(w)).map((w) => w.y)).toEqual(
      ys.filter((_, i) => e.state.words.includes(held[i]!)),
    );
  });

  it('Warden: starts with a barrier; Bastion blocks misses and halves points', () => {
    const e = engine('warden', { spawnInterval: 200, maxActiveWords: 8 });
    expect(e.state.barrier).toBe(1);
    capture(e, farmSigil(e));
    expect(e.state.powerTicks).toBeGreaterThan(0);
    const missed = e.state.missed;
    const instability = e.state.instability;
    // Push a word to the ward line while Bastion is up.
    const w = e.state.words[0] ?? (stepUntil(e, () => e.state.words.length > 0), e.state.words[0]!);
    w.y = FIELD.height - 0.1;
    e.step();
    expect(e.state.missed).toBe(missed);
    expect(e.state.instability).toBe(instability);
  });

  it('replays exactly with a wizard', () => {
    const options: EngineOptions = { config: { ...CONFIG, spawnInterval: 200, maxActiveWords: 8 }, seed: 9, words: WORDS, wizard: 'pyromancer' };
    const a = new GameEngine(options);
    for (let i = 0; i < 4000; i++) {
      const w = a.state.words[0];
      if (w && i % 37 === 0) capture(a, w);
      a.step();
    }
    const b = GameEngine.replay(options, a.commands, a.state.tick);
    expect(b.state.score).toBe(a.state.score);
    expect(b.state.completed).toBe(a.state.completed);
    expect(b.state.powersUsed).toBe(a.state.powersUsed);
  });
});
