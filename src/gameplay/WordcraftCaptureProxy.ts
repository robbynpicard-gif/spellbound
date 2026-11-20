import { SeededRandom } from '../core/Random';
import { classifyWord } from './WordClasses';
import { PhraseTracker } from './PhraseTracker';

/** Offline capture-order proxy, not a GameEngine replay.
 * Spawn cadence, word lifetime, misses, and choice of target are explicit
 * assumptions. No scoring, player input or multiplayer rules are modified. */
export interface CaptureProxy {
  captured: number;
  missed: number;
  phrases: number;
  classifiedCaptures: number;
}

export interface CaptureScenario {
  /** Maximum words concurrently available for capture. */
  fieldSize: number;
  /** Chance a simulated target is missed rather than captured. */
  missChance: number;
  /** 'oldest' follows arrival order; 'random' models target choice. */
  target: 'oldest' | 'random';
}

export function simulateCaptureOrder(
  spawned: readonly string[],
  scenario: CaptureScenario,
  seed: number,
): CaptureProxy {
  if (!Number.isInteger(scenario.fieldSize) || scenario.fieldSize < 1) throw new RangeError('fieldSize must be positive');
  if (!(scenario.missChance >= 0 && scenario.missChance <= 1)) throw new RangeError('missChance must be in [0, 1]');
  const rng = new SeededRandom(seed);
  const tracker = new PhraseTracker();
  const field: string[] = [];
  let captured = 0;
  let missed = 0;
  let classifiedCaptures = 0;
  const resolve = () => {
    const index = scenario.target === 'oldest' ? 0 : rng.int(0, field.length - 1);
    const [word] = field.splice(index, 1);
    if (rng.chance(scenario.missChance)) {
      missed++;
      tracker.breakChain();
    } else {
      captured++;
      if (classifyWord(word)) classifiedCaptures++;
      tracker.capture(word);
    }
  };
  for (const word of spawned) {
    if (!word) {
      while (field.length) resolve();
      tracker.breakChain();
      continue;
    }
    field.push(word);
    if (field.length >= scenario.fieldSize) resolve();
  }
  while (field.length) resolve();
  return { captured, missed, classifiedCaptures, phrases: Object.values(tracker.counts).reduce((a, b) => a + b, 0) };
}
