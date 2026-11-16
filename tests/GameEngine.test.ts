import { describe, expect, it, vi } from 'vitest';
import { GameEngine, MAX_INPUT_LENGTH, type EngineOptions } from '../src/core/GameEngine';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import type { WordState } from '../src/gameplay/Word';

const TEST_WORDS = ['ember', 'frost', 'wand', 'rune', 'owl', 'gale', 'quill', 'mist'];

const BASE_CONFIG: DifficultyConfig = {
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

function makeOptions(overrides: Partial<DifficultyConfig> = {}, seed = 1, words = TEST_WORDS): EngineOptions {
  return { config: { ...BASE_CONFIG, ...overrides }, seed, words };
}

function makeEngine(overrides: Partial<DifficultyConfig> = {}, seed = 1, words = TEST_WORDS): GameEngine {
  return new GameEngine(makeOptions(overrides, seed, words));
}

/** Step until at least `count` words are on the field. */
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

function firstWord(engine: GameEngine): WordState {
  stepUntilWords(engine, 1);
  return engine.state.words[0]!;
}

/** Overwrite a word's text for a test (keeps display and match in sync). */
function setText(word: WordState, text: string): void {
  Object.assign(word, { text, match: text.toLowerCase() });
}

describe('GameEngine — spawning and movement', () => {
  it('spawns a word after the first delay and moves it down', () => {
    const engine = makeEngine();
    expect(engine.state.words).toHaveLength(0);
    const word = firstWord(engine);
    expect(word.y).toBe(0);
    engine.step();
    expect(word.y).toBeCloseTo(60 / 60); // 60 px/s at 60 ticks/s = 1 px per tick
    expect(word.prevY).toBe(0);
  });

  it('never exceeds maxActiveWords', () => {
    const engine = makeEngine({ maxActiveWords: 3, spawnInterval: 100, initialFallSpeed: 1 });
    for (let i = 0; i < 2000; i++) engine.step();
    expect(engine.state.words.length).toBe(3);
  });

  it('keeps words inside the field horizontally', () => {
    const engine = makeEngine({ spawnInterval: 50, initialFallSpeed: 0, maxActiveWords: 8 });
    stepUntilWords(engine, 8);
    for (const w of engine.state.words) {
      const half = (w.text.length * 17) / 2;
      expect(w.x - half).toBeGreaterThanOrEqual(32);
      expect(w.x + half).toBeLessThanOrEqual(1280 - 32);
    }
  });
});

describe('GameEngine — typing console', () => {
  it('destroys a word when Enter is pressed on its exact text, then clears the console', () => {
    const engine = makeEngine();
    const completed = vi.fn();
    engine.events.on('wordCompleted', completed);
    const word = firstWord(engine);

    type(engine, word.text);
    expect(engine.state.words).toContain(word); // fully typed but not yet submitted
    expect(engine.inputIsCompleteWord).toBe(true);
    engine.submit();

    expect(engine.state.words).not.toContain(word);
    expect(engine.state.completed).toBe(1);
    expect(engine.state.score).toBe(word.text.length * 10);
    expect(engine.state.input).toBe('');
    expect(engine.state.targetId).toBeNull();
    expect(completed).toHaveBeenCalledOnce();
  });

  it('is case-insensitive in both directions', () => {
    const engine = makeEngine({}, 1, ['Merlin', 'Odin', 'Arthur']);
    const word = firstWord(engine);
    expect(word.match).toBe(word.text.toLowerCase());
    type(engine, word.text.toUpperCase().slice(0, 2));
    expect(engine.state.input).toBe(word.match.slice(0, 2));
    typeWord(engine, word.text.slice(2).toLowerCase());
    expect(engine.state.completed).toBe(1);
  });

  it('aims at the most urgent word that matches the console text', () => {
    const engine = makeEngine();
    stepUntilWords(engine, 2);
    const [a, b] = engine.state.words as [WordState, WordState];
    setText(a, 'mist');
    setText(b, 'moon');
    a.y = 100;
    b.y = 300;

    engine.typeChar('m');
    expect(engine.state.targetId).toBe(b.id);
    expect(b.typed).toBe(1);

    engine.typeChar('i'); // only "mist" matches now
    expect(engine.state.targetId).toBe(a.id);
    expect(a.typed).toBe(2);
    expect(b.typed).toBe(0);
  });

  it('a key that breaks the match is an error: attempted word speeds up once, combo resets', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    engine.typeChar(word.text[0]!);
    const speedBefore = word.speed;

    engine.typeChar('z'); // no test word has 'z' as a second letter
    expect(engine.state.errors).toBe(1);
    expect(engine.state.combo).toBe(0);
    expect(word.speed).toBe(speedBefore + 30);
    expect(engine.state.targetId).toBe(word.id);
    expect(word.typed).toBe(1);
    expect(engine.inputValid).toBe(false);
    expect(engine.validPrefixLength).toBe(1);

    engine.typeChar('z'); // still wrong: not a second error, no extra speed-up
    expect(engine.state.errors).toBe(1);
    expect(word.speed).toBe(speedBefore + 30);
  });

  it('Backspace fixes a mistake without further penalty', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    type(engine, word.text[0]! + 'z');
    engine.backspace();
    expect(engine.state.input).toBe(word.match[0]);
    expect(engine.inputValid).toBe(true);
    typeWord(engine, word.text.slice(1));
    expect(engine.state.completed).toBe(1);
    expect(engine.state.errors).toBe(1);
  });

  it('a key matching no word (and no spell) is an error that changes nothing else', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    engine.typeChar('x');
    expect(engine.state.errors).toBe(1);
    expect(engine.state.targetId).toBeNull();
    expect(word.speed).toBe(60);
  });

  it('spell-name prefixes are valid even when no word matches', () => {
    const engine = makeEngine({}, 1, ['owl', 'quill']);
    firstWord(engine);
    type(engine, 'sl');
    expect(engine.inputValid).toBe(true);
    expect(engine.state.errors).toBe(0);
    expect(engine.state.targetId).toBeNull();
  });

  it('a word that shares a spell’s first letter is released once the text only fits the spell', () => {
    const engine = makeEngine();
    const soot = firstWord(engine);
    setText(soot, 'soot');
    engine.typeChar('s');
    expect(engine.state.targetId).toBe(soot.id);
    engine.typeChar('l');
    expect(engine.state.targetId).toBeNull();
    expect(soot.typed).toBe(0);
    expect(engine.state.errors).toBe(0);
  });

  it('ignores non-letters and caps console length', () => {
    const engine = makeEngine();
    firstWord(engine);
    expect(engine.typeChar('1')).toBe(false);
    expect(engine.typeChar(' ')).toBe(false);
    for (let i = 0; i < 40; i++) engine.typeChar('x');
    expect(engine.state.input).toHaveLength(MAX_INPUT_LENGTH);
  });

  it('clearInput empties the console with no penalty', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    type(engine, word.text.slice(0, 2));
    engine.clearInput();
    expect(engine.state.input).toBe('');
    expect(engine.state.targetId).toBeNull();
    expect(word.typed).toBe(0);
    expect(engine.state.errors).toBe(0);
  });

  it('clicking a word aims the console only at that word', () => {
    const engine = makeEngine();
    stepUntilWords(engine, 2);
    const [a, b] = engine.state.words as [WordState, WordState];
    setText(a, 'moon');
    setText(b, 'mist');
    a.y = 300; // a is more urgent, but b is clicked
    engine.selectTarget(b.id);
    engine.typeChar('m');
    expect(engine.state.targetId).toBe(b.id);
    typeWord(engine, 'ist');
    expect(engine.state.words).not.toContain(b);
    expect(engine.state.pinnedId).toBeNull();
  });

  it('combo grows with clean words and boosts points', () => {
    const engine = makeEngine({ spawnInterval: 10 });
    stepUntilWords(engine, 3);
    const words = [...engine.state.words];
    for (const w of words) typeWord(engine, w.text);
    expect(engine.state.combo).toBe(3);
    const expected = words.reduce((sum, w, i) => sum + Math.round(w.text.length * 10 * (1 + i * 0.05)), 0);
    expect(engine.state.score).toBe(expected);
  });

  it('a word that falls through while being typed empties the console', () => {
    const engine = makeEngine({ initialFallSpeed: 600 });
    const word = firstWord(engine);
    engine.typeChar(word.text[0]!);
    for (let i = 0; i < 70 && engine.state.words.includes(word); i++) engine.step();
    expect(engine.state.input).toBe('');
  });
});

