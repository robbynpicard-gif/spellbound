import { describe, expect, it } from 'vitest';
import { FIELD } from '../src/core/GameConfig';
import { GameEngine } from '../src/core/GameEngine';
import { WORDS } from '../src/data/wordList';
import { apprenticeshipRun, SPELL_ORDER } from '../src/typel/apprenticeship';
import {
  cleanSandboxSettings, countWords, defaultSandboxSettings, LENGTH_PROFILES, sandboxPracticeConfig, sandboxStartingBank, unlimitedSpells, WpmTracker,
} from '../src/typel/practice';

/** D-125 Practice suite: Free Type speed, and the no-defeat configurable Sandbox. */
const cast = (e: GameEngine, spell: string) => {
  e.clearInput();
  for (const c of spell) e.typeChar(c);
  e.submit();
};
const sandbox = (over: Partial<ReturnType<typeof defaultSandboxSettings>> = {}) => {
  const st = { ...defaultSandboxSettings(), ...over };
  return {
    st,
    engine: new GameEngine({
      config: sandboxPracticeConfig(st), seed: 5, words: WORDS, experimentalScoring: true, poolLimitOverride: 60,
      initialSpells: sandboxStartingBank(st), practice: { noDefeat: true, unlimited: unlimitedSpells(st) },
    }),
  };
};

describe('Free Type WPM (D-125)', () => {
  it('reports nothing until a full window of typing, then 5 characters per word', () => {
    const t = new WpmTracker();
    for (let ms = 0; ms < 9000; ms += 200) t.key(ms); // 5 characters per second
    expect(t.stats(9000).rolling).toBeNull();
    expect(t.stats(9000).peak).toBeNull(); // no invalid startup extremes
    for (let ms = 9000; ms <= 20000; ms += 200) t.key(ms);
    const s = t.stats(20000);
    expect(s.rolling).toBeCloseTo(60, 0); // 5 chars/s = 300 chars/min = 60 WPM
    expect(Math.abs(s.average! - 60)).toBeLessThan(1.5); // the first keystroke adds one character, no time
    expect(s.peak).toBeCloseTo(60, 0);
    expect(s.lowest).toBeCloseTo(60, 0);
  });

  it('excludes thinking pauses from active time and shows a pause instead of a falling rate', () => {
    const t = new WpmTracker();
    for (let ms = 0; ms <= 12000; ms += 200) t.key(ms);
    const before = t.stats(12000).activeMs;
    expect(t.stats(20000).paused).toBe(true);
    expect(t.stats(20000).rolling).toBeNull();
    t.key(60000); // a minute of thinking adds nothing
    expect(t.stats(60000).activeMs).toBe(before);
    for (let ms = 60200; ms <= 72000; ms += 200) t.key(ms);
    expect(Math.abs(t.stats(72000).average! - 60)).toBeLessThan(1.5);
  });

  it('pastes do not count (only typed insertions are fed in), and reset clears statistics', () => {
    const t = new WpmTracker();
    t.key(0, 0); // a zero-length insertion is ignored
    expect(t.stats(0).typedChars).toBe(0);
    for (let ms = 0; ms <= 15000; ms += 100) t.key(ms);
    t.reset();
    expect(t.stats(16000)).toMatchObject({ rolling: null, average: null, peak: null, lowest: null, typedChars: 0, activeMs: 0 });
  });

  it('peak and lowest follow real changes of pace', () => {
    const t = new WpmTracker();
    for (let ms = 0; ms <= 12000; ms += 200) t.key(ms); // 60 WPM
    for (let ms = 12100; ms <= 24000; ms += 100) t.key(ms); // 120 WPM
    for (let ms = 24400; ms <= 40000; ms += 400) t.key(ms); // 30 WPM
    const s = t.stats(40000);
    expect(s.peak!).toBeGreaterThan(110);
    expect(s.lowest!).toBeLessThan(35);
  });

  it('counts words in free text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords("It's a well-known fact.\n\nNew paragraph, 2 words!")).toBe(8);
  });
});

