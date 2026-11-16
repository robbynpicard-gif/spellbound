import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { InstabilityManager } from '../gameplay/InstabilityManager';
import { accuracyOf, wordPoints, wpmOf, type GameStats } from '../gameplay/ScoringSystem';
import {
  addCharge,
  consumeCharge,
  isSpellId,
  sanitizeCharges,
  type SpellCharges,
  type SpellId,
} from '../gameplay/SpellManager';
import { findAutoTarget } from '../gameplay/TargetManager';
import { lengthClassOf, type WordState } from '../gameplay/Word';
import { WordGenerator } from '../gameplay/WordGenerator';
import type { SpellContext } from '../spells/BaseSpell';
import { SPELLS } from '../spells/SpellRegistry';
import { EventBus } from './EventBus';
import type { GameEvents, GameResult } from './GameEvents';
import { FIELD, SIMULATION_STEP_MS, type FieldConfig } from './GameConfig';
import { createInitialState, type GameState, type GameStatus } from './GameState';
import { SeededRandom } from './Random';

/**
 * A player action, stamped with the tick it happened on. The command log is
 * all that's needed (with the seed, config and starting spells) to replay a
 * game exactly — the basis for multiplayer validation.
 */
export type Command =
  | { tick: number; type: 'char'; char: string }
  | { tick: number; type: 'abandon' }
  | { tick: number; type: 'select'; wordId: number }
  | { tick: number; type: 'cast'; spell: SpellId };

export interface EngineOptions {
  config: DifficultyConfig;
  seed: number;
  words: readonly string[];
  field?: FieldConfig;
  /** Spell charges carried in (e.g. from the previous campaign level). */
  initialSpells?: Partial<SpellCharges>;
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
  private readonly s: GameState;
  private readonly spellContext: SpellContext;

  constructor(options: EngineOptions) {
    this.config = options.config;
    this.seed = options.seed;
    this.field = options.field ?? FIELD;
    this.rng = new SeededRandom(options.seed);
    this.generator = new WordGenerator(options.words, options.config, this.rng);
    this.s = createInitialState(sanitizeCharges(options.initialSpells));
    this.spellContext = this.createSpellContext();
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

    // Frostbinding: nothing moves and nothing spawns.
    if (s.freezeTicks > 0) {
      for (const word of s.words) word.prevY = word.y;
      if (--s.freezeTicks === 0) this.events.emit('spellEnded', { spell: 'ice' });
      return;
    }

    let factor = 1;
    if (s.slowTicks > 0) {
      factor = s.slowFactor;
      if (--s.slowTicks === 0) {
        s.slowFactor = 1;
        this.events.emit('spellEnded', { spell: 'slow' });
      }
    }

    const dt = (SIMULATION_STEP_MS / 1000) * factor;
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

  /** Cast a spell. Returns false (and emits spellFizzled) when no charge is held. */
  castSpell(spell: SpellId): boolean {
    if (this.s.status !== 'playing' || !isSpellId(spell)) return false;
    if (this.s.spells[spell] <= 0) {
      this.events.emit('spellFizzled', { spell });
      return false;
    }
    this.record({ tick: this.s.tick, type: 'cast', spell });
    return true;
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
      case 'cast':
        return this.applyCast(command.spell);
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

  private applyCast(spell: SpellId): void {
    const s = this.s;
    if (!consumeCharge(s.spells, spell)) return;
    s.spellsCast[spell]++;
    this.events.emit('spellCast', { spell, charges: { ...s.spells } });
    SPELLS[spell].cast(this.spellContext);
  }

  // ───────────────────────── rules ─────────────────────────

  private spawn(): void {
    const s = this.s;
    const text = this.generator.next(s.words);
    const halfWidth = (text.length * this.field.approxCharWidth) / 2;
    const minX = this.field.sideMargin + halfWidth;
    const maxX = this.field.width - this.field.sideMargin - halfWidth;
    const x = Math.round(minX < maxX ? this.rng.range(minX, maxX) : this.field.width / 2);

    const available = this.config.availableSpells;
    const spell =
      available.length > 0 && this.rng.chance(this.config.spellDropChance) ? this.rng.pick(available) : null;

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
      spell,
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
    this.emitProgress();
    if (word.spell) this.collect(word.spell);
    this.checkQuota();
  }

  private collect(spell: SpellId): void {
    const stored = addCharge(this.s.spells, spell);
    this.events.emit('spellCollected', { spell, stored, charges: { ...this.s.spells } });
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

  private emitProgress(): void {
    this.events.emit('progressChanged', { completed: this.s.completed, required: this.config.requiredWords });
  }

  private checkQuota(): void {
    const quota = this.config.requiredWords;
    if (this.s.status === 'playing' && quota !== null && this.s.completed >= quota) this.end('won');
  }

  private end(result: GameResult): void {
    this.s.status = result;
    this.events.emit('gameOver', { result, stats: this.stats() });
  }

  private findWord(id: number): WordState | undefined {
    return this.s.words.find((w) => w.id === id);
  }

  // ───────────────────────── spells ─────────────────────────

  private createSpellContext(): SpellContext {
    return {
      burnAllWords: () => this.burnAllWords(),
      freeze: (ticks) => {
        this.s.freezeTicks = Math.max(this.s.freezeTicks, ticks);
      },
      slow: (ticks, factor) => {
        this.s.slowTicks = Math.max(this.s.slowTicks, ticks);
        this.s.slowFactor = factor;
      },
      resetInstability: () => {
        const s = this.s;
        s.instability = this.instability.add(-this.instability.value);
        this.events.emit('instabilityChanged', { value: s.instability, stage: this.instability.stage });
      },
      resetWordSpeeds: () => {
        for (const word of this.s.words) word.speed = this.config.initialFallSpeed;
      },
      ticks: (ms) => Math.max(1, Math.round(ms / SIMULATION_STEP_MS)),
    };
  }

  /**
   * Incineration: every word on the field is destroyed. Each scores its base
   * points (no combo bonus, combo unchanged), counts toward the quota, and
   * any tome it carried is collected.
   */
  private burnAllWords(): void {
    const s = this.s;
    const burned = [...s.words];
    if (burned.length === 0) return;
    let points = 0;
    for (const word of burned) {
      this.removeWord(word);
      s.completed++;
      points += wordPoints(word.text.length, 1);
    }
    s.score += points;
    this.events.emit('wordsBurned', { words: burned, points });
    this.events.emit('scoreChanged', { score: s.score, combo: s.combo });
    this.emitProgress();
    for (const word of burned) if (word.spell) this.collect(word.spell);
    this.checkQuota();
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