describe('GameEngine — Enter (submit)', () => {
  it('a word that starts another word: Enter destroys the exact one', () => {
    const engine = makeEngine();
    stepUntilWords(engine, 2);
    const [short, long] = engine.state.words as [WordState, WordState];
    setText(short, 'star');
    setText(long, 'starlight');
    short.y = 50;
    long.y = 300; // the longer word is more urgent

    type(engine, 'sta');
    expect(engine.state.targetId).toBe(long.id);
    engine.typeChar('r'); // now "star" is complete → it becomes the target
    expect(engine.state.targetId).toBe(short.id);
    engine.submit();
    expect(engine.state.words).not.toContain(short);
    expect(engine.state.words).toContain(long);
    expect(engine.state.errors).toBe(0);
  });

  it('Enter on an incomplete word penalises that word and clears the console', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    const missed = vi.fn();
    engine.events.on('submitMissed', missed);
    type(engine, word.text.slice(0, 2));

    engine.submit();
    expect(missed).toHaveBeenCalledWith({ input: word.match.slice(0, 2), wordId: word.id });
    expect(word.speed).toBe(90);
    expect(engine.state.errors).toBe(1);
    expect(engine.state.combo).toBe(0);
    expect(engine.state.input).toBe('');
    expect(word.typed).toBe(0);
    expect(engine.state.words).toContain(word);
  });

  it('Enter on a misspelling finds the intended word', () => {
    const engine = makeEngine({ spawnInterval: 10 }, 1, ['dragon', 'quill', 'owl', 'ember']);
    stepUntilWords(engine, 3);
    const dragon = engine.state.words.find((w) => w.match === 'dragon')!;
    const missed = vi.fn();
    engine.events.on('submitMissed', missed);
    type(engine, 'dargon');
    engine.submit();
    expect(missed).toHaveBeenCalledWith({ input: 'dargon', wordId: dragon.id });
    // The typo already sped dragon up once; Enter in the same entry doesn't add a second.
    expect(dragon.speed).toBe(90);
    expect(engine.state.errors).toBe(1); // one slip ('a'), and Enter adds nothing for the same word

  });

  it('Enter on gibberish penalises nobody but still clears and counts an error', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    const missed = vi.fn();
    engine.events.on('submitMissed', missed);
    type(engine, 'xxxxzz');
    const errors = engine.state.errors;
    expect(errors).toBe(1);
    engine.submit();
    expect(missed).toHaveBeenCalledWith({ input: 'xxxxzz', wordId: null });
    expect(word.speed).toBe(60);
    expect(engine.state.errors).toBe(errors + 1);
    expect(engine.state.input).toBe('');
  });

  it('Enter on an empty console does nothing', () => {
    const engine = makeEngine();
    firstWord(engine);
    engine.submit();
    expect(engine.commands).toHaveLength(0);
  });
});