describe('Sandbox (D-125)', () => {
  it('defaults: all eight spells enabled and unlimited, drops off, scoring on, escalation off', () => {
    const st = defaultSandboxSettings();
    expect(unlimitedSpells(st)).toEqual([...SPELL_ORDER]);
    const c = sandboxPracticeConfig(st);
    expect(c.director ?? null).toBeNull(); // classic fixed pace, no Director, no adaptation
    expect(c.escalation ?? null).toBeNull();
    expect(c.spellDropChance).toBe(0);
    expect(c.requiredWords).toBeNull();
    expect(c.spawnInterval).toBe(st.spawnMs);
    expect(c.initialFallSpeed).toBeCloseTo(FIELD.height / st.fallSeconds);
  });

  it('keeps settings inside their limits', () => {
    const st = cleanSandboxSettings({ ...defaultSandboxSettings(), spawnMs: 5, fallSeconds: 999, maxActive: 0 });
    expect(st.spawnMs).toBe(300);
    expect(st.fallSeconds).toBe(20);
    expect(st.maxActive).toBe(1);
  });

  it('never ends: unblocked breaches count as lost without draining the Ward', () => {
    const { engine } = sandbox({ fallSeconds: 3, spawnMs: 300, maxActive: 8 });
    for (let i = 0; i < 60 * 90; i++) engine.step();
    expect(engine.status).toBe('playing');
    expect(engine.state.missed).toBeGreaterThan(20);
    expect(engine.state.instability).toBe(0);
    expect(engine.wardInfo.stability).toBe(100);
  });

  it('unlimited spells keep their charge and their normal effects stack as usual', () => {
    const { engine } = sandbox();
    for (let i = 0; i < 60 && engine.state.words.length < 2; i++) engine.step();
    cast(engine, 'slow');
    cast(engine, 'slow');
    expect(engine.state.spells.slow).toBe(1);
    expect(engine.state.slowStacks.length).toBe(2); // the normal stacking rule
    expect(engine.state.spellsCast.slow).toBe(2);
  });

  it('disabled spells cannot be cast; limited spells spend charges', () => {
    const st = defaultSandboxSettings();
    st.spells.fire = { enabled: false, unlimited: true };
    st.spells.ice = { enabled: true, unlimited: false };
    const { engine } = sandbox({ spells: st.spells });
    expect(engine.state.spells.fire).toBe(0);
    let fizzled = 0;
    engine.events.on('spellFizzled', () => fizzled++);
    cast(engine, 'fire');
    expect(fizzled).toBe(1);
    expect(engine.state.spellsCast.fire).toBe(0);
    const ice = engine.state.spells.ice;
    cast(engine, 'ice');
    expect(engine.state.spells.ice).toBe(ice - 1);
    expect(sandboxPracticeConfig({ ...defaultSandboxSettings(), spells: st.spells }).availableSpells).not.toContain('fire');
  });

  it('effect timers only advance while the simulation steps (pause freezes them)', () => {
    const { engine } = sandbox();
    cast(engine, 'slow');
    const left = () => JSON.stringify(engine.state.slowStacks);
    const before = left();
    // paused: the scene simply stops calling step(), so nothing moves
    expect(left()).toBe(before);
    for (let i = 0; i < 30; i++) engine.step();
    expect(left()).not.toBe(before);
  });

  it('changed settings shape future spawns; existing scrolls keep their words', () => {
    const { st, engine } = sandbox({ lengths: 'short', spawnMs: 300, maxActive: 16 });
    for (let i = 0; i < 60 * 5; i++) engine.step();
    const kept = engine.state.words.map((w) => [w.id, w.text]);
    engine.updatePracticeConfig(sandboxPracticeConfig({ ...st, lengths: 'long' }));
    for (const [id, text] of kept) {
      const w = engine.state.words.find((x) => x.id === id);
      if (w) expect(w.text).toBe(text);
    }
    const later: number[] = [];
    engine.events.on('wordSpawned', ({ word }) => later.push(word.text.length));
    for (let i = 0; i < 60 * 10; i++) engine.step();
    expect(later.length).toBeGreaterThan(5);
    const long = Object.keys(LENGTH_PROFILES.long).map(Number);
    for (const n of later) expect(n).toBeGreaterThanOrEqual(Math.min(...long));
  });

  it('spell toggles can change mid-session', () => {
    const { engine } = sandbox();
    engine.setPracticeSpells(['slow'], { fire: 0, shock: 2 });
    expect(engine.state.spells.fire).toBe(0);
    cast(engine, 'shock');
    expect(engine.state.spells.shock).toBe(1); // no longer unlimited
    cast(engine, 'slow');
    expect(engine.state.spells.slow).toBe(1); // still unlimited
  });

  it('practice-only options are isolated: other modes still lose, and cannot be reconfigured', () => {
    const plan = apprenticeshipRun('normal', 1);
    const e = new GameEngine({ config: plan.segments[0]!.config, run: plan, seed: 3, words: WORDS, experimentalScoring: true });
    expect(() => e.updatePracticeConfig(sandboxPracticeConfig(defaultSandboxSettings()))).toThrow();
    expect(() => e.setPracticeSpells([], {})).toThrow();
    for (let i = 0; i < 60 * 600 && e.status === 'playing'; i++) e.step();
    expect(e.status).toBe('lost');
  });

  it('a fixed seed replays the same sky', () => {
    const st = { ...defaultSandboxSettings(), seed: 42 };
    const run = () => {
      const e = new GameEngine({ config: sandboxPracticeConfig(st), seed: 42, words: WORDS, experimentalScoring: true, initialSpells: sandboxStartingBank(st), practice: { noDefeat: true, unlimited: unlimitedSpells(st) } });
      for (let i = 0; i < 60 * 20; i++) e.step();
      return e.state.words.map((w) => [w.text, Math.round(w.x)]);
    };
    expect(run()).toEqual(run());
  });
});
