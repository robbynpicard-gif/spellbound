import { describe, expect, it, vi } from 'vitest';
import { GameEngine, type EngineOptions } from '../src/core/GameEngine';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import { addCharge, consumeCharge, emptyCharges, MAX_SPELL_CHARGES, sanitizeCharges } from '../src/gameplay/SpellManager';
import type { WordState } from '../src/gameplay/Word';
import { SPELLS } from '../src/spells/SpellRegistry';

const TEST_WORDS = ['ember', 'frost', 'wand', 'rune', 'owl', 'gale', 'quill', 'mist'];

const CONFIG: DifficultyConfig = {
  level: 0,
  name: 'Test',
  requiredWords: null,
  initialFallSpeed: 60,
  spawnInterval: 1000,
  maxActiveWords: 5,
  minWordLength: 3,
  maxWordLength: 8,
  modifierProbabilities: {},
  instabilityPerMiss: 25,
  errorAcceleration: 30,
  availableSpells: [],
  spellDropChance: 0,
};

function makeOptions(overrides: Partial<DifficultyConfig> = {}, extra: Partial<EngineOptions> = {}): EngineOptions {
  return { config: { ...CONFIG, ...overrides }, seed: 3, words: TEST_WORDS, ...extra };
}

function makeEngine(overrides: Partial<DifficultyConfig> = {}, extra: Partial<EngineOptions> = {}): GameEngine {
  return new GameEngine(makeOptions(overrides, extra));
}

function stepUntilWords(engine: GameEngine, count: number): void {
  for (let i = 0; i < 10_000 && engine.state.words.length < count; i++) engine.step();
  expect(engine.state.words.length).toBeGreaterThanOrEqual(count);
}

function type(engine: GameEngine, text: string): void {
  for (const ch of text) engine.typeChar(ch);
}

/** Type a word and press Enter (the only way to destroy it). */
function typeWord(engine: GameEngine, text: string): void {
  type(engine, text);
  engine.submit();
}

/** Cast the way a player does: empty the console, type the spell's name, press Enter. */
function cast(engine: GameEngine, spell: string): void {
  engine.clearInput();
  type(engine, spell);
  engine.submit();
}

describe('spell inventory', () => {
  it('caps charges at three and never goes below zero', () => {
    const c = emptyCharges();
    for (let i = 0; i < MAX_SPELL_CHARGES; i++) expect(addCharge(c, 'fire')).toBe(true);
    expect(addCharge(c, 'fire')).toBe(false);
    expect(c.fire).toBe(3);
    expect(consumeCharge(c, 'ice')).toBe(false);
    expect(c.ice).toBe(0);
  });

  it('sanitises carried-in charges', () => {
    expect(sanitizeCharges({ fire: 9, ice: -2, slow: 1.7, wind: Number.NaN, bogus: 4 } as never)).toEqual({
      fire: 3,
      ice: 0,
      slow: 1,
      wind: 0,
    });
  });

  it('registry has all four original spells', () => {
    expect(Object.keys(SPELLS).sort()).toEqual(['fire', 'ice', 'slow', 'wind']);
  });
});

describe('spell tomes', () => {
  it('spawn on levels that allow them and grant a charge when completed', () => {
    const engine = makeEngine({ availableSpells: ['fire'], spellDropChance: 1 });
    const collected = vi.fn();
    engine.events.on('spellCollected', collected);
    stepUntilWords(engine, 1);
    const word = engine.state.words[0]!;
    expect(word.spell).toBe('fire');
    typeWord(engine, word.text);
    expect(engine.state.spells.fire).toBe(1);
    expect(collected).toHaveBeenCalledWith(expect.objectContaining({ spell: 'fire', stored: true }));
  });

  it('never spawn when the level has no spells', () => {
    const engine = makeEngine({ spellDropChance: 1 });
    stepUntilWords(engine, 5);
    expect(engine.state.words.every((w) => w.spell === null)).toBe(true);
  });

  it('are wasted (but still score) when that spell is full', () => {
    const engine = makeEngine({ availableSpells: ['ice'], spellDropChance: 1 }, { initialSpells: { ice: 3 } });
    const collected = vi.fn();
    engine.events.on('spellCollected', collected);
    stepUntilWords(engine, 1);
    typeWord(engine, engine.state.words[0]!.text);
    expect(engine.state.spells.ice).toBe(3);
    expect(engine.state.score).toBeGreaterThan(0);
    expect(collected).toHaveBeenCalledWith(expect.objectContaining({ stored: false }));
  });
});