describe('GameEngine — instability and game end', () => {
  it('a missed word raises instability and resets combo', () => {
    const engine = makeEngine({ initialFallSpeed: 600 });
    const missed = vi.fn();
    engine.events.on('wordMissed', missed);
    firstWord(engine);
    for (let i = 0; i < 61; i++) engine.step();
    expect(engine.state.missed).toBeGreaterThanOrEqual(1);
    expect(engine.state.instability).toBe(25 * engine.state.missed);
    expect(missed).toHaveBeenCalled();
  });

  it('collapses (loses) at 100% instability and then stops', () => {
    const engine = makeEngine({ initialFallSpeed: 600, spawnInterval: 200 });
    const over = vi.fn();
    engine.events.on('gameOver', over);
    for (let i = 0; i < 5000 && engine.status === 'playing'; i++) engine.step();

    expect(engine.status).toBe('lost');
    expect(engine.state.instability).toBe(100);
    expect(engine.state.missed).toBe(4);
    expect(over).toHaveBeenCalledOnce();

    const tick = engine.state.tick;
    engine.step();
    engine.typeChar('a');
    expect(engine.state.tick).toBe(tick);
    expect(engine.state.input).toBe('');
  });

  it('wins when the word quota is reached', () => {
    const engine = makeEngine({ requiredWords: 2, spawnInterval: 10 });
    stepUntilWords(engine, 2);
    for (const w of [...engine.state.words]) typeWord(engine, w.text);
    expect(engine.status).toBe('won');
  });
});

