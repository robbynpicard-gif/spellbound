import { describe, expect, it } from 'vitest';
import { BARRIER_TUNING, GameEngine, type EngineOptions } from '../src/core/GameEngine';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import { addCharge, emptyCharges, SPELL_CAP_CANDIDATES } from '../src/gameplay/SpellManager';
import { SPELL_ORDER } from '../src/typel/apprenticeship';

/** D-115: the eight canonical spell identities, in the TypeL (experimental-scoring) engine path. */
const WORDS = ['ember', 'frost', 'wand', 'rune', 'owl', 'gale', 'quill', 'mist', 'labyrinth', 'phantasmal', 'yew', 'orb', 'elk', 'lantern'];
const CONFIG: DifficultyConfig = {
  speedVariance: 0, speedRamp: 0, level: 0, name: 'Test', requiredWords: null, initialFallSpeed: 30, spawnInterval: 300,
  maxActiveWords: 8, minWordLength: 3, maxWordLength: 10, modifierProbabilities: {}, instabilityPerMiss: 10,
  errorAcceleration: 0, availableSpells: [], spellDropChance: 0,
};
const mk = (extra: Partial<EngineOptions> = {}, cfg: Partial<DifficultyConfig> = {}) =>
  new GameEngine({ config: { ...CONFIG, ...cfg }, seed: 11, words: WORDS, experimentalScoring: true, ...extra });
const fill = (e: GameEngine, n: number) => {
  for (let i = 0; i < 20_000 && e.state.words.length < n; i++) e.step();
  expect(e.state.words.length).toBeGreaterThanOrEqual(n);
};
const cast = (e: GameEngine, spell: string) => {
  e.clearInput();
  for (const c of spell) e.typeChar(c);
  e.submit();
};
const pts = (e: GameEngine) => e.state.score - (e.stats().runePoints ?? 0);

