import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { InstabilityManager } from '../gameplay/InstabilityManager';
import { accuracyOf, wordPoints, wpmOf, type GameStats } from '../gameplay/ScoringSystem';
import { findAutoTarget } from '../gameplay/TargetManager';
import { lengthClassOf, type WordState } from '../gameplay/Word';
import { WordGenerator } from '../gameplay/WordGenerator';
import { EventBus } from './EventBus';
import type { GameEvents, GameResult } from './GameEvents';
import { FIELD, SIMULATION_STEP_MS, type FieldConfig } from './GameConfig';
import { createInitialState, type GameState, type GameStatus } from './GameState';
import { SeededRandom } from './Random';

/**
 * A player action, stamped with the tick it happened on. The command log is
 * all that's needed (with the seed and config) to replay a game exactly —
 * the basis for multiplayer validation.
 */
export type Command =
  | { tick: number; type: 'char'; char: string }
  | { tick: number; type: 'abandon' }
  | { tick: number; type: 'select'; wordId: number };

export interface EngineOptions {
  config: DifficultyConfig;
  seed: number;
  words: readonly string[];
  field?: FieldConfig;
}

const LETTER = /^[a-z]$/;

/**
 * Runs one player's game. Pure TypeScript: no Phaser, no DOM, no clocks.
 * Time only moves when step() is called (one fixed tick each call).
 */
export class GameEngine {
  readonly events = new EventBus<GameEvents>();
  readonly config: DifficultyConfig;
  readonly seed: number;

  private readonly field: FieldConfig;
  private readonly rng: SeededRandom;
  private readonly generator: WordGenerator;
  private readonly instability = new InstabilityManager();
  private readonly log: Command[] = [];
  private readonly s: GameState = createInitialState();

  constructor(options: EngineOptions) {
    this.config = options.config;
    this.seed = options.seed;
    this.field = options.field ?? FIELD;
    this.rng = new SeededRandom(options.seed);
    this.generator = new WordGenerator(options.words, options.config, this.rng);
  }

  /** Re-run a recorded game up to `untilTick` and return the engine. */
  static replay(options: EngineOptions, commands: readonly Command[], untilTick: number): GameEngine {
    const engine = new GameEngine(options);
    let i = 0;
    for (;;) {
      while (i < commands.length && commands[i]!.tick === engine.state.tick) {
        engine.apply(commands[i]!);
        i++;
      }
      if (engine.state.tick >= untilTick || engine.status !== 'playing') break;
      engine.step();
    }
    return engine;
  }

  get state(): Readonly<GameState> {
    return this.s;
  }

  get status(): GameStatus {
    return this.s.status;
  }

  get commands(): readonly Command[] {
    return this.log;
  }

  get target(): WordState | null {
    return this.s.targetId === null ? null : (this.findWord(this.s.targetId) ?? null);
  }

  // ───────────────────────── time ─────────────────────────

  /** Advance the simulation by one fixed tick. */
  step(): void {
    const s = this.s;
    if (s.status !== 'playing') return;
    s.tick++;

    const dt = SIMULATION_STEP_MS / 1000;
    for (const word of s.words) {
      word.prevY = word.y;
      word.y += word.speed * dt;
    }

    for (const word of [...s.words]) {
      if (word.y >= this.field.height) {
        this.miss(word);
        if (s.status !== 'playing') return;
      }
    }

    s.spawnTimerMs = Math.max(0, s.spawnTimerMs - SIMULATION_STEP_MS);
    if (s.spawnTimerMs === 0 && s.words.length < this.config.maxActiveWords) {
      this.spawn();
      s.spawnTimerMs = this.config.spawnInterval;
    }
  }

  // ───────────────────────── player commands ─────────────────────────

  /** A letter key. Non-letters are ignored. Returns true if the key was accepted. */
  typeChar(rawChar: string): boolean {
    const char = rawChar.toLowerCase();
    if (!LETTER.test(char) || this.s.status !== 'playing') return false;
    this.record({ tick: this.s.tick, type: 'char', char });
    return true;
  }

  /** Give up on the current target (Backspace). Its progress is reset; no other penalty. */
  abandon(): void {
    if (this.s.status !== 'playing' || this.s.targetId === null) return;
    this.record({ tick: this.s.tick, type: 'abandon' });
  }

  /** Explicitly target a word (mouse click). */
  selectTarget(wordId: number): void {
    if (this.s.status !== 'playing' || !this.findWord(wordId)) return;
    this.record({ tick: this.s.tick, type: 'select', wordId });
  }

  private record(command: Command): void {
    this.log.push(command);
    this.apply(command);
  }