describe('GameEngine — determinism', () => {
  it('the same seed produces the same words', () => {
    const a = makeEngine({ spawnInterval: 100, initialFallSpeed: 1 }, 77);
    const b = makeEngine({ spawnInterval: 100, initialFallSpeed: 1 }, 77);
    stepUntilWords(a, 5);
    stepUntilWords(b, 5);
    expect(a.state.words.map((w) => [w.text, w.x])).toEqual(b.state.words.map((w) => [w.text, w.x]));
  });

  it('replaying the command log reproduces the game exactly', () => {
    const options = makeOptions({ spawnInterval: 700 }, 2024);
    const live = new GameEngine(options);

    // A simulated player: types the next letter of its target, makes the
    // odd mistake (and fixes it), occasionally presses Enter early or clears.
    for (let t = 0; t < 3000 && live.status === 'playing'; t++) {
      live.step();
      if (t % 20 === 0 && live.state.words.length > 0) {
        if (!live.inputValid) live.backspace();
        else {
          const target = live.target ?? live.state.words[0]!;
          if (live.inputIsCompleteWord) live.submit();
          else live.typeChar(t % 140 === 0 ? 'z' : target.match[target.typed]!);
        }
      }
      if (t === 1500) live.clearInput();
      if (t === 2200) live.submit();
    }

    const replayed = GameEngine.replay(options, live.commands, live.state.tick);
    expect(replayed.state).toEqual(live.state);
    expect(replayed.stats()).toEqual(live.stats());
  });
});

describe('GameEngine — identical word sequence for every player (GDD §15.1)', () => {
  it('two players with the same seed get the same words in the same order, whatever they do', () => {
    const config = { spawnInterval: 300, maxActiveWords: 5, instabilityPerMiss: 0.5 };
    const fast = makeEngine(config, 31337, TEST_WORDS.concat(['dragon', 'phoenix', 'raven', 'tower', 'sigil']));
    const idle = makeEngine(config, 31337, TEST_WORDS.concat(['dragon', 'phoenix', 'raven', 'tower', 'sigil']));
    const spawned = (e: GameEngine) => {
      const list: string[] = [];
      e.events.on('wordSpawned', ({ word }) => list.push(word.text));
      return list;
    };
    const fastWords = spawned(fast);
    const idleWords = spawned(idle);

    // "fast" destroys every word immediately; "idle" types nothing and lets words fall.
    for (let t = 0; t < 6000; t++) {
      fast.step();
      idle.step();
      const w = fast.state.words[0];
      if (w) {
        type(fast, w.text);
        fast.submit();
      }
      if (idle.status !== 'playing') break;
    }
    const n = Math.min(fastWords.length, idleWords.length);
    expect(n).toBeGreaterThan(10);
    expect(fastWords.slice(0, n)).toEqual(idleWords.slice(0, n));
  });
});
