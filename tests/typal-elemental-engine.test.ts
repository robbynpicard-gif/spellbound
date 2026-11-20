import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import { wordPoints } from '../src/gameplay/ScoringSystem';

const config: DifficultyConfig = {
  level: 0, name: 'Elemental integration', requiredWords: null,
  initialFallSpeed: 0, spawnInterval: 50, maxActiveWords: 5,
  minWordLength: 3, maxWordLength: 8, modifierProbabilities: {},
  instabilityPerMiss: 25, errorAcceleration: 30,
  availableSpells: [], spellDropChance: 0, speedVariance: 0, speedRamp: 0,
};

function engine(overrides: Partial<DifficultyConfig> = {}): GameEngine {
  return new GameEngine({
    config: { ...config, ...overrides }, seed: 41, words: ['ember', 'frost', 'rune'],
    initialSpells: { ice: 2, fire: 2, shock: 2, wind: 2 },
  });
}

describe('elemental spells in the real simulation', () => {
  it('emits a melting reaction and boosts fire spell points', () => {
    const game = engine({ initialFallSpeed: 500, spawnInterval: 50 });
    for (let i = 0; i < 45; i++) game.step();
    const eligible = game.state.words.filter(w => w.y >= 0.2 * 720);
    const reaction = vi.fn();
    const burned = vi.fn();
    game.events.on('elementalReaction', reaction);
    game.events.on('wordsBurned', burned);
    game.quickCast('ice');
    game.quickCast('fire');
    expect(reaction).toHaveBeenCalledWith(expect.objectContaining({
      previous: 'ice', incoming: 'fire', reaction: 'melt', damageMultiplier: 1.5,
    }));
    if (eligible.length > 0) {
      const expected = eligible.reduce((sum, w) => sum + Math.round(wordPoints(w.text.length, 1) * 1.5), 0);
      expect(burned).toHaveBeenCalledWith(expect.objectContaining({ points: expected }));
    }
  });

  it('reacts to fire followed by wind without awarding damage for wind', () => {
    const game = engine();
    const reaction = vi.fn();
    game.events.on('elementalReaction', reaction);
    game.quickCast('fire');
    game.quickCast('wind');
    expect(reaction).toHaveBeenCalledWith(expect.objectContaining({
      reaction: 'fan', damageMultiplier: 1.25,
    }));
    expect(game.state.score).toBe(0);
  });

  it('does not react when elemental status has expired', () => {
    const game = engine();
    const reaction = vi.fn();
    game.events.on('elementalReaction', reaction);
    game.quickCast('ice');
    for (let i = 0; i < 500; i++) game.step();
    game.quickCast('fire');
    expect(reaction).not.toHaveBeenCalled();
  });

  it('scores ordinary lightning with its normal base multiplier', () => {
    const game = engine();
    for (let i = 0; i < 5; i++) game.step();
    const before = [...game.state.words].sort((a, b) => b.y - a.y);
    game.quickCast('shock');
    const removed = before.filter(w => !game.state.words.some(other => other.id === w.id));
    const expected = removed.reduce((sum, w) => sum + wordPoints(w.text.length, 1), 0);
    expect(game.state.score).toBe(expected);
  });
});
