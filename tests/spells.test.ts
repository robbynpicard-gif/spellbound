import { wordComplexity } from '../src/gameplay/WordGenerator';
import { describe, expect, it, vi } from 'vitest';
import { FIELD } from '../src/core/GameConfig';
import { FIRE_MIN_DEPTH, GameEngine, type EngineOptions } from '../src/core/GameEngine';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import {
  addCharge,
  MAX_POOL_SIZE,
  consumeCharge,
  emptyCharges,
  poolFull,
  sanitizeCharges,
  SPELL_IDS,
  SPELL_POOL_SIZE,
  totalCharges,
} from '../src/gameplay/SpellManager';
import { ALL_WORDS, clashesWithCastWord, WORDS } from '../src/data/wordList';
import type { WordState } from '../src/gameplay/Word';
import { dropWeights, INTRO_DROP_BOOST, SPELLS } from '../src/spells/SpellRegistry';
import { endlessConfig, stageLevel } from '../src/difficulty/Stages';

const TEST_WORDS = ['ember', 'frost', 'wand', 'rune', 'owl', 'gale', 'quill', 'mist', 'labyrinth', 'phantasmal', 'yew', 'orb', 'elk'];

const CONFIG: DifficultyConfig = {
  // Exact speeds in these tests: no per-word variation or in-level ramp.
  speedVariance: 0,
  speedRamp: 0,
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

describe('spell pool', () => {
  it('shares one pool of 8 charges across all spells, with no per-spell cap', () => {
    const c = emptyCharges();
    for (let i = 0; i < 6; i++) expect(addCharge(c, 'fire')).toBe(true);
    expect(addCharge(c, 'ice')).toBe(true);
    expect(addCharge(c, 'harvest')).toBe(true);
    expect(totalCharges(c)).toBe(SPELL_POOL_SIZE);
    expect(poolFull(c)).toBe(true);
    expect(addCharge(c, 'slow')).toBe(false);
    expect(c.slow).toBe(0);
    expect(consumeCharge(c, 'wind')).toBe(false);
    expect(consumeCharge(c, 'fire')).toBe(true);
    expect(addCharge(c, 'slow')).toBe(true);
  });

  it('sanitises carried-in charges and trims them to the widest pool', () => {
    expect(sanitizeCharges({ fire: 2, ice: -2, slow: 1.7, wind: Number.NaN, bogus: 4 } as never)).toEqual({
      ...emptyCharges(),
      fire: 2,
      slow: 1,
    });
    const trimmed = sanitizeCharges({ slow: 9, harvest: 9 });
    expect(totalCharges(trimmed)).toBe(MAX_POOL_SIZE);
  });

  it('registry has all eight spells, in power order, each with a drop weight', () => {
    expect(SPELL_IDS).toEqual(['slow', 'ice', 'barrier', 'shock', 'alter', 'fire', 'wind', 'harvest']);
    expect(Object.keys(SPELLS).sort()).toEqual([...SPELL_IDS].sort());
    for (const id of SPELL_IDS) {
      expect(SPELLS[id].dropWeight).toBeGreaterThan(0);
      // In-game text stays short; the full description is for the spellbook.
      expect(SPELLS[id].summary.split(' ').length, id).toBeLessThanOrEqual(8);
    }
    // Stronger spells drop less often.
    for (let i = 1; i < SPELL_IDS.length; i++) {
      expect(SPELLS[SPELL_IDS[i]!].dropWeight).toBeLessThanOrEqual(SPELLS[SPELL_IDS[i - 1]!].dropWeight);
    }
  });

  it('boosts the drop weight of the spell a level introduces', () => {
    const w = dropWeights(['slow', 'ice'], 'ice');
    expect(w.slow).toBe(SPELLS.slow.dropWeight);
    expect(w.ice).toBe(SPELLS.ice.dropWeight * INTRO_DROP_BOOST);
    expect(dropWeights(['slow'], null)).toEqual({ slow: SPELLS.slow.dropWeight });
  });
});

describe('cast words', () => {
  it('no falling word equals a cast word, starts with one or is the start of one', () => {
    const clashes = ALL_WORDS.filter(clashesWithCastWord);
    expect(clashes).toEqual([]);
    expect(WORDS.some(clashesWithCastWord)).toBe(false);
  });

  it('no cast word starts with another', () => {
    for (const a of SPELL_IDS) for (const b of SPELL_IDS) if (a !== b) expect(a.startsWith(b), `${a}/${b}`).toBe(false);
  });

  it('detects clashes in both directions', () => {
    expect(clashesWithCastWord('Fireball')).toBe(true);
    expect(clashesWithCastWord('fir')).toBe(true);
    expect(clashesWithCastWord('shocking')).toBe(true);
    expect(clashesWithCastWord('ember')).toBe(false);
  });
});

describe('spell scrolls', () => {
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

  it('are wasted (but still score) when the pool is full', () => {
    const engine = makeEngine({ availableSpells: ['ice'], spellDropChance: 1 }, { initialSpells: { slow: 8 } });
    const collected = vi.fn();
    engine.events.on('spellCollected', collected);
    stepUntilWords(engine, 1);
    typeWord(engine, engine.state.words[0]!.text);
    expect(engine.state.spells.ice).toBe(0);
    expect(engine.state.score).toBeGreaterThan(0);
    expect(collected).toHaveBeenCalledWith(expect.objectContaining({ stored: false }));
  });

  it('drop rarer spells less often', () => {
    const engine = makeEngine({
      spawnInterval: 1,
      maxActiveWords: 1000,
      availableSpells: ['slow', 'harvest'],
      spellDropChance: 1,
    });
    const seen = { slow: 0, harvest: 0 };
    engine.events.on('wordSpawned', ({ word }) => {
      if (word.spell === 'slow' || word.spell === 'harvest') seen[word.spell]++;
    });
    for (let i = 0; i < 800; i++) engine.step();
    expect(seen.slow + seen.harvest).toBeGreaterThan(300);
    // Weights 5 : 1, so slow should be far more common.
    expect(seen.slow).toBeGreaterThan(seen.harvest * 3);
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

  it('Fire is a bailout: clears the board for base points (no multipliers), no progress, scrolls lost, combo kept', () => {
    const engine = makeEngine(
      { requiredWords: 100, spawnInterval: 10, availableSpells: ['wind'], spellDropChance: 1 },
      { initialSpells: { fire: 1 } },
    );
    stepUntilWords(engine, 3);
    typeWord(engine, engine.state.words[0]!.text); // combo 1, +1 wind
    stepUntilWords(engine, 3);
    // Fire spares the top of the field, so let these fall into its reach first.
    for (let i = 0; i < 600 && engine.state.words.some((w) => w.y < FIELD.height * FIRE_MIN_DEPTH); i++) engine.step();
    const words = [...engine.state.words];
    const before = { score: engine.state.score, completed: engine.state.completed, wind: engine.state.spells.wind };
    const burned = vi.fn();
    engine.events.on('wordsBurned', burned);

    cast(engine, 'fire');

    expect(engine.state.words).toHaveLength(0);
    const base = words.reduce((sum, w) => sum + w.text.length * 10, 0);
    expect(engine.state.score).toBe(before.score + base);
    expect(engine.state.completed).toBe(before.completed);
    expect(engine.state.spells.wind).toBe(before.wind);
    expect(engine.state.combo).toBe(1);
    expect(engine.state.missed).toBe(0);
    expect(burned).toHaveBeenCalledWith({ words, points: base });
  });

  it('Fire cannot finish a level', () => {
    const engine = makeEngine({ requiredWords: 2, spawnInterval: 10 }, { initialSpells: { fire: 1 } });
    stepUntilWords(engine, 2);
    cast(engine, 'fire');
    expect(engine.status).toBe('playing');
  });

  it('Ice stops movement and spawning for 8 seconds, then everything resumes', () => {
    const engine = makeEngine({ spawnInterval: 100 }, { initialSpells: { ice: 1 } });
    stepUntilWords(engine, 2);
    const word = engine.state.words[0]!;
    const count = engine.state.words.length;
    const ended = vi.fn();
    engine.events.on('spellEnded', ended);

    cast(engine, 'ice');
    const y = word.y;
    for (let i = 0; i < 479; i++) engine.step();
    expect(word.y).toBe(y);
    expect(engine.state.words.length).toBe(count);
    expect(ended).not.toHaveBeenCalled();

    engine.step(); // 480th tick = 8 s
    expect(ended).toHaveBeenCalledWith({ spell: 'ice' });
    engine.step();
    expect(word.y).toBeGreaterThan(y);
  });

  it('Ice stacks with decay: a cast while frozen adds 70% of the last one; a fresh freeze is full again', () => {
    const engine = makeEngine({ spawnInterval: 100 }, { initialSpells: { ice: 4 } });
    stepUntilWords(engine, 1);
    const word = engine.state.words[0]!;
    cast(engine, 'ice');
    for (let i = 0; i < 120; i++) engine.step(); // 2 s in
    cast(engine, 'ice');
    expect(engine.state.freezeTicks).toBe(360 + 336); // 6 s left + 5.6 s
    cast(engine, 'ice');
    expect(engine.state.freezeTicks).toBe(696 + 235); // + 3.92 s
    const y = word.y;
    for (let i = 0; i < 930; i++) engine.step();
    expect(word.y).toBe(y);
    engine.step();
    engine.step();
    expect(word.y).toBeGreaterThan(y);
    cast(engine, 'ice'); // thawed: back to a full 8 s
    expect(engine.state.freezeTicks).toBe(480);
  });

  it('typing still works while frozen', () => {
    const engine = makeEngine({}, { initialSpells: { ice: 1 } });
    stepUntilWords(engine, 1);
    cast(engine, 'ice');
    typeWord(engine, engine.state.words[0]!.text);
    expect(engine.state.completed).toBe(1);
  });

  it('Slow: words fall at ×0.6 for 8 seconds', () => {
    const engine = makeEngine({ spawnInterval: 100_000 }, { initialSpells: { slow: 1 } });
    stepUntilWords(engine, 1);
    const word = engine.state.words[0]!;
    cast(engine, 'slow');
    let y = word.y;
    engine.step();
    expect(word.y - y).toBeCloseTo(0.6); // 60 px/s × 0.6 = 0.6 px per tick
    for (let i = 0; i < 479; i++) engine.step();
    y = word.y;
    engine.step();
    expect(word.y - y).toBeCloseTo(1);
  });

  it('Slow stacks multiply, each with its own timer (the owner’s example)', () => {
    // Cast at 0 s and again at 4 s: 0–4 s ×0.6, 4–8 s ×0.36, 8–12 s ×0.6, then normal.
    const engine = makeEngine({ spawnInterval: 100_000 }, { initialSpells: { slow: 2 } });
    stepUntilWords(engine, 1);
    const word = engine.state.words[0]!;
    const perTick = () => {
      const y = word.y;
      engine.step();
      return word.y - y;
    };
    cast(engine, 'slow');
    expect(perTick()).toBeCloseTo(0.6);
    for (let i = 0; i < 239; i++) engine.step(); // now 4 s in
    cast(engine, 'slow');
    expect(perTick()).toBeCloseTo(0.36);
    for (let i = 0; i < 238; i++) engine.step();
    expect(perTick()).toBeCloseTo(0.36); // last tick of the overlap (8 s)
    expect(perTick()).toBeCloseTo(0.6); // first stack has worn off
    for (let i = 0; i < 238; i++) engine.step();
    expect(perTick()).toBeCloseTo(0.6); // 12 s: second stack's last tick
    expect(perTick()).toBeCloseTo(1);
  });

  it('Slow timers pause while frozen', () => {
    const engine = makeEngine({ spawnInterval: 100_000 }, { initialSpells: { slow: 1, ice: 1 } });
    stepUntilWords(engine, 1);
    cast(engine, 'slow');
    for (let i = 0; i < 60; i++) engine.step();
    cast(engine, 'ice');
    for (let i = 0; i < 300; i++) engine.step();
    expect(engine.state.slowStacks).toEqual([420]); // 8 s − 1 s, untouched by 5 s of frost
  });

  it('Arcane Shield blocks the next 2 misses, and stacks', () => {
    const engine = makeEngine({ initialFallSpeed: 600, spawnInterval: 300 }, { initialSpells: { barrier: 2 } });
    const blocked = vi.fn();
    engine.events.on('wordBlocked', blocked);
    cast(engine, 'barrier');
    cast(engine, 'barrier');
    expect(engine.state.barrier).toBe(4);
    for (let i = 0; i < 5000 && engine.state.blocked < 4; i++) engine.step();
    expect(engine.state.blocked).toBe(4);
    expect(engine.state.instability).toBe(0);
    expect(engine.state.missed).toBe(0);
    expect(blocked).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 5000 && engine.state.missed < 1; i++) engine.step();
    expect(engine.state.instability).toBe(25);
  });

  it('Chain Lightning destroys the lowest word and the 3 nearest it, scoring them', () => {
    const engine = makeEngine(
      { requiredWords: 100, spawnInterval: 10, maxActiveWords: 6 },
      { initialSpells: { shock: 1 } },
    );
    stepUntilWords(engine, 6);
    const words = [...engine.state.words];
    const first = words.reduce((a, b) => (b.y > a.y ? b : a));
    const dist = (w: WordState) => Math.hypot(w.x - first.x, w.y - first.y);
    const nearest = words.filter((w) => w !== first).sort((a, b) => dist(a) - dist(b)).slice(0, 3);
    const shocked = vi.fn();
    engine.events.on('wordsShocked', shocked);

    cast(engine, 'shock');

    const struck = [first, ...nearest];
    const points = struck.reduce((sum, w) => sum + w.text.length * 10, 0);
    expect(engine.state.words).toHaveLength(2);
    expect(engine.state.completed).toBe(4);
    expect(engine.state.score).toBe(points);
    expect(shocked).toHaveBeenCalledWith({ words: struck, points });
  });

  it('Transmutation turns 6+ letter words into 2–3 letter words, in place', () => {
    const engine = makeEngine(
      { spawnInterval: 10, maxActiveWords: 8, minWordLength: 3, maxWordLength: 10 },
      // Enough 2–3 letter words for every long word to become a distinct short one.
      { initialSpells: { alter: 1 }, words: [...TEST_WORDS, 'ox', 'ax', 'up', 'ivy', 'oak', 'ash', 'fog', 'jay', 'kit', 'pod'] },
    );
    stepUntilWords(engine, 8);
    const long = engine.state.words.filter((w) => w.text.length >= 6);
    expect(long.length).toBeGreaterThan(0);
    const before = long.map((w) => ({ id: w.id, x: w.x, y: w.y, speed: w.speed }));
    cast(engine, 'alter');
    for (const b of before) {
      const w = engine.state.words.find((x) => x.id === b.id)!;
      expect(w.text.length).toBeGreaterThanOrEqual(2);
      expect(w.text.length).toBeLessThanOrEqual(3);
      expect(w.match).toBe(w.text.toLowerCase());
      expect({ x: w.x, y: w.y, speed: w.speed }).toEqual({ x: b.x, y: b.y, speed: b.speed });
    }
    const texts = engine.state.words.map((w) => w.match);
    expect(new Set(texts).size).toBe(texts.length);
    // The new word can be typed and destroyed.
    typeWord(engine, engine.state.words.find((w) => w.id === before[0]!.id)!.text);
    expect(engine.state.completed).toBe(1);
  });

  it('Alter: for 8 seconds new words are short and easy, then the level\'s words return; shortened words stay short', () => {
    const engine = makeEngine(
      { spawnInterval: 100, maxActiveWords: 60, minWordLength: 6, maxWordLength: 10, initialFallSpeed: 900, instabilityPerMiss: 0.001 },
      { initialSpells: { alter: 1 } },
    );
    stepUntilWords(engine, 4);
    const long = engine.state.words.map((w) => w.id);
    cast(engine, 'alter');
    const shortened = engine.state.words.filter((w) => long.includes(w.id)).map((w) => ({ id: w.id, text: w.text }));
    const during: string[] = [];
    const after: string[] = [];
    let open = true;
    engine.events.on('spellEnded', ({ spell }) => {
      if (spell === 'alter') open = false;
    });
    engine.events.on('wordSpawned', ({ word }) => (open ? during : after).push(word.text));
    for (let i = 0; i < 8 * 60 + 200; i++) engine.step();
    expect(open).toBe(false);
    expect(during.length).toBeGreaterThan(10);
    for (const w of during) {
      expect(w.length).toBeLessThanOrEqual(5);
      expect(wordComplexity(w)).toBeLessThanOrEqual(0.5);
    }
    expect(after.length).toBeGreaterThan(0);
    for (const w of after) expect(w.length).toBeGreaterThanOrEqual(6);
    // Words shortened by the cast never grow back.
    for (const s of shortened) {
      const w = engine.state.words.find((x) => x.id === s.id);
      if (w) expect(w.text).toBe(s.text);
    }
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

  it('Wind restores a flat 50% in Hardcore too, never above full', () => {
    const engine = makeEngine({}, { initialSpells: { wind: 2 }, hardcore: true, initialInstability: 80 });
    cast(engine, 'wind');
    expect(engine.state.instability).toBe(30);
    cast(engine, 'wind');
    expect(engine.state.instability).toBe(0);
  });

  it('Harvest applies the combo and Clean Streak multipliers at the moment of casting, and leaves them unchanged', () => {
    const engine = makeEngine(
      { requiredWords: 100, spawnInterval: 10, maxActiveWords: 5 },
      { initialSpells: { harvest: 1 }, initialCombo: 12, initialCleanStreak: 15 },
    );
    stepUntilWords(engine, 5);
    const words = [...engine.state.words];
    const points = words.reduce((sum, w) => sum + Math.round(((w.text.length * 10) / 2) * 3 * 1.4), 0);
    cast(engine, 'harvest');
    expect(engine.state.score).toBe(points);
    expect(engine.state.completed).toBe(5);
    expect(engine.state.combo).toBe(12);
    expect(engine.state.cleanStreak).toBe(15);
  });

  it('Normal quick cast (number keys) casts without typing and keeps the console text; Hardcore refuses it', () => {
    const engine = makeEngine({}, { initialSpells: { ice: 1 } });
    stepUntilWords(engine, 1);
    engine.typeChar(engine.state.words[0]!.text[0]!);
    expect(engine.quickCast('ice')).toBe(true);
    expect(engine.state.freezeTicks).toBe(480);
    expect(engine.state.input.length).toBe(1);
    const fizzled = vi.fn();
    engine.events.on('spellFizzled', fizzled);
    engine.quickCast('ice');
    expect(fizzled).toHaveBeenCalledWith({ spell: 'ice' });
    const hard = makeEngine({}, { initialSpells: { ice: 1 }, hardcore: true });
    expect(hard.quickCast('ice')).toBe(false);
    expect(hard.state.spells.ice).toBe(1);
  });

  it('Harvest claims every word toward the quota at half points', () => {
    const engine = makeEngine(
      { requiredWords: 100, spawnInterval: 10, maxActiveWords: 5, availableSpells: ['ice'], spellDropChance: 1 },
      { initialSpells: { harvest: 1 } },
    );
    stepUntilWords(engine, 5);
    const words = [...engine.state.words];
    const points = words.reduce((sum, w) => sum + Math.floor((w.text.length * 10) / 2), 0);
    cast(engine, 'harvest');
    expect(engine.state.words).toHaveLength(0);
    expect(engine.state.completed).toBe(5);
    expect(engine.state.score).toBe(points);
    expect(engine.state.spells.ice).toBe(5); // scrolls are claimed too
  });

  it('Harvest can finish the level', () => {
    const engine = makeEngine({ requiredWords: 3, spawnInterval: 10 }, { initialSpells: { harvest: 1 } });
    stepUntilWords(engine, 3);
    cast(engine, 'harvest');
    expect(engine.status).toBe('won');
  });

  it('casts are recorded and replay identically', () => {
    const options = makeOptions(
      { spawnInterval: 500, availableSpells: [...SPELL_IDS], spellDropChance: 0.3, maxWordLength: 10 },
      { initialSpells: { slow: 1, ice: 1, barrier: 1, shock: 1, alter: 1, fire: 1, wind: 1, harvest: 1 } },
    );
    const live = new GameEngine(options);
    const plan: Record<number, string> = {
      300: 'ice', 600: 'slow', 900: 'barrier', 1200: 'shock', 1500: 'alter', 1900: 'fire', 2500: 'wind', 3000: 'harvest',
    };
    for (let t = 0; t < 4000 && live.status === 'playing'; t++) {
      live.step();
      if (t % 25 === 0 && live.state.words.length > 0) {
        const target = live.target ?? live.state.words[0]!;
        if (live.inputIsCompleteWord) live.submit();
        else if (live.inputValid) live.typeChar(target.match[target.typed]!);
        else live.clearInput();
      }
      if (plan[t]) cast(live, plan[t]!);
    }
    for (const id of SPELL_IDS) expect(live.state.spellsCast[id], id).toBe(1);
    const replayed = GameEngine.replay(options, live.commands, live.state.tick);
    expect(replayed.state).toEqual(live.state);
  });
});


describe('boss-to-Endless continuation', () => {
  it('starts Endless at the boss final pace rather than level 19', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      for (let stage = 1; stage <= 5; stage++) {
        const boss = stageLevel(mode, stage, 20);
        const endless = endlessConfig(mode, stage);
        expect(boss.ramp).toBeTruthy();
        expect(endless.initialFallSpeed).toBe(boss.ramp!.initialFallSpeed);
        expect(endless.spawnInterval).toBe(boss.ramp!.spawnInterval);
        expect(endless.maxActiveWords).toBe(boss.ramp!.maxActiveWords);
        expect(endless.survivalMs).toBeNull();
      }
    }
  });

  it('resumes the same words, positions, charges and combo after boss victory', () => {
    const boss = { ...CONFIG, survivalMs: 1000, initialFallSpeed: 2, spawnInterval: 100, maxActiveWords: 12 };
    const charges = { ...emptyCharges(), fire: 2 };
    const engine = new GameEngine(makeOptions(boss, { initialSpells: charges, initialCombo: 8 }));
    for (let i = 0; i < 61; i++) engine.step();
    expect(engine.status).toBe('won');
    const before = engine.state.words.map(w => ({ ...w }));
    const combo = engine.state.combo;
    const spells = { ...engine.state.spells };
    engine.continueIntoEndless({ ...boss, survivalMs: null, rampWords: 20, escalation: { perWords: 25, speed: 0.04, spawn: 0.04 } });
    expect(engine.status).toBe('playing');
    expect(engine.state.words).toEqual(before);
    expect(engine.state.spells).toEqual(spells);
    expect(engine.state.combo).toBe(combo);
    expect(engine.survivalRemainingMs).toBeNull();
  });
});

describe('Endless intensity and clutter', () => {
  it('cycles through buildup, surge, relief and settle without lowering the long-term floor', () => {
    const config = { ...CONFIG, initialFallSpeed: 0.01, spawnInterval: 1000, maxActiveWords: 8,
      escalation: { perWords: 25, speed: 0.04, spawn: 0.04 } };
    const engine = makeEngine(config);
    const changes: boolean[] = [];
    engine.events.on('surgeChanged', ({ active }) => changes.push(active));
    expect(engine.endlessWave.phase).toBe('build');
    const base = engine.pace.spawnInterval;
    for (let i = 0; i < 21 * 60; i++) engine.step();
    expect(engine.endlessWave.phase).toBe('surge');
    expect(engine.pace.spawnInterval).toBeLessThan(base);
    expect(changes).toContain(true);
    for (let i = 0; i < 13 * 60; i++) engine.step();
    expect(engine.endlessWave.phase).toBe('relief');
    expect(engine.pace.spawnInterval).toBeGreaterThan(base);
    expect(changes).toContain(false);
    for (let i = 0; i < 13 * 60; i++) engine.step();
    expect(engine.endlessWave.phase).toBe('settle');
    expect(engine.pace.spawnInterval).toBeCloseTo(base);
    for (let i = 0; i < 14 * 60; i++) engine.step();
    expect(engine.endlessWave.phase).toBe('build');
  });

  it('does not alter scroll spawn frequency when Slow is active', () => {
    const config = { ...CONFIG, initialFallSpeed: 0.01, spawnInterval: 100, maxActiveWords: 100,
      availableSpells: ['slow' as const], spellDropChance: 0.4 };
    const normal = makeEngine(config);
    const slowed = makeEngine(config, { initialSpells: { slow: 1 } });
    normal.step();
    slowed.step();
    cast(slowed, 'slow');
    for (let i = 0; i < 180; i++) { normal.step(); slowed.step(); }
    expect(slowed.state.words.length).toBe(normal.state.words.length);
    expect(slowed.state.words.filter(w => w.spell).length).toBe(normal.state.words.filter(w => w.spell).length);
  });

  it('keeps spawn positions within field bounds under top-field congestion', () => {
    const engine = makeEngine({ spawnInterval: 1, initialFallSpeed: 0.01, maxActiveWords: 5,
      minWordLength: 3, maxWordLength: 5, spellDropChance: 0 });
    for (let i = 0; i < 25; i++) engine.step();
    const words = engine.state.words;
    expect(words.length).toBeGreaterThanOrEqual(2);
    // At minimum, the lane picker must keep every word inside the field.
    for (const w of words) {
      expect(w.x).toBeGreaterThanOrEqual(FIELD.sideMargin + w.text.length * FIELD.approxCharWidth / 2);
      expect(w.x).toBeLessThanOrEqual(FIELD.width - FIELD.sideMargin - w.text.length * FIELD.approxCharWidth / 2);
    }
  });
});

describe('boss (survival) levels', () => {
  const boss = { requiredWords: null, survivalMs: 10_000, ramp: { initialFallSpeed: 120, spawnInterval: 500, maxActiveWords: 9 } };

  it('wins immediately when the timer expires, preserving falling words for Endless', () => {
    const engine = makeEngine({ ...boss, initialFallSpeed: 5, instabilityPerMiss: 1 });
    for (let i = 0; i < 599; i++) engine.step();
    expect(engine.status).toBe('playing');
    engine.step();
    expect(engine.status).toBe('won');
    expect(engine.state.words.length).toBeGreaterThan(0);
    expect(engine.state.windingDown).toBe(false);
  });

  it('does not require clearing the battlefield after boss victory', () => {
    const engine = makeEngine({ ...boss, initialFallSpeed: 5, instabilityPerMiss: 99 });
    for (let i = 0; i < 601; i++) engine.step();
    expect(engine.status).toBe('won');
    expect(engine.state.words.length).toBeGreaterThan(0);
  });

  it('speed up smoothly over the timer', () => {
    const engine = makeEngine(boss);
    expect(engine.pace).toEqual({ fallSpeed: 60, spawnInterval: 1000, maxActiveWords: 5 });
    for (let i = 0; i < 300; i++) engine.step(); // halfway
    expect(engine.pace.fallSpeed).toBeCloseTo(90);
    expect(engine.pace.spawnInterval).toBeCloseTo(750);
    expect(engine.pace.maxActiveWords).toBe(7);
  });

  it('normal levels keep a fixed pace and have no timer', () => {
    const engine = makeEngine({ requiredWords: 10 });
    for (let i = 0; i < 300; i++) engine.step();
    expect(engine.pace).toEqual({ fallSpeed: 60, spawnInterval: 1000, maxActiveWords: 5 });
    expect(engine.survivalRemainingMs).toBeNull();
  });
});

describe('fall speeds', () => {
  const speedsOf = (overrides: Partial<DifficultyConfig>, steps: number, onStep?: (e: GameEngine) => void) => {
    const engine = new GameEngine(makeOptions({ spawnInterval: 20, maxActiveWords: 500, initialFallSpeed: 100, ...overrides }));
    const speeds: number[] = [];
    engine.events.on('wordSpawned', ({ word }) => speeds.push(word.speed));
    for (let i = 0; i < steps; i++) {
      engine.step();
      onStep?.(engine);
    }
    return speeds;
  };

  it('vary from word to word around the level pace', () => {
    const speeds = speedsOf({ speedVariance: 0.25, speedRamp: 0, requiredWords: null }, 3000);
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(75);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(125);
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeGreaterThan(30);
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    expect(mean).toBeGreaterThan(95);
    expect(mean).toBeLessThan(105);
  });

  it('start slower and rise on average as the level progresses', () => {
    // No per-word variation here, so each speed shows the ramp exactly: ×0.85 at the start, ×1.15 at the quota.
    const engine = new GameEngine(makeOptions({ spawnInterval: 20, maxActiveWords: 1, initialFallSpeed: 100, requiredWords: 40, speedVariance: 0, speedRamp: 0.15 }));
    const seen: { completed: number; speed: number }[] = [];
    engine.events.on('wordSpawned', ({ word }) => seen.push({ completed: engine.state.completed, speed: word.speed }));
    for (let i = 0; i < 20000 && engine.status === 'playing'; i++) {
      engine.step();
      if (engine.state.words.length > 0) typeWord(engine, engine.state.words[0]!.text);
    }
    expect(engine.status).toBe('won');
    for (const { completed, speed } of seen) expect(speed).toBeCloseTo(100 * (0.85 + 0.3 * Math.min(1, completed / 40)));
    expect(seen[0]!.speed).toBeCloseTo(85);
    expect(seen.at(-1)!.speed).toBeGreaterThan(110);
  });

  it('Arcane Purge returns each word to its own starting speed', () => {
    const engine = new GameEngine(makeOptions({ speedVariance: 0.25 }, { initialSpells: { wind: 1 } }));
    stepUntilWords(engine, 1);
    const word = engine.state.words[0]!;
    engine.typeChar(word.text[0]!);
    engine.typeChar('z');
    engine.clearInput();
    expect(word.speed).toBeGreaterThan(word.baseSpeed);
    cast(engine, 'wind');
    expect(word.speed).toBe(word.baseSpeed);
  });
});


describe('campaign word lengths and pacing regression', () => {
  it('defines a signature length in every Normal stage and previews the next length', () => {
    for (let stage = 1; stage <= 5; stage++) {
      const first = stageLevel('normal', stage, 1);
      const signature = stage + 2;
      const weights = first.wordLengthWeights!;
      expect(weights[signature] ?? 0).toBeGreaterThan(weights[signature - 1] ?? 0);
      if (signature + 1 <= first.maxWordLength) {
        expect(weights[signature] ?? 0).toBeGreaterThan(weights[signature + 1] ?? 0);
        expect(weights[signature + 1] ?? 0).toBeGreaterThan(0);
      }
      expect(first.spawnInterval).toBeGreaterThan(0);
      expect(first.maxWordLength).toBeGreaterThanOrEqual(signature);
    }
  });

  it('has a substantial pool of distinct words for each signature length', () => {
    for (const length of [3, 4, 5, 6, 7]) {
      const words = WORDS.filter((word) => word.length === length);
      expect(words.length).toBeGreaterThan(100);
      expect(new Set(words.map((word) => word.toLowerCase())).size).toBe(words.length);
    }
  });

  it('makes three-letter words dominant early, with rare two-letter and preview four-letter words', () => {
    const first = stageLevel('normal', 1, 1);
    expect(first.maxWordLength).toBe(4);
    expect(first.wordLengthWeights?.[3]).toBeGreaterThan((first.wordLengthWeights?.[2] ?? 0) * 10);
    expect(first.wordLengthWeights?.[4]).toBeGreaterThan(0);
    const later = stageLevel('normal', 1, 13);
    expect(later.wordLengthWeights?.[4]).toBeGreaterThan(first.wordLengthWeights?.[4] ?? 0);
    expect(later.wordLengthWeights?.[2]).toBeLessThan(first.wordLengthWeights?.[2] ?? 1);
  });

  it('keeps a linear campaign baseline but provides relief after an ordinary surge', () => {
    const config = { ...stageLevel('normal', 1, 7), requiredWords: 100, openingWords: 0,
      initialFallSpeed: 0.01, speedRamp: 0, speedRampExtra: 0, spawnRamp: 0,
      surges: [{ at: 0, ms: 100 }] };
    const engine = new GameEngine({ config, seed: 8, words: TEST_WORDS });
    engine.step();
    expect(engine.state.surgeTicks).toBeGreaterThan(0);
    for (let i = 0; i < 7; i++) engine.step();
    expect(engine.state.surgeTicks).toBe(0);
    expect(engine.pace.spawnInterval).toBeCloseTo(config.spawnInterval * 1.25);
  });

  it('compounds Endless difficulty rather than adding the same amount each step', () => {
    const config = endlessConfig('normal', 1);
    const engine = new GameEngine({ config: { ...config, openingWords: 0, initialFallSpeed: 0.01, spawnInterval: 1, maxActiveWords: 100 }, seed: 4, words: TEST_WORDS });
    const base = engine.pace.fallSpeed;
    (engine.state as { completed: number }).completed = 25;
    const first = engine.pace.fallSpeed;
    (engine.state as { completed: number }).completed = 50;
    const second = engine.pace.fallSpeed;
    expect(second - first).toBeGreaterThan(first - base);
  });
});