  private apply(command: Command): void {
    switch (command.type) {
      case 'char':
        return this.applyChar(command.char);
      case 'abandon':
        return this.setTarget(null);
      case 'select':
        return this.setTarget(command.wordId);
    }
  }

  private applyChar(char: string): void {
    let target = this.target;
    if (!target) {
      const candidate = findAutoTarget(this.s.words, char);
      if (!candidate) return this.error(null, char);
      this.setTarget(candidate.id);
      target = candidate;
    }

    if (target.text[target.typed] !== char) return this.error(target, char);

    target.typed++;
    this.s.correctChars++;
    if (target.typed >= target.text.length) this.complete(target);
    else this.events.emit('wordProgress', { word: target });
  }

  // ───────────────────────── rules ─────────────────────────

  private spawn(): void {
    const s = this.s;
    const text = this.generator.next(s.words);
    const halfWidth = (text.length * this.field.approxCharWidth) / 2;
    const minX = this.field.sideMargin + halfWidth;
    const maxX = this.field.width - this.field.sideMargin - halfWidth;
    const x = Math.round(minX < maxX ? this.rng.range(minX, maxX) : this.field.width / 2);

    const word: WordState = {
      id: s.nextWordId++,
      text,
      x,
      y: 0,
      prevY: 0,
      speed: this.config.initialFallSpeed,
      typed: 0,
      isTarget: false,
      lengthClass: lengthClassOf(text.length),
      modifier: null,
      spawnTick: s.tick,
      errors: 0,
    };
    s.words.push(word);
    this.events.emit('wordSpawned', { word });
  }

  private setTarget(wordId: number | null): void {
    const s = this.s;
    if (s.targetId === wordId) return;
    const previous = this.target;
    if (previous) {
      previous.typed = 0;
      previous.isTarget = false;
    }
    const next = wordId === null ? undefined : this.findWord(wordId);
    if (next) next.isTarget = true;
    s.targetId = next ? next.id : null;
    this.events.emit('targetChanged', { previousId: previous?.id ?? null, currentId: s.targetId });
  }

  private error(word: WordState | null, char: string): void {
    const s = this.s;
    s.errors++;
    s.combo = 0;
    if (word) {
      word.errors++;
      word.speed += this.config.errorAcceleration;
    }
    this.events.emit('typingError', { wordId: word?.id ?? null, char });
    this.events.emit('scoreChanged', { score: s.score, combo: s.combo });
  }

  private complete(word: WordState): void {
    const s = this.s;
    this.removeWord(word);
    s.completed++;
    s.combo++;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.completionTicksTotal += s.tick - word.spawnTick;
    const points = wordPoints(word.text.length, s.combo);
    s.score += points;

    this.events.emit('wordCompleted', { word, points, combo: s.combo });
    this.events.emit('scoreChanged', { score: s.score, combo: s.combo });

    const quota = this.config.requiredWords;
    if (quota !== null && s.completed >= quota) this.end('won');
  }

  private miss(word: WordState): void {
    const s = this.s;
    this.removeWord(word);
    s.missed++;
    s.combo = 0;
    s.instability = this.instability.add(this.config.instabilityPerMiss);

    this.events.emit('wordMissed', { word, instability: s.instability });
    this.events.emit('instabilityChanged', { value: s.instability, stage: this.instability.stage });
    this.events.emit('scoreChanged', { score: s.score, combo: s.combo });

    if (this.instability.collapsed) this.end('lost');
  }

  private removeWord(word: WordState): void {
    const s = this.s;
    s.words.splice(s.words.indexOf(word), 1);
    if (s.targetId === word.id) {
      s.targetId = null;
      word.isTarget = false;
      this.events.emit('targetChanged', { previousId: word.id, currentId: null });
    }
  }

  private end(result: GameResult): void {
    this.s.status = result;
    this.events.emit('gameOver', { result, stats: this.stats() });
  }

  private findWord(id: number): WordState | undefined {
    return this.s.words.find((w) => w.id === id);
  }

  // ───────────────────────── stats ─────────────────────────

  stats(): GameStats {
    const s = this.s;
    const elapsedMs = s.tick * SIMULATION_STEP_MS;
    return {
      score: s.score,
      completed: s.completed,
      missed: s.missed,
      correctChars: s.correctChars,
      errors: s.errors,
      accuracy: accuracyOf(s.correctChars, s.errors),
      wpm: wpmOf(s.correctChars, elapsedMs),
      maxCombo: s.maxCombo,
      elapsedMs,
      averageCompletionMs:
        s.completed === 0 ? 0 : (s.completionTicksTotal / s.completed) * SIMULATION_STEP_MS,
    };
  }
}
