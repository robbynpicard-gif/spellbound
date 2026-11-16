import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { InstabilityManager } from '../gameplay/InstabilityManager';
import { accuracyOf, wordPoints, wpmOf, type GameStats } from '../gameplay/ScoringSystem';
import {
  addCharge,
  consumeCharge,
  isSpellId,
  sanitizeCharges,
  SPELL_IDS,
  type SpellCharges,
  type SpellId,
} from '../gameplay/SpellManager';
import { commonPrefixLength, guessIntendedWord, mostUrgent, wordsMatching } from '../gameplay/TargetManager';
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
  | { tick: number; type: 'backspace' }
  | { tick: number; type: 'clear' }
  | { tick: number; type: 'submit' }
  | { tick: number; type: 'select'; wordId: number };

export interface EngineOptions {
  config: DifficultyConfig;
  seed: number;
  words: readonly string[];
  field?: FieldConfig;
  /** Spell charges carried in (e.g. from the previous campaign level). */
  initialSpells?: Partial<SpellCharges>;
}

const LETTER = /^[a-z]$/i;
/** Longest text the typing console accepts. */
export const MAX_INPUT_LENGTH = 24;

/**
 * Runs one player's game. Pure TypeScript: no Phaser, no DOM, no clocks.
 * Time only moves when step() is called (one fixed tick each call).
 *
 * Typing model (decisions.md D-020): the player edits a typing console.
 * Whatever is typed is matched (case-insensitively) against the falling
 * words. Enter submits the console: an exact word is destroyed; a spell name
 * casts that spell; anything else counts as a missed submission against the
 * word the game guesses was meant.
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

  /** True when the console text still matches a word (or a spell name). */
  get inputValid(): boolean {
    return this.isValid(this.s.input);
  }

  /** True when pressing Enter now would destroy a word. */
  get inputIsCompleteWord(): boolean {
    return this.exactMatch(this.s.input) !== null;
  }

  /** How many leading console characters still match something (the rest is shown as wrong). */
  get validPrefixLength(): number {
    const input = this.s.input;
    for (let k = input.length; k > 0; k--) if (this.isValid(input.slice(0, k))) return k;
    return 0;
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

  /** A letter key (any case). Returns true if it was added to the console. */
  typeChar(rawChar: string): boolean {
    if (this.s.status !== 'playing' || !LETTER.test(rawChar)) return false;
    if (this.s.input.length >= MAX_INPUT_LENGTH) return false;
    this.record({ tick: this.s.tick, type: 'char', char: rawChar.toLowerCase() });
    return true;
  }

  /** Delete the last console character. No penalty. */
  backspace(): boolean {
    if (this.s.status !== 'playing' || this.s.input.length === 0) return false;
    this.record({ tick: this.s.tick, type: 'backspace' });
    return true;
  }

  /** Empty the console and release any clicked word. No penalty. */
  clearInput(): void {
    if (this.s.status !== 'playing' || (this.s.input === '' && this.s.pinnedId === null)) return;
    this.record({ tick: this.s.tick, type: 'clear' });
  }

  /** Enter: cast a spell by name, or submit an incomplete word. */
  submit(): void {
    if (this.s.status !== 'playing' || this.s.input === '') return;
    this.record({ tick: this.s.tick, type: 'submit' });
  }

  /** Mouse click on a word: aim the console only at that word. */
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
      case 'backspace':
        this.s.input = this.s.input.slice(0, -1);
        this.retarget();
        return this.emitInput();
      case 'clear':
        return this.resetInput(true);
      case 'submit':
        return this.applySubmit();
      case 'select':
        return this.applySelect(command.wordId);
    }
  }

  private applyChar(char: string): void {
    const s = this.s;
    const wasValid = this.isValid(s.input);
    s.input += char;
    this.retarget();

    if (this.isValid(s.input)) {
      s.correctChars++;
      const target = this.target;
      if (target) this.events.emit('wordProgress', { word: target });
      return this.emitInput();
    }

    // The console no longer matches anything. Only the keystroke that broke
    // the match is an error (one slip = one error, as in typing tests);
    // further letters typed after it are neither correct nor extra errors.
    const attempted = wasValid ? this.target : null;
    if (wasValid) {
      s.errors++;
      s.combo = 0;
      if (attempted) this.penalize(attempted);
    }
    this.events.emit('typingError', { wordId: attempted?.id ?? this.s.targetId, char });
    this.events.emit('scoreChanged', { score: s.score, combo: s.combo });
    this.emitInput();
  }

  private applySubmit(): void {
    const s = this.s;
    const input = s.input;
    const pinned = this.pinned;

    // 1. The console text is exactly a falling word: destroy it.
    const exact = this.exactMatch(input);
    if (exact) {
      this.complete(exact);
      if (s.input !== '') this.resetInput(true);
      return;
    }

    // 2. A spell name: cast it.
    if (isSpellId(input)) {
      this.resetInput(true);
      return this.castSpell(input);
    }

    // 3. Anything else is an incomplete or misspelled word:
    // guess what the player meant and treat it as a missed submission.
    // A word already penalised for a typo in this same entry isn't penalised again.
    const guess = pinned ?? guessIntendedWord(s.words, input);
    s.combo = 0;
    if (!guess) s.errors++;
    else if (guess.id !== s.penalizedId) {
      s.errors++;
      this.penalize(guess);
    }
    this.resetInput(true);
    this.events.emit('submitMissed', { input, wordId: guess?.id ?? null });
    this.events.emit('scoreChanged', { score: s.score, combo: s.combo });
  }

  private applySelect(wordId: number): void {
    const word = this.findWord(wordId);
    if (!word) return;
    this.s.pinnedId = word.id;
    this.s.input = '';
    this.retarget();
    this.emitInput();
  }

  private castSpell(spell: SpellId): void {
    const s = this.s;
    if (!consumeCharge(s.spells, spell)) {
      this.events.emit('spellFizzled', { spell });
      return;
    }
    s.spellsCast[spell]++;
    this.events.emit('spellCast', { spell, charges: { ...s.spells } });
    SPELLS[spell].cast(this.spellContext);
  }

  // ───────────────────────── console matching ─────────────────────────

  private get pinned(): WordState | null {
    return this.s.pinnedId === null ? null : (this.findWord(this.s.pinnedId) ?? null);
  }

  private candidates(input: string): WordState[] {
    const pinned = this.pinned;
    if (pinned) return pinned.match.startsWith(input) ? [pinned] : [];
    return wordsMatching(this.s.words, input);
  }

  /** The word Enter would destroy right now: an exact match (most urgent if several). */
  private exactMatch(input: string): WordState | null {
    if (input === '') return null;
    return mostUrgent(this.candidates(input).filter((w) => w.match === input));
  }

  private isValid(input: string): boolean {
    if (input === '') return true;
    return this.candidates(input).length > 0 || SPELL_IDS.some((id) => id.startsWith(input));
  }

  /**
   * Re-aim at the word the console text matches (the most urgent one if
   * several do). If nothing matches, keep the last attempted word, showing
   * how much of it was typed correctly.
   */
  private retarget(): void {
    const s = this.s;
    const input = s.input;
    const pinned = this.pinned;
    let target: WordState | null;
    if (input === '') target = pinned;
    else {
      const matches = this.candidates(input);
      // An exact match wins, so the highlighted word is the one Enter destroys
      // ("star" beats a lower "starlight" once "star" is fully typed).
      if (matches.length > 0) target = pinned ?? this.exactMatch(input) ?? mostUrgent(matches);
      // Typing a spell name: no word is being aimed at.
      else if (SPELL_IDS.some((id) => id.startsWith(input))) target = pinned;
      // Plain mistake: keep showing the word that was being attempted.
      else target = this.target;
    }
    this.setTarget(target?.id ?? null);
    if (target) target.typed = commonPrefixLength(target.match, input);
  }

  private setTarget(wordId: number | null): void {
    const s = this.s;
    const previous = this.target;
    if (s.targetId === wordId) return;
    if (previous) {
      previous.typed = 0;
      previous.isTarget = false;
    }
    const next = wordId === null ? undefined : this.findWord(wordId);
    if (next) next.isTarget = true;
    s.targetId = next ? next.id : null;
    this.events.emit('targetChanged', { previousId: previous?.id ?? null, currentId: s.targetId });
  }

  /** Error consequence for a word (GDD §7): it falls faster. */
  private penalize(word: WordState): void {
    word.errors++;
    word.speed += this.config.errorAcceleration;
    this.s.penalizedId = word.id;
  }

  private resetInput(unpin: boolean): void {
    const s = this.s;
    s.input = '';
    s.penalizedId = null;
    if (unpin) s.pinnedId = null;
    const target = this.target;
    if (target) target.typed = 0;
    this.setTarget(this.pinned?.id ?? null);
    this.emitInput();
  }

  private emitInput(): void {
    this.events.emit('inputChanged', { input: this.s.input, valid: this.inputValid, targetId: this.s.targetId });
  }

  // ───────────────────────── rules ─────────────────────────

  private spawn(): void {
    const s = this.s;
    const text = this.generator.next();
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
      match: text.toLowerCase(),
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
    // A new word may match what is already typed.
    if (s.input !== '' && s.pinnedId === null) {
      this.retarget();
      this.emitInput();
    }
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

  /**
   * Removes a word from the field. If it was the word being typed (or the
   * clicked word), the console is emptied, since its text now aims at nothing.
   */
  private removeWord(word: WordState): void {
    const s = this.s;
    s.words.splice(s.words.indexOf(word), 1);
    const wasAimed = s.targetId === word.id || s.pinnedId === word.id;
    if (s.targetId === word.id) {
      s.targetId = null;
      word.isTarget = false;
      this.events.emit('targetChanged', { previousId: word.id, currentId: null });
    }
    if (wasAimed) this.resetInput(true);
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
