import { describe, expect, it, vi } from 'vitest';
import { GameEngine, type EngineOptions } from '../src/core/GameEngine';
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
};

function makeOptions(overrides: Partial<DifficultyConfig> = {}, seed = 1): EngineOptions {
  return { config: { ...BASE_CONFIG, ...overrides }, seed, words: TEST_WORDS };
}

function makeEngine(overrides: Partial<DifficultyConfig> = {}, seed = 1): GameEngine {
  return new GameEngine(makeOptions(overrides, seed));
}

/** Step until at least `count` words are on the field. */
function stepUntilWords(engine: GameEngine, count: number): void {
  for (let i = 0; i < 10_000 && engine.state.words.length < count; i++) engine.step();
  expect(engine.state.words.length).toBeGreaterThanOrEqual(count);
}

function type(engine: GameEngine, text: string): void {
  for (const ch of text) engine.typeChar(ch);
}

/** Put a known word on the field by mutating test state (keeps tests readable). */
function firstWord(engine: GameEngine): WordState {
  stepUntilWords(engine, 1);
  return engine.state.words[0]!;
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

describe('GameEngine — typing', () => {
  it('completes a word typed correctly and awards points', () => {
    const engine = makeEngine();
    const completed = vi.fn();
    engine.events.on('wordCompleted', completed);
    const word = firstWord(engine);

    type(engine, word.text);

    expect(engine.state.words).not.toContain(word);
    expect(engine.state.completed).toBe(1);
    expect(engine.state.score).toBe(word.text.length * 10);
    expect(engine.state.targetId).toBeNull();
    expect(completed).toHaveBeenCalledOnce();
  });

  it('auto-targets the lowest word that starts with the typed letter', () => {
    const engine = makeEngine();
    stepUntilWords(engine, 2);
    const [a, b] = engine.state.words as [WordState, WordState];
    // Force both words to share a first letter by using a known pair.
    (a as { text: string }).text = 'mist';
    (b as { text: string }).text = 'moon';
    a.y = 100;
    b.y = 300;

    engine.typeChar('m');
    expect(engine.state.targetId).toBe(b.id);
    expect(b.typed).toBe(1);
  });

  it('a wrong key on the target is an error: speeds the word up, resets combo, keeps target', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    engine.typeChar(word.text[0]!);
    const speedBefore = word.speed;

    engine.typeChar('z'); // no test word has 'z' as a second letter

    expect(engine.state.errors).toBe(1);
    expect(engine.state.combo).toBe(0);
    expect(word.speed).toBe(speedBefore + 30);
    expect(word.errors).toBe(1);
    expect(engine.state.targetId).toBe(word.id);
    expect(word.typed).toBe(1);
  });

  it('a key matching no word counts as an error but changes nothing else', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    const errorSpy = vi.fn();
    engine.events.on('typingError', errorSpy);

    engine.typeChar('z');

    expect(engine.state.errors).toBe(1);
    expect(engine.state.targetId).toBeNull();
    expect(word.speed).toBe(60);
    expect(errorSpy).toHaveBeenCalledWith({ wordId: null, char: 'z' });
  });

  it('ignores non-letter keys and accepts upper case', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    expect(engine.typeChar('1')).toBe(false);
    expect(engine.typeChar(' ')).toBe(false);
    expect(engine.state.errors).toBe(0);
    engine.typeChar(word.text[0]!.toUpperCase());
    expect(word.typed).toBe(1);
  });

  it('abandon (Backspace) clears the target and its progress', () => {
    const engine = makeEngine();
    const word = firstWord(engine);
    type(engine, word.text.slice(0, 2));
    engine.abandon();
    expect(engine.state.targetId).toBeNull();
    expect(word.typed).toBe(0);
    expect(word.isTarget).toBe(false);
    expect(engine.state.errors).toBe(0);
  });

  it('clicking another word switches target and resets the old one', () => {
    const engine = makeEngine();
    stepUntilWords(engine, 2);
    const [a, b] = engine.state.words as [WordState, WordState];
    type(engine, a.text.slice(0, 2));
    engine.selectTarget(b.id);
    expect(engine.state.targetId).toBe(b.id);
    expect(a.typed).toBe(0);
    expect(b.isTarget).toBe(true);
    engine.typeChar(b.text[0]!);
    expect(b.typed).toBe(1);
  });

  it('combo grows with clean words and boosts points', () => {
    const engine = makeEngine({ spawnInterval: 10 });
    stepUntilWords(engine, 3);
    const words = [...engine.state.words];
    for (const w of words) type(engine, w.text);
    expect(engine.state.combo).toBe(3);
    expect(engine.state.maxCombo).toBe(3);
    const expected = words.reduce(
      (sum, w, i) => sum + Math.round(w.text.length * 10 * (1 + i * 0.05)),
      0,
    );
    expect(engine.state.score).toBe(expected);
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
    expect(over.mock.calls[0]![0].result).toBe('lost');

    const tick = engine.state.tick;
    engine.step();
    engine.typeChar('a');
    expect(engine.state.tick).toBe(tick);
  });

  it('wins when the word quota is reached', () => {
    const engine = makeEngine({ requiredWords: 2, spawnInterval: 10 });
    stepUntilWords(engine, 2);
    for (const w of [...engine.state.words]) type(engine, w.text);
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

    // Simulate a player: every 20 ticks type the next letter of the lowest
    // word, occasionally making a mistake.
    for (let t = 0; t < 3000 && live.status === 'playing'; t++) {
      live.step();
      if (t % 20 === 0 && live.state.words.length > 0) {
        const target = live.target ?? live.state.words[0]!;
        live.typeChar(t % 140 === 0 ? 'z' : target.text[target.typed]!);
      }
      if (t === 1500) live.abandon();
    }

    const replayed = GameEngine.replay(options, live.commands, live.state.tick);
    expect(replayed.state).toEqual(live.state);
    expect(replayed.stats()).toEqual(live.stats());
  });
});