describe('casting', () => {
  it('fizzles with no charge and changes nothing', () => {
    const engine = makeEngine();
    const fizzled = vi.fn();
    engine.events.on('spellFizzled', fizzled);
    cast(engine, 'fire');
    expect(fizzled).toHaveBeenCalledWith({ spell: 'fire' });
    expect(engine.state.spellsCast.fire).toBe(0);
    expect(engine.state.input).toBe('');
  });

  it('uses one charge per cast and counts usage', () => {
    const engine = makeEngine({}, { initialSpells: { slow: 2 } });
    cast(engine, 'slow');
    expect(engine.state.spells.slow).toBe(1);
    expect(engine.state.spellsCast.slow).toBe(1);
  });

  it('Fire burns every word: base points, counts toward quota, collects tomes, keeps combo', () => {
    const engine = makeEngine(
      { requiredWords: 100, spawnInterval: 10, availableSpells: ['wind'], spellDropChance: 1 },
      { initialSpells: { fire: 1 } },
    );
    stepUntilWords(engine, 3);
    const first = engine.state.words[0]!;
    typeWord(engine, first.text); // combo 1
    stepUntilWords(engine, 3);
    const words = [...engine.state.words];
    const scoreBefore = engine.state.score;
    const burned = vi.fn();
    engine.events.on('wordsBurned', burned);

    cast(engine, 'fire');

    const expected = words.reduce((sum, w) => sum + w.text.length * 10, 0);
    expect(engine.state.words).toHaveLength(0);
    expect(engine.state.score - scoreBefore).toBe(expected);
    expect(engine.state.completed).toBe(1 + words.length);
    expect(engine.state.combo).toBe(1);
    expect(engine.state.spells.wind).toBe(Math.min(3, 1 + words.length));
    expect(burned).toHaveBeenCalledWith({ words, points: expected });
  });

  it('Fire can finish the level', () => {
    const engine = makeEngine({ requiredWords: 2, spawnInterval: 10 }, { initialSpells: { fire: 1 } });
    stepUntilWords(engine, 2);
    cast(engine, 'fire');
    expect(engine.status).toBe('won');
  });

  it('Ice stops movement and spawning for 5 seconds, then everything resumes', () => {
    const engine = makeEngine({ spawnInterval: 100 }, { initialSpells: { ice: 1 } });
    stepUntilWords(engine, 2);
    const word = engine.state.words[0]!;
    const count = engine.state.words.length;
    const ended = vi.fn();
    engine.events.on('spellEnded', ended);

    cast(engine, 'ice');
    const y = word.y;
    for (let i = 0; i < 299; i++) engine.step();
    expect(word.y).toBe(y);
    expect(engine.state.words.length).toBe(count);
    expect(ended).not.toHaveBeenCalled();

    engine.step(); // 300th tick = 5 s
    expect(ended).toHaveBeenCalledWith({ spell: 'ice' });
    engine.step();
    expect(word.y).toBeGreaterThan(y);
  });

  it('typing still works while frozen', () => {
    const engine = makeEngine({}, { initialSpells: { ice: 1 } });
    stepUntilWords(engine, 1);
    cast(engine, 'ice');
    typeWord(engine, engine.state.words[0]!.text);
    expect(engine.state.completed).toBe(1);
  });

  it('Slow halves fall speed for 8 seconds', () => {
    const engine = makeEngine({ spawnInterval: 100_000 }, { initialSpells: { slow: 1 } });
    stepUntilWords(engine, 1);
    const word = engine.state.words[0]!;
    cast(engine, 'slow');
    let y = word.y;
    engine.step();
    expect(word.y - y).toBeCloseTo(0.5); // 60 px/s × ½ = 0.5 px per tick
    for (let i = 0; i < 479; i++) engine.step();
    y = word.y;
    engine.step();
    expect(word.y - y).toBeCloseTo(1);
  });

  it('Wind resets instability and removes mistake speed-ups', () => {
    const engine = makeEngine({ initialFallSpeed: 600, spawnInterval: 300 }, { initialSpells: { wind: 1 } });
    for (let i = 0; i < 2000 && engine.state.missed < 2; i++) engine.step();
    expect(engine.state.instability).toBe(50);
    stepUntilWords(engine, 1);
    const word: WordState = engine.state.words[0]!;
    engine.typeChar(word.text[0]!);
    engine.typeChar('z');
    engine.clearInput();
    expect(word.speed).toBe(630);

    const changed = vi.fn();
    engine.events.on('instabilityChanged', changed);
    cast(engine, 'wind');
    expect(engine.state.instability).toBe(0);
    expect(word.speed).toBe(600);
    expect(changed).toHaveBeenCalledWith({ value: 0, stage: 0 });
  });

  it('casts are recorded and replay identically', () => {
    const options = makeOptions(
      { spawnInterval: 500, availableSpells: ['fire', 'ice', 'slow', 'wind'], spellDropChance: 0.3 },
      { initialSpells: { fire: 1, ice: 1, slow: 1, wind: 1 } },
    );
    const live = new GameEngine(options);
    for (let t = 0; t < 4000 && live.status === 'playing'; t++) {
      live.step();
      if (t % 25 === 0 && live.state.words.length > 0) {
        const target = live.target ?? live.state.words[0]!;
        if (live.inputIsCompleteWord) live.submit();
        else if (live.inputValid) live.typeChar(target.match[target.typed]!);
        else live.clearInput();
      }
      if (t === 400) cast(live, 'ice');
      if (t === 900) cast(live, 'slow');
      if (t === 1500) cast(live, 'fire');
      if (t === 2500) cast(live, 'wind');
    }
    expect(live.state.spellsCast).toEqual({ fire: 1, ice: 1, slow: 1, wind: 1 });
    const replayed = GameEngine.replay(options, live.commands, live.state.tick);
    expect(replayed.state).toEqual(live.state);
  });
});