describe('D-115 canonical spells', () => {
  it('the Academy teaches them in the canonical order', () => {
    expect(SPELL_ORDER).toEqual(['slow', 'barrier', 'wind', 'fire', 'ice', 'shock', 'alter', 'harvest']);
  });

  it('SLOW slows descent but spawning continues', () => {
    const slowed = mk({ initialSpells: { slow: 1 } });
    const plain = mk();
    fill(slowed, 1);
    fill(plain, 1);
    cast(slowed, 'slow');
    let spawned = 0;
    slowed.events.on('wordSpawned', () => spawned++);
    const y0 = slowed.state.words[0]!.y;
    const p0 = plain.state.words[0]!.y;
    for (let i = 0; i < 120; i++) (slowed.step(), plain.step());
    expect(spawned).toBeGreaterThan(0);
    expect(slowed.state.words.find((w) => w.id === 1)!.y - y0).toBeLessThan((plain.state.words.find((w) => w.id === 1)!.y - p0) * 0.7);
  });

  it('BARRIER blocks Ward breaches only, for a limited time, without stacking', () => {
    const e = mk({ initialSpells: { barrier: 2 } }, { initialFallSpeed: 400 });
    cast(e, 'barrier');
    cast(e, 'barrier');
    expect(e.state.barrier).toBe(BARRIER_TUNING.layers); // refreshed, not 4
    let blocked = 0;
    e.events.on('wordBlocked', () => blocked++);
    while (blocked === 0 && e.status === 'playing') e.step();
    expect(e.state.missed).toBe(0);
    expect(e.state.instability).toBe(0);
    // It expires on its own.
    const shield = mk({ initialSpells: { barrier: 1 } }, { initialFallSpeed: 1 });
    cast(shield, 'barrier');
    for (let i = 0; i < Math.round(BARRIER_TUNING.durationMs / (1000 / 60)) + 2; i++) shield.step();
    expect(shield.state.barrier).toBe(0);
  });

  it('WIND pushes scrolls back up, keeps them, and neither heals nor scores', () => {
    const e = mk({ initialSpells: { wind: 1 } }, { initialFallSpeed: 120, instabilityPerMiss: 20 });
    fill(e, 4);
    for (let i = 0; i < 200; i++) e.step();
    const before = new Map(e.state.words.map((w) => [w.id, { y: w.y, text: w.text, speed: w.speed }]));
    const instability = e.state.instability;
    const score = pts(e);
    cast(e, 'wind');
    for (const w of e.state.words) {
      const b = before.get(w.id)!;
      expect(w.y).toBeLessThan(b.y);
      expect(w.text).toBe(b.text);
      expect(w.speed).toBe(b.speed);
    }
    expect(e.state.words.length).toBe(before.size);
    expect(e.state.instability).toBe(instability);
    expect(pts(e)).toBe(score);
    expect(e.wardInfo.allInTicks).toBe(0);
  });

  it('FIRE destroys threats for zero points and no checkpoint progress', () => {
    const e = mk({ initialSpells: { fire: 1 }, initialCombo: 10 }, { initialFallSpeed: 120 });
    fill(e, 5);
    for (let i = 0; i < 300 && e.state.words.filter((w) => w.y > 360).length < 2; i++) e.step();
    const count = e.state.words.length;
    const score = pts(e);
    const completed = e.state.completed;
    cast(e, 'fire');
    expect(e.state.words.length).toBeLessThan(count);
    expect(pts(e)).toBe(score);
    expect(e.state.completed).toBe(completed);
    expect(e.state.combo).toBe(10);
  });

  it('ICE freezes movement and spawning while typing continues', () => {
    const e = mk({ initialSpells: { ice: 1 } });
    fill(e, 3);
    cast(e, 'ice');
    const ys = e.state.words.map((w) => w.y);
    let spawned = 0;
    e.events.on('wordSpawned', () => spawned++);
    for (let i = 0; i < 120; i++) e.step();
    expect(e.state.words.map((w) => w.y)).toEqual(ys);
    expect(spawned).toBe(0);
    const w = e.state.words[0]!;
    for (const c of w.match) e.typeChar(c);
    e.submit();
    expect(e.state.words.some((x) => x.id === w.id)).toBe(false);
  });

  it('SHOCK pays base × Combo, counts progress, and builds neither Combo nor Rush', () => {
    const e = mk({ initialSpells: { shock: 1 }, initialCombo: 12 });
    fill(e, 4);
    const completed = e.state.completed;
    const score = pts(e);
    cast(e, 'shock');
    expect(e.state.combo).toBe(12);
    expect(e.volleyMultiplier).toBe(1);
    expect(pts(e)).toBeGreaterThan(score);
    expect(e.state.completed).toBeGreaterThan(completed);
  });

  it('ALTER keeps the original base value of a shortened word', () => {
    const e = mk({ initialSpells: { alter: 1 } }, { minWordLength: 9, maxWordLength: 10 });
    fill(e, 2);
    cast(e, 'alter');
    const changed = e.state.words.find((w) => w.originalLength !== undefined)!;
    expect(changed.text.length).toBeLessThan(changed.originalLength!);
    const before = pts(e);
    for (const c of changed.match) e.typeChar(c);
    e.submit();
    expect(pts(e) - before).toBe(changed.originalLength! * 10);
  });

  it('HARVEST without a Rush still pays base × Combo and keeps Combo', () => {
    const e = mk({ initialSpells: { harvest: 1 }, initialCombo: 20 });
    fill(e, 3);
    const base = e.state.words.reduce((sum, w) => sum + w.text.length * 10, 0);
    const before = pts(e);
    cast(e, 'harvest');
    expect(pts(e) - before).toBe(base * 3);
    expect(e.state.combo).toBe(20);
    expect(e.state.words.length).toBe(0);
  });

  it('optional per-spell caps stop stockpiling one spell without affecting the shared bank', () => {
    const c = emptyCharges();
    expect(addCharge(c, 'harvest', 8, SPELL_CAP_CANDIDATES)).toBe(true);
    expect(addCharge(c, 'harvest', 8, SPELL_CAP_CANDIDATES)).toBe(false);
    expect(addCharge(c, 'slow', 8, SPELL_CAP_CANDIDATES)).toBe(true);
    const d = emptyCharges();
    expect(addCharge(d, 'harvest', 8)).toBe(true);
    expect(addCharge(d, 'harvest', 8)).toBe(true); // baseline: shared bank only
  });

  it('every spell cast is replay-deterministic', () => {
    const options: EngineOptions = { config: { ...CONFIG, initialFallSpeed: 80 }, seed: 11, words: WORDS, experimentalScoring: true, initialSpells: { shock: 1, wind: 1, fire: 1, alter: 1, barrier: 1 } };
    const e = new GameEngine(options);
    fill(e, 5);
    for (const s of ['wind', 'shock', 'alter', 'barrier', 'fire']) {
      for (let i = 0; i < 40; i++) e.step();
      cast(e, s);
    }
    for (let i = 0; i < 300; i++) e.step();
    const r = GameEngine.replay(options, e.commands, e.state.tick);
    expect(r.state.score).toBe(e.state.score);
    expect(r.state.words.map((w) => [w.id, w.text, Math.round(w.y)])).toEqual(e.state.words.map((w) => [w.id, w.text, Math.round(w.y)]));
  });
});
