import { isSurvival, type DifficultyConfig } from '../difficulty/DifficultyConfig';
import { InstabilityManager } from '../gameplay/InstabilityManager';
import {
  accuracyOf,
  BONUS_RATES as B,
  CLUTCH_ZONE,
  comboAfterWrongEntry,
  streakAfterTypo,
  streakMultiplierOf,
  streakTierOf,
  METRONOME_CV,
  METRONOME_KEYS,
  multiplierOf,
  QUICK_ZONE,
  scoreWord,
  tierOf,
  VOLLEY_TICKS,
  wordPoints,
  wpmOf,
  type Bonus,
  type BonusId,
  type GameStats,
} from '../gameplay/ScoringSystem';
import { wordComplexity } from '../gameplay/WordGenerator';
import {
  addCharge,
  poolSizeFor,
  trimToPool,
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
import { dropWeights, SPELLS } from '../spells/SpellRegistry';
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
  | { tick: number; type: 'summon' }
  | { tick: number; type: 'emergency' }
  | { tick: number; type: 'select'; wordId: number }
  /** Normal only: cast a spell directly (number keys). */
  | { tick: number; type: 'cast'; spell: SpellId };

export interface EngineOptions {
  config: DifficultyConfig;
  seed: number;
  words: readonly string[];
  field?: FieldConfig;
  /** Spell charges carried in (e.g. from the previous campaign level). */
  initialSpells?: Partial<SpellCharges>;
  /** Hardcore campaign: instability carries over and Arcane Purge only halves it. */
  hardcore?: boolean;
  /** Instability to start with (Hardcore carries it from level to level). */
  initialInstability?: number;
  /** Words still on the field when the previous level ended (D-055): they carry on. */
  initialWords?: readonly WordState[];
  /** Combo carried in from the previous level of a Campaign run (D-040). */
  initialCombo?: number;
  /** Clean Streak carried in from the previous level of the same chapter (D-046). */
  initialCleanStreak?: number;
}

/** The pace a level is running at right now (boss levels speed up over time). */
export interface Pace {
  fallSpeed: number;
  spawnInterval: number;
  maxActiveWords: number;
}

/** Each word's speed varies by up to this fraction around the level's pace. */
export const SPEED_VARIANCE = 0.15;
/** Prototype controls; adjust after playtesting. */
export const SUMMON_COOLDOWN_TICKS = 8 * 60;
export const EMERGENCY_COOLDOWN_TICKS = 105 * 60;
export const SUMMON_MAX_FIELD = 3;
export const SUMMON_BATCH = 3;
export const SUMMON_CAPTURE_BONUS = 0.10;
/** Quota levels: average speed runs from ×(1−this) at the start to ×(1+this) at the quota. */
export const LEVEL_SPEED_RAMP = 0.15;
/** During a surge words arrive this much more often, and a few more may be on the field. */
export const SURGE_SPAWN_FACTOR = 0.6;
export const SURGE_EXTRA_WORDS = 3;
/** Claiming a scroll with a full spell pool: these points × the combo multiplier instead. */
export const OVERFLOW_POINTS = 50;
/** Fire spares freshly spawned words: it only burns below this share of the field (D-057). */
export const FIRE_MIN_DEPTH = 0.2;
/** Each Ice cast while the field is still frozen adds this share of the previous cast's time. */
export const ICE_STACK_DECAY = 0.7;

/** Transmutation turns long words into words of these lengths. */
const SHORT_WORD_MIN = 2;
const SHORT_WORD_MAX = 3;
// Alter turns the field into 2–3 letter words (D-057).
const EASY_WORD_MIN = 2;
const EASY_WORD_MAX = 3;
/** No rare letters, long consonant runs or names in Alter's window. */
const EASY_MAX_COMPLEXITY = 0.5;

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
  private readonly instability: InstabilityManager;
  private readonly hardcore: boolean;
  /** Separate random stream for word speeds, so the word sequence is unaffected. */
  private readonly speedRng: SeededRandom;
  /** 3–4 letter words Transmutation can turn long words into. */
  private readonly shortWords: readonly string[];
  private awardedLevelBonuses: Bonus[] = [];
  /** Words for Alter's easy window: short and simple, never longer than the level allows. */
  private readonly easyGenerator: WordGenerator | null;
  private readonly log: Command[] = [];
  private readonly s: GameState;
  private readonly spellContext: SpellContext;

  constructor(options: EngineOptions) {
    this.config = options.config;
    this.seed = options.seed;
    this.field = options.field ?? FIELD;
    this.rng = new SeededRandom(options.seed);
    this.generator = new WordGenerator(options.words, options.config, this.rng);
    this.hardcore = options.hardcore === true;
    this.speedRng = new SeededRandom((this.seed ^ 0x5eed5eed) >>> 0);
    this.instability = new InstabilityManager(options.initialInstability ?? 0);
    const carried = Math.max(0, Math.floor(options.initialCombo ?? 0));
    this.shortWords = options.words.filter((w) => w.length >= SHORT_WORD_MIN && w.length <= SHORT_WORD_MAX);
    let easy: WordGenerator | null = null;
    try {
      easy = new WordGenerator(
        options.words,
        {
          minWordLength: Math.min(EASY_WORD_MIN, options.config.minWordLength),
          maxWordLength: Math.min(EASY_WORD_MAX, options.config.maxWordLength),
          maxComplexity: EASY_MAX_COMPLEXITY,
          maxActiveWords: options.config.maxActiveWords,
        },
        this.rng,
      );
    } catch {
      easy = null; // a word list with no short words: Alter only shortens
    }
    this.easyGenerator = easy;
    this.s = createInitialState(sanitizeCharges(options.initialSpells), this.instability.value);
    this.carried = (options.initialWords ?? []).map((w) => ({ ...w, isTarget: false, typed: 0 }));
    this.s.combo = carried;
    this.s.maxCombo = carried;
    this.s.peakMultiplier = multiplierOf(carried);
    this.s.cleanStreak = Math.max(0, Math.floor(options.initialCleanStreak ?? 0));
    this.s.peakCleanStreak = this.s.cleanStreak;
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

  /** Simulated time since the level started. */
  get elapsedMs(): number {
    return this.s.tick * SIMULATION_STEP_MS;
  }

  /** Boss levels: time left to survive (null on quota levels). */
  get survivalRemainingMs(): number | null {
    return isSurvival(this.config) ? Math.max(0, this.config.survivalMs! - this.s.survivalElapsedMs) : null;
  }

  /**
   * Current pace. Normal levels use their fixed values; a boss level moves
   * smoothly from its base values to its `ramp` values over the timer.
   */
  get pace(): Pace {
    const c = this.config;
    let pace = { fallSpeed: c.initialFallSpeed, spawnInterval: c.spawnInterval, maxActiveWords: c.maxActiveWords };
    if (isSurvival(c) && c.ramp) {
      const t = Math.min(1, this.s.survivalElapsedMs / c.survivalMs!);
      const lerp = (a: number, b: number) => a + (b - a) * t;
      pace = {
        fallSpeed: lerp(pace.fallSpeed, c.ramp.initialFallSpeed),
        spawnInterval: lerp(pace.spawnInterval, c.ramp.spawnInterval),
        maxActiveWords: Math.round(lerp(pace.maxActiveWords, c.ramp.maxActiveWords)),
      };
    }
    // Endless: the pace keeps climbing with every word captured (D-057).
    if (c.escalation) {
      const steps = Math.floor(this.s.completed / c.escalation.perWords);
      pace = {
        fallSpeed: pace.fallSpeed * (1 + c.escalation.speed * steps),
        spawnInterval: pace.spawnInterval / (1 + c.escalation.spawn * steps),
        maxActiveWords: Math.min(16, pace.maxActiveWords + Math.floor(steps / 4)),
      };
    }
    // Within a quota level, words come slower at the start and faster near the end (D-051).
    if (!isSurvival(c) && c.spawnRamp) pace = { ...pace, spawnInterval: pace.spawnInterval * (1 + c.spawnRamp - 2 * c.spawnRamp * this.progress) };
    if (this.s.surgeTicks > 0)
      pace = { ...pace, spawnInterval: pace.spawnInterval * SURGE_SPAWN_FACTOR, maxActiveWords: pace.maxActiveWords + SURGE_EXTRA_WORDS };
    return pace;
  }

  /** How far through the level we are (0–1): share of the quota, or of the boss timer. */
  private carried: WordState[] = [];

  /** How many charges fit right now: the base pool, widened by a clean run (D-057). */
  get poolLimit(): number {
    return poolSizeFor(this.s.manaStreak);
  }

  private get progress(): number {
    const c = this.config;
    if (c.requiredWords) return Math.min(1, this.s.completed / c.requiredWords);
    if (c.survivalMs) return Math.min(1, this.s.survivalElapsedMs / c.survivalMs);
    // Endless Practice: each quota's worth of words is one lap, with the level's surges again.
    if (c.rampWords) return (this.s.completed % c.rampWords) / c.rampWords;
    return 0;
  }

  /** Opening words, and starting/ending surges. Runs once per tick before movement. */
  private tickPacing(): void {
    const s = this.s;
    const c = this.config;
    if (s.tick === 1 && this.carried.length > 0) {
      // The field carries over from the last level instead of an opening cluster.
      for (const w of this.carried) {
        const word = { ...w, id: s.nextWordId++ };
        s.words.push(word);
        this.events.emit('wordSpawned', { word });
      }
      this.carried = [];
    } else if (s.tick === 1 && c.openingWords) {
      const n = c.openingWords;
      for (let k = 0; k < n; k++) this.spawn(this.pace.fallSpeed, this.field.height * (0.04 + (0.3 * (n - 1 - k)) / Math.max(1, n - 1)));
      s.spawnTimerMs = this.pace.spawnInterval;
    }
    if (s.surgeTicks > 0 && --s.surgeTicks === 0) this.events.emit('surgeChanged', { active: false });
    if (!c.requiredWords && !c.survivalMs && c.rampWords) {
      const lap = Math.floor(s.completed / c.rampWords);
      if (lap !== s.surgeLap) {
        s.surgeLap = lap;
        s.surgesStarted = 0;
      }
    }
    const next = c.surges?.[s.surgesStarted];
    if (next && s.surgeTicks === 0 && this.progress >= next.at) {
      s.surgesStarted++;
      s.surgeTicks = Math.max(1, Math.round(next.ms / SIMULATION_STEP_MS));
      s.spawnTimerMs = Math.min(s.spawnTimerMs, 200);
      this.events.emit('surgeChanged', { active: true });
    }
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
    // The spell duration runs on real simulation ticks, but the boss's
    // survival clock pauses under Ice and advances at 80% under Slow.
    if (isSurvival(this.config)) {
      s.survivalElapsedMs += s.freezeTicks > 0 ? 0 : s.slowStacks.length > 0 ? SIMULATION_STEP_MS * 0.8 : SIMULATION_STEP_MS;
    }

    // Boss level: surviving the whole timer clears it.
    const remaining = this.survivalRemainingMs;
    if (remaining !== null && remaining <= 0) {
      // The boss timer is over: stop sending words and let the player finish the
      // field. The win is already secured, so the ward cannot break now (D-057).
      if (!s.windingDown) {
        s.windingDown = true;
        this.events.emit('windDown', {});
      }
      if (s.words.length === 0) return this.end('won');
    }

    this.tickPacing();

    // Frostbinding ends as soon as the battlefield is empty, so an Ice cast
    // cannot strand the player waiting for a frozen spawn timer.
    if (s.freezeTicks > 0 && s.words.length === 0) this.endIceOnEmptyField();

    // Frostbinding: nothing moves and nothing spawns (slow stacks wait too).
    if (s.freezeTicks > 0) {
      for (const word of s.words) word.prevY = word.y;
      if (--s.freezeTicks === 0) this.events.emit('spellEnded', { spell: 'ice' });
      return;
    }

    // Temporal Distortion: each stack multiplies the slow-down and has its own timer.
    let factor = 1;
    if (s.easyTicks > 0 && --s.easyTicks === 0) {
      this.events.emit('easyChanged', { ticks: 0 });
      this.events.emit('spellEnded', { spell: 'alter' });
    }
    if (s.slowStacks.length > 0) {
      factor = Math.pow(s.slowFactor, s.slowStacks.length);
      const before = s.slowStacks.length;
      s.slowStacks = s.slowStacks.map((t) => t - 1).filter((t) => t > 0);
      if (s.slowStacks.length !== before) {
        this.events.emit('slowChanged', { stacks: s.slowStacks.length, factor: this.slowMultiplier });
        if (s.slowStacks.length === 0) this.events.emit('spellEnded', { spell: 'slow' });
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
    const pace = this.pace;
    if (s.spawnTimerMs === 0 && !s.windingDown && s.words.length < pace.maxActiveWords &&
        (this.config.requiredWords === null || s.completed + s.words.length < this.config.requiredWords)) {
      this.spawn(pace.fallSpeed);
      s.spawnTimerMs = pace.spawnInterval;
    }
  }

  /** Current fall-speed multiplier from Temporal Distortion (1 = normal). */
  get slowMultiplier(): number {
    return Math.pow(this.s.slowFactor, this.s.slowStacks.length);
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

  /**
   * Quick cast (Normal only, number keys): cast a spell without typing its
   * name. The console text is left as it is.
   */
  quickCast(spell: SpellId): boolean {
    if (this.s.status !== 'playing' || this.hardcore) return false;
    this.record({ tick: this.s.tick, type: 'cast', spell });
    return true;
  }

  /** Manually pull quota words forward when the field is quiet. */
  summon(): boolean {
    if (this.s.status !== 'playing' || this.config.requiredWords === null || this.s.tick < this.s.summonReadyTick || this.s.words.length > SUMMON_MAX_FIELD) return false;
    this.record({ tick: this.s.tick, type: 'summon' });
    return true;
  }

  /** Long-cooldown gamble: type the random colored scroll to claim its charge. */
  emergencySummon(): boolean {
    if (this.s.status !== 'playing' || this.config.availableSpells.length === 0 || this.s.tick < this.s.emergencyReadyTick ||
        (this.config.requiredWords !== null && this.s.completed + this.s.words.length >= this.config.requiredWords)) return false;
    this.record({ tick: this.s.tick, type: 'emergency' });
    return true;
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
      case 'summon':
        return this.applySummon();
      case 'emergency':
        return this.applyEmergencySummon();
      case 'select':
        return this.applySelect(command.wordId);
      case 'cast':
        return this.castSpell(command.spell);
    }
  }

  private applySummon(): void {
    const s = this.s;
    const quota = this.config.requiredWords;
    if (quota === null || s.tick < s.summonReadyTick || s.words.length > SUMMON_MAX_FIELD) return;
    const available = Math.max(0, quota - s.completed - s.words.length);
    const n = Math.min(SUMMON_BATCH, available, Math.max(0, this.pace.maxActiveWords - s.words.length));
    if (n === 0) return;
    for (let i = 0; i < n; i++) {
      this.spawn(this.pace.fallSpeed);
      s.summonedIds.push(s.words[s.words.length - 1]!.id);
    }
    s.summonReadyTick = s.tick + SUMMON_COOLDOWN_TICKS;
    s.spawnTimerMs = Math.max(s.spawnTimerMs, this.pace.spawnInterval);
  }

  private applyEmergencySummon(): void {
    const s = this.s;
    if (s.tick < s.emergencyReadyTick || this.config.availableSpells.length === 0 ||
        (this.config.requiredWords !== null && s.completed + s.words.length >= this.config.requiredWords)) return;
    this.spawn(this.pace.fallSpeed);
    const word = s.words[s.words.length - 1]!;
    word.spell = this.rng.weighted(dropWeights(this.config.availableSpells) as Record<SpellId, number>);
    s.emergencyReadyTick = s.tick + EMERGENCY_COOLDOWN_TICKS;
  }

  private resetVolley(): void {
    this.s.volleyCount = 0;
    this.s.volleyLastTick = -100000;
    this.s.recentCaptures = [];
  }

  private applyChar(char: string): void {
    const s = this.s;
    const wasValid = this.isValid(s.input);
    s.input += char;
    s.keyTicks.push(s.tick);
    if (s.keyTicks.length > METRONOME_KEYS + 1) s.keyTicks.shift();
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
    // A typo costs the word its Perfect bonus (and speeds it up), not the combo:
    // fixing it with Backspace keeps the chain alive (D-040).
    if (wasValid) {
      s.errors++;
      // Clean Streak: a typo (even one fixed with Backspace) steps back one milestone (D-046).
      s.entryTypo = true;
      this.setCleanStreak(streakAfterTypo(s.cleanStreak), 'typo');
      this.setCombo(comboAfterWrongEntry(s.combo));
      // Correctable typos cost Combo but do not accelerate the falling word.
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
    // A wrong entry drops the multiplier one tier (D-040) and ends the Clean Streak (D-046).
    this.setCombo(0);
    this.resetVolley();
    this.setCleanStreak(0, 'wrongEntry');
    this.shrinkPool();
    if (!guess) s.errors++;
    else {
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
    // Reject Ice before consuming a charge, regardless of typed/quickcast path.
    if (spell === 'ice' && s.words.length === 0) {
      this.events.emit('spellFizzled', { spell });
      return;
    }
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
    // Deterministic weighted random acceleration; rare recoverable plunge.
    const roll = this.speedRng.next();
    const factor = roll < 0.88 ? 0.4 : roll < 0.985 ? 1.2 : 2.5;
    word.speed += this.config.errorAcceleration * factor;
    this.s.penalizedId = word.id;
  }

  private resetInput(unpin: boolean): void {
    const s = this.s;
    s.input = '';
    s.penalizedId = null;
    s.entryTypo = false;
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

  /**
   * Fall speed for a new word: the level's pace, varied per word (±SPEED_VARIANCE)
   * and, on quota levels, rising with progress (from ×(1−LEVEL_SPEED_RAMP) to
   * ×(1+LEVEL_SPEED_RAMP) at the quota) so each level starts slow on average.
   */
  private spawnSpeed(fallSpeed: number): number {
    const variance = this.config.speedVariance ?? SPEED_VARIANCE;
    const rampSize = this.config.speedRamp ?? LEVEL_SPEED_RAMP;
    const vary = 1 + (this.speedRng.next() * 2 - 1) * variance;
    const quota = this.config.requiredWords ?? this.config.rampWords ?? null;
    const progress = quota ? Math.min(1, this.s.completed / quota) : 0.5;
    const ramp = 1 - rampSize + (2 * rampSize + (this.config.speedRampExtra ?? 0)) * progress;
    return fallSpeed * vary * ramp;
  }

  private spawn(fallSpeed: number, startY = 0): void {
    const s = this.s;
    const text = s.easyTicks > 0 && this.easyGenerator ? this.easyGenerator.next() : this.generator.next();
    const halfWidth = (text.length * this.field.approxCharWidth) / 2;
    const minX = this.field.sideMargin + halfWidth;
    const maxX = this.field.width - this.field.sideMargin - halfWidth;
    let x = Math.round(minX < maxX ? this.rng.range(minX, maxX) : this.field.width / 2);

    const available = this.config.availableSpells;
    // Scrolls: whether one drops, then which spell (rarer spells have lower weights).
    const spell =
      available.length > 0 && this.rng.chance(this.config.spellDropChance)
        ? this.rng.weighted(dropWeights(available, this.config.introducesSpell) as Record<SpellId, number>)
        : null;
    const speed = this.spawnSpeed(fallSpeed);

    const word: WordState = {
      id: s.nextWordId++,
      text,
      match: text.toLowerCase(),
      x,
      y: startY,
      prevY: startY,
      speed,
      baseSpeed: 0,
      typed: 0,
      isTarget: false,
      lengthClass: lengthClassOf(text.length),
      modifier: null,
      spell,
      spawnTick: s.tick,
      errors: 0,
    };
    word.baseSpeed = word.speed;
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
    this.setCombo(s.combo + 1);
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.completionTicksTotal += s.tick - word.spawnTick;
    const multiplier = multiplierOf(s.combo);
    // Clean Streak: a word typed with no typo adds one. The capture that reaches
    // a milestone already scores at its multiplier (D-046).
    if (word.errors === 0 && !s.entryTypo) {
      this.setCleanStreak(s.cleanStreak + 1, 'capture');
      this.growPool();
    }
    const streak = streakMultiplierOf(s.cleanStreak);
    const bonuses = this.wordBonuses(word);
    const summoned = s.summonedIds.includes(word.id);
    s.summonedIds = s.summonedIds.filter((id) => id !== word.id);
    const points = Math.round(scoreWord(word.text.length, multiplier, bonuses, streak) * (summoned ? 1 + SUMMON_CAPTURE_BONUS : 1));
    s.score += points;
    for (const b of bonuses) s.bonusCounts[b.id] = (s.bonusCounts[b.id] ?? 0) + 1;

    this.events.emit('wordCompleted', { word, points, combo: s.combo, multiplier, bonuses, streakMultiplier: streak });
    this.events.emit('scoreChanged', { score: s.score, combo: s.combo });
    this.emitProgress();
    if (word.spell) this.collect(word);
    this.checkQuota();
  }

  /** Claims a word's scroll. With a full pool it fizzles for consolation points. */
  private collect(word: WordState): void {
    const s = this.s;
    const spell = word.spell!;
    const stored = addCharge(s.spells, spell, this.poolLimit);
    const overflowPoints = stored ? 0 : OVERFLOW_POINTS * multiplierOf(s.combo);
    if (overflowPoints > 0) {
      s.score += overflowPoints;
      s.overflows++;
    }
    this.events.emit('spellCollected', { spell, stored, charges: { ...s.spells }, overflowPoints, x: word.x, y: word.y });
    if (overflowPoints > 0) this.events.emit('scoreChanged', { score: s.score, combo: s.combo });
  }

  private miss(word: WordState): void {
    const s = this.s;
    this.removeWord(word);

    // Arcane Shield: the word does no harm.
    if (s.barrier > 0) {
      s.barrier--;
      s.blocked++;
      this.events.emit('wordBlocked', { word, barrierLeft: s.barrier });
      this.events.emit('barrierChanged', { remaining: s.barrier });
      return;
    }

    s.missed++;
    this.setCombo(0);
    this.setCleanStreak(0, 'miss');
    this.shrinkPool();
    const damage = this.config.instabilityPerMiss;
    s.instability = this.instability.add(damage);
    s.peakInstability = Math.max(s.peakInstability, s.instability);

    this.events.emit('wordMissed', { word, instability: s.instability });
    this.events.emit('instabilityChanged', { value: s.instability, stage: this.instability.stage });
    this.events.emit('scoreChanged', { score: s.score, combo: s.combo });

    // The boss timer is already survived: a late miss stings but cannot end the run.
    if (this.instability.collapsed && !s.windingDown) this.end('lost');
  }

  /**
   * Removes a word from the field. If it was the word being typed (or the
   * clicked word), the console is emptied, since its text now aims at nothing.
   */
  /** Release the spawn lock when the last frozen scroll is removed. */
  private endIceOnEmptyField(): void {
    const s = this.s;
    if (s.freezeTicks <= 0 || s.words.length !== 0) return;
    s.freezeTicks = 0;
    s.iceCasts = 0;
    this.events.emit('freezeChanged', { ticks: 0 });
    this.events.emit('spellEnded', { spell: 'ice' });
  }

  private removeWord(word: WordState): void {
    const s = this.s;
    s.words.splice(s.words.indexOf(word), 1);
    this.endIceOnEmptyField();
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

  /** Sets the Clean Streak (D-046) and reports the change. */
  /** A clean capture: the pool may widen a step. */
  private growPool(): void {
    const before = this.poolLimit;
    this.s.manaStreak++;
    if (this.poolLimit !== before) this.events.emit('manaPoolChanged', { size: this.poolLimit, lost: 0, charges: { ...this.s.spells } });
  }

  /**
   * A missed word or a wrong Enter: the pool snaps back to its base size and
   * any charges that no longer fit are lost (D-057). A corrected typo is free.
   */
  private shrinkPool(): void {
    const s = this.s;
    if (s.manaStreak === 0) return;
    s.manaStreak = 0;
    const lost = trimToPool(s.spells, this.poolLimit);
    this.events.emit('manaPoolChanged', { size: this.poolLimit, lost, charges: { ...s.spells } });
  }

  private setCleanStreak(count: number, reason: 'capture' | 'typo' | 'wrongEntry' | 'miss'): void {
    const s = this.s;
    const previous = s.cleanStreak;
    if (count === previous && reason !== 'capture') return;
    s.cleanStreak = count;
    s.peakCleanStreak = Math.max(s.peakCleanStreak, count);
    this.events.emit('cleanStreakChanged', {
      count,
      previous,
      tier: streakTierOf(count),
      multiplier: streakMultiplierOf(count),
      previousMultiplier: streakMultiplierOf(previous),
      reason,
    });
  }

  /** Sets the combo, reporting a change of multiplier tier. */
  private setCombo(combo: number): void {
    const s = this.s;
    const before = tierOf(s.combo);
    s.combo = combo;
    const after = tierOf(combo);
    if (after !== before) {
      const multiplier = multiplierOf(combo);
      s.peakMultiplier = Math.max(s.peakMultiplier, multiplier);
      this.events.emit('tierChanged', { tier: after, multiplier, up: after > before });
    }
  }

  /** Bonuses a captured word earns (D-040). The word has already left the field. */
  private wordBonuses(word: WordState): Bonus[] {
    const s = this.s;
    const out: Bonus[] = [];
    const add = (id: BonusId, rate: number, count = 1, points = 0): void => {
      out.push({ id, rate, count, points });
    };
    const depth = word.y / this.field.height;
    if (word.errors === 0) add('perfect', B.perfect);
    if (depth <= QUICK_ZONE) add('quick', B.quick);
    if (depth >= CLUTCH_ZONE) add('clutch', B.clutch);
    const arcane = wordComplexity(word.match);
    if (arcane > 0) add('arcane', Math.min(B.arcaneMax, arcane * B.arcanePerPoint));
    if (word.text.length >= B.longFrom) add('long', B.long);
    if (word.text[0] !== word.match[0]) add('name', B.name);

    // Volley: several captures in quick succession.
    const previous = s.volleyCount;
    const additional = Math.max(0, previous - 4);
    const maintenance = Math.round(90 * Math.pow(0.95, Math.floor(additional / 4)));
    const allowed = previous >= 4 ? Math.max(1, maintenance) : VOLLEY_TICKS;
    s.volleyCount = s.tick - s.volleyLastTick <= allowed ? previous + 1 : 1;
    s.volleyLastTick = s.tick;
    const volley = s.volleyCount;
    if (volley >= 4) add('volley', 0.10 + (volley - 4) * 0.05, volley);

    // Alliteration: same first letter as the previous capture.
    const first = word.match[0]!;
    s.alliterationChain = first === s.alliterationLetter ? s.alliterationChain + 1 : 1;
    s.alliterationLetter = first;
    if (s.alliterationChain >= 2)
      add('alliteration', Math.min(B.alliterationMax, (s.alliterationChain - 1) * B.alliterationPer), s.alliterationChain);

    // Librarian: captures in alphabetical order.
    s.librarianChain = s.lastCaptured !== '' && word.match > s.lastCaptured ? s.librarianChain + 1 : 1;
    s.lastCaptured = word.match;
    if (s.librarianChain >= 3)
      add('librarian', Math.min(B.librarianMax, (s.librarianChain - 2) * B.librarianPer), s.librarianChain);

    // Metronome: an even typing rhythm over the last keystrokes.
    if (s.keyTicks.length > METRONOME_KEYS) {
      const gaps = s.keyTicks.slice(1).map((t, i) => t - s.keyTicks[i]!);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
      if (mean > 0 && sd / mean < METRONOME_CV) add('metronome', B.metronome);
    }

    // Clean Sweep: the screen is empty after 3+ captures.
    s.sweepCount++;
    if (s.words.length === 0) {
      if (s.sweepCount >= 3) add('sweep', 0, s.sweepCount, B.sweepPoints);
      s.sweepCount = 0;
    }
    return out;
  }

  /** End-of-level bonuses for a won level, added to the score (D-040). */
  private levelBonuses(): Bonus[] {
    const s = this.s;
    const out: Bonus[] = [];
    const levelScore = s.score;
    if (levelScore <= 0) return out;
    const award = (id: BonusId, fraction: number): void => {
      out.push({ id, rate: 0, count: 1, points: Math.round(levelScore * fraction) });
    };
    if (s.missed === 0) award('flawless', B.flawless);
    const quota = this.config.requiredWords;
    if (quota !== null && this.config.survivalMs == null) {
      const parTicks = (quota * this.config.spawnInterval + 4000) / SIMULATION_STEP_MS;
      if (s.tick <= parTicks) award('underPar', B.underPar);
    }
    if (s.peakInstability >= 75) award('comeback', B.comeback);
    return out;
  }

  private end(result: GameResult): void {
    if (result === 'won') {
      const bonuses = this.levelBonuses();
      if (bonuses.length > 0) {
        this.awardedLevelBonuses = bonuses;
        const total = bonuses.reduce((sum, b) => sum + b.points, 0);
        this.s.score += total;
        for (const b of bonuses) this.s.bonusCounts[b.id] = (this.s.bonusCounts[b.id] ?? 0) + 1;
        this.events.emit('levelBonuses', { bonuses, total });
        this.events.emit('scoreChanged', { score: this.s.score, combo: this.s.combo });
      }
    }
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
        const s = this.s;
        if (s.freezeTicks === 0) s.iceCasts = 0;
        s.freezeTicks += Math.max(1, Math.round(ticks * ICE_STACK_DECAY ** s.iceCasts));
        s.iceCasts++;
        this.events.emit('freezeChanged', { ticks: this.s.freezeTicks });
      },
      slow: (ticks, factor) => {
        this.s.slowFactor = factor;
        this.s.slowStacks.push(ticks);
        this.events.emit('slowChanged', { stacks: this.s.slowStacks.length, factor: this.slowMultiplier });
      },
      addBarrier: (count) => {
        this.s.barrier += count;
        this.events.emit('barrierChanged', { remaining: this.s.barrier });
      },
      chainLightning: (arcs) => this.chainLightning(arcs),
      transmute: (minLength) => this.transmute(minLength),
      easyWords: (ticks) => {
        this.s.easyTicks += ticks;
        this.events.emit('easyChanged', { ticks: this.s.easyTicks });
      },
      harvestAll: () => this.harvestAll(),
      restoreWard: (points) => {
        const s = this.s;
        s.instability = this.instability.add(-Math.min(points, this.instability.value));
        this.events.emit('instabilityChanged', { value: s.instability, stage: this.instability.stage });
      },
      resetWordSpeeds: () => {
        const speed = this.pace.fallSpeed;
        const cap = speed * (1 + (this.config.speedVariance ?? SPEED_VARIANCE));
        for (const word of this.s.words) word.speed = Math.min(word.speed, word.baseSpeed, cap);
      },
      ticks: (ms) => Math.max(1, Math.round(ms / SIMULATION_STEP_MS)),
    };
  }

  /**
   * Fire: a bailout. Every word is destroyed for its base points (no combo or
   * Clean Streak), not counting toward the quota; scrolls are lost.
   */
  private burnAllWords(): void {
    const s = this.s;
    const burned = s.words.filter((w) => w.y >= this.field.height * FIRE_MIN_DEPTH);
    if (burned.length === 0) return;
    let points = 0;
    for (const word of burned) {
      this.removeWord(word);
      points += wordPoints(word.text.length, 1);
    }
    s.score += points;
    this.events.emit('wordsBurned', { words: burned, points });
    this.events.emit('scoreChanged', { score: s.score, combo: s.combo });
  }

  /**
   * Destroys words by a spell (not typing): each counts toward the quota and
   * scores `pointsFor` it; the combo is kept. Scrolls they carried are collected.
   */
  private claimWords(words: WordState[], pointsFor: (word: WordState) => number): number {
    const s = this.s;
    let points = 0;
    for (const word of words) {
      this.removeWord(word);
      s.completed++;
      points += pointsFor(word);
    }
    s.score += points;
    return points;
  }

  private afterClaim(words: WordState[]): void {
    this.events.emit('scoreChanged', { score: this.s.score, combo: this.s.combo });
    this.emitProgress();
    for (const word of words) if (word.spell) this.collect(word);
    this.checkQuota();
  }

  /** Chain Lightning: the most urgent word, then the `arcs` words nearest it. Base points each. */
  private chainLightning(arcs: number): void {
    const first = mostUrgent(this.s.words);
    if (!first) return;
    const dist = (w: WordState) => Math.hypot(w.x - first.x, w.y - first.y);
    const rest = this.s.words
      .filter((w) => w !== first)
      .sort((a, b) => dist(a) - dist(b) || a.id - b.id)
      .slice(0, arcs);
    const struck = [first, ...rest];
    const points = this.claimWords(struck, (w) => wordPoints(w.text.length, 1));
    this.events.emit('wordsShocked', { words: struck, points });
    this.afterClaim(struck);
  }

  /** Harvest: every word counts toward the quota, at half its base points. */
  private harvestAll(): void {
    const words = [...this.s.words];
    if (words.length === 0) return;
    // Half base points × the combo and Clean Streak multipliers at the moment of casting.
    const factor = multiplierOf(this.s.combo) * streakMultiplierOf(this.s.cleanStreak);
    const points = this.claimWords(words, (w) => Math.round((wordPoints(w.text.length, 1) / 2) * factor));
    this.events.emit('wordsHarvested', { words, points });
    this.afterClaim(words);
  }

  /**
   * Transmutation: words of `minLength`+ letters become 3–4 letter words, in
   * place and at the same speed. The new words avoid any text already on the
   * field and prefer unused first letters. Uses its own random stream (seeded
   * from the game seed and tick) so the spawn sequence is unaffected.
   */
  private transmute(minLength: number): void {
    const s = this.s;
    const long = s.words.filter((w) => w.text.length >= minLength);
    if (long.length === 0 || this.shortWords.length === 0) return;
    const rng = new SeededRandom((this.seed ^ Math.imul(s.tick + 1, 0x9e3779b1)) >>> 0);
    const onField = new Set(s.words.map((w) => w.match));
    const firstLetters = new Set(s.words.filter((w) => !long.includes(w)).map((w) => w.match[0]));
    const aimed = long.some((w) => w.id === s.targetId || w.id === s.pinnedId);
    const changed: WordState[] = [];

    for (const word of long) {
      let pick: string | null = null;
      let fallback: string | null = null;
      for (let attempt = 0; attempt < 24 && !pick; attempt++) {
        const candidate = rng.pick(this.shortWords);
        const lower = candidate.toLowerCase();
        if (onField.has(lower)) continue;
        if (!firstLetters.has(lower[0])) pick = candidate;
        else fallback ??= candidate;
      }
      const text = pick ?? fallback;
      if (!text) continue;
      onField.add(text.toLowerCase());
      firstLetters.add(text.toLowerCase()[0]);
      word.text = text;
      word.match = text.toLowerCase();
      word.lengthClass = lengthClassOf(text.length);
      word.typed = 0;
      changed.push(word);
    }
    if (changed.length === 0) return;
    // The console text was aimed at a word that just changed: start that entry again.
    if (aimed) this.resetInput(true);
    else if (s.input !== '') {
      this.retarget();
      this.emitInput();
    }
    this.events.emit('wordsTransmuted', { words: changed });
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
      endCombo: s.combo,
      endCleanStreak: s.cleanStreak,
      peakCleanStreak: s.peakCleanStreak,
      peakMultiplier: s.peakMultiplier,
      bonusCounts: { ...s.bonusCounts },
      levelBonuses: [...this.awardedLevelBonuses],
      elapsedMs,
      averageCompletionMs:
        s.completed === 0 ? 0 : (s.completionTicksTotal / s.completed) * SIMULATION_STEP_MS,
      spellsCast: { ...s.spellsCast },
    };
  }
}
