import { GameEngine } from '../core/GameEngine';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { PhraseTracker } from './PhraseTracker';

/** Real GameEngine run with a deterministic synthetic typist.
 * No browser, Phaser, modified generator, or live gameplay changes.
 * The bot types one character per configured number of engine ticks and
 * targets the oldest word, using actual GameEngine input commands.
 * This is not a human-player performance prediction. */
export interface EngineWordcraftReport {
  seed: number;
  ticks: number;
  spawned: number;
  captured: number;
  missed: number;
  phrases: number;
  maxConcurrentWords: number;
  finalStatus: string;
  replayMatched: boolean;
}

export function simulateEngineWordcraft(
  words: readonly string[],
  config: DifficultyConfig,
  seed: number,
  maxTicks = 2400,
  ticksPerCharacter = 3,
): EngineWordcraftReport {
  if (!Number.isInteger(maxTicks) || maxTicks < 1) throw new RangeError('maxTicks must be positive');
  if (!Number.isInteger(ticksPerCharacter) || ticksPerCharacter < 1) throw new RangeError('ticksPerCharacter must be positive');
  const options = { words, config, seed };
  const engine = new GameEngine(options);
  const tracker = new PhraseTracker();
  let spawned = 0;
  let captured = 0;
  let missed = 0;
  let maxConcurrentWords = 0;
  engine.events.on('wordSpawned', () => { spawned++; });
  engine.events.on('wordCompleted', ({ word }) => { captured++; tracker.capture(word.text); });
  engine.events.on('wordMissed', () => { missed++; tracker.breakChain(); });
  for (let i = 0; i < maxTicks && engine.status === 'playing'; i++) {
    engine.step();
    maxConcurrentWords = Math.max(maxConcurrentWords, engine.state.words.length);
    if (engine.status !== 'playing' || engine.state.tick % ticksPerCharacter !== 0) continue;
    const target = [...engine.state.words].sort((a, b) => b.y - a.y || a.id - b.id)[0];
    if (!target) continue;
    // Pin the chosen target so overlapping word prefixes cannot redirect input.
    if (engine.state.pinnedId !== target.id && engine.state.input === '') engine.selectTarget(target.id);
    const char = target.match[engine.state.input.length];
    if (char) engine.typeChar(char);
    if (engine.state.input === target.match) engine.submit();
  }
  const replay = GameEngine.replay(options, engine.commands, engine.state.tick);
  const replayMatched = replay.state.score === engine.state.score
    && replay.state.completed === engine.state.completed
    && replay.state.missed === engine.state.missed
    && replay.state.words.map((w) => [w.id, w.match, w.y]).join('|')
      === engine.state.words.map((w) => [w.id, w.match, w.y]).join('|');
  return {
    seed, ticks: engine.state.tick, spawned, captured, missed,
    phrases: Object.values(tracker.counts).reduce((sum, n) => sum + n, 0),
    maxConcurrentWords, finalStatus: engine.status, replayMatched,
  };
}
