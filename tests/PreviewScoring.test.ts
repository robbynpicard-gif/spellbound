import { describe, expect, it } from 'vitest';
import { GameEngine, type EngineOptions } from '../src/core/GameEngine';

const config: EngineOptions['config'] = {
  speedVariance: 0, speedRamp: 0, level: 0, name: 'Preview Scoring',
  requiredWords: null, initialFallSpeed: 0, spawnInterval: 1000,
  maxActiveWords: 5, minWordLength: 4, maxWordLength: 4,
  modifierProbabilities: {}, instabilityPerMiss: 25,
  errorAcceleration: 30, availableSpells: [], spellDropChance: 0,
};
function engine(initialCombo = 0): GameEngine {
  return new GameEngine({ config, seed: 17, words: ['rune', 'wand', 'mist', 'gale'], initialCombo, experimentalScoring: true });
}
function capture(e: GameEngine): void {
  for (let i = 0; i < 10000 && !e.state.words.length; i++) e.step();
  const word = e.state.words[0];
  if (!word) throw new Error('word did not spawn');
  for (const letter of word.text) e.typeChar(letter);
  e.submit();
}
describe('solo preview scoring integration', () => {
  it('scores a normal four-letter capture at exactly forty points', () => {
    const e = engine();
    capture(e);
    expect(e.state.score).toBe(40);
    expect(e.state.combo).toBe(1);
  });
  it('uses the new multiplier on the tenth perfect capture', () => {
    const e = engine(9);
    capture(e);
    expect(e.state.combo).toBe(10);
    expect(e.state.score).toBe(80);
  });
  it('resets Combo immediately on an incorrect key even if corrected', () => {
    const e = engine(19);
    for (let i = 0; i < 10000 && !e.state.words.length; i++) e.step();
    e.typeChar('z');
    expect(e.state.combo).toBe(0);
  });
});
