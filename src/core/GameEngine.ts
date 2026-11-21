import { advanceTemporalFlow, emptyTemporalFlowClock } from '../gameplay/TemporalFlow';
import { arcaneVolleyCapture, arcaneVolleyMultiplier, emptyArcaneVolley, volleyWindowTicks, type ArcaneVolleyState } from '../gameplay/ArcaneVolley';
import { applyElementalStatus, type ElementalStatus } from '../gameplay/ElementalStatus';
import type { Element } from '../gameplay/ElementalReactions';
import { isSurvival, type DifficultyConfig } from '../difficulty/DifficultyConfig';
import { InstabilityManager } from '../gameplay/InstabilityManager';
import {
  accuracyOf,
  SCORING,
  comboAfterWrongEntry,
  streakAfterTypo,
  scoreWord,
  multiplierOf,
  tierOf,
  BONUS_RATES as B,
  CLUTCH_ZONE,
  streakMultiplierOf,
  streakTierOf,
  METRONOME_CV,
  METRONOME_KEYS,
  QUICK_ZONE,
  VOLLEY_TICKS,
  wordPoints,
  wpmOf,
  type Bonus,
  type BonusId,
  type GameStats,
} from '../gameplay/ScoringSystem';
import { wordComplexity } from '../gameplay/WordGenerator';
import { precisionComboMultiplier } from '../gameplay/PrecisionComboPrototype';
import { sustainedVolleyMultiplier, type FlowCapture } from '../gameplay/SustainedVolley';
import { combustionChain, FIRE_TUNING, shockChain, type ChainLink } from '../gameplay/SpellChains';
import { RuneTracker } from '../gameplay/runes/RuneTracker';
import type { RuneDef } from '../gameplay/runes/RuneCatalogue';
import { allInMultiplier, arcaneScore, castWind, freshWard, parseWard, tickAllIn, type WardScarState } from '../gameplay/WardScar';
import {
  addCharge,
  poolSizeFor,
  trimToPool,
  consumeCharge,
  emptyCharges,
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
  /** Offline experiments only: inject a seeded generator; never set in production or duels. */
  experimentalWordGenerator?: (words: readonly string[], config: DifficultyConfig, rng: SeededRandom, seed: number) => WordGenerator;
  /** Development-preview-only scoring experiment; legacy default for existing tests/replays. */
  experimentalScoring?: boolean;
  /** Arcane preview: Ward maximum and wagers carried in (Hardcore keeps scars for the stage, D-084). */
  initialWard?: { cap: number; wagers: number };
  /** Sandbox only: hold this many charges, ignoring the mana pool. Never set in Campaign or duels. */
  poolLimitOverride?: number;
}

/** Ice Frostbound Focus (D-077): Combo gained per successive perfect capture during one freeze. EXPERIMENTAL. */
export const ICE_FOCUS_STEPS: readonly number[] = [2, 4, 8];

/**
 * Catch loop (D-086, PROVISIONAL): a mistype sends the aimed word into a
 * plunge at one of three urgency tiers (speed ×). A word already plunging
 * escalates one tier. Catch it to recover.
 */
export const PLUNGE_SPEED: readonly number[] = [1, 2.2, 3.2, 4.5];
/** Seeded tier odds for a fresh plunge: brisk, urgent, desperate. */
export const PLUNGE_ODDS: readonly number[] = [0.5, 0.35, 0.15];
/** Ice melt (D-086): once the field is cleared during a freeze, it ends after this many ticks (2 s). */
export const ICE_MELT_TICKS = 120;

/** The pace a level is running at right now (boss levels speed up over time). */
export interface Pace {
  fallSpeed: number;
  spawnInterval: number;
  maxActiveWords: number;
}

/** Each word's speed varies by up to this fraction around the level's pace. */
export const SPEED_VARIANCE = 0.25;
/** Quota levels: average speed runs from ×(1−this) at the start to ×(1+this) at the quota. */
export const LEVEL_SPEED_RAMP = 0.15;
/** During a surge words arrive this much more often, and a few more may be on the field. */
export const SURGE_SPAWN_FACTOR = 0.6;
export const SURGE_EXTRA_WORDS = 3;
/** Endless waves are independent of the permanent word-based difficulty escalation. */
export const ENDLESS_WAVE_SECONDS = 60;
export const ENDLESS_WAVE_SURGE_START = 20;
export const ENDLESS_WAVE_SURGE_END = 32;
export const ENDLESS_WAVE_RECOVERY_END = 46;
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
  config: DifficultyConfig;
  readonly seed: number;

  private readonly field: FieldConfig;
  private readonly rng: SeededRandom;
  private readonly generator: WordGenerator;
  private readonly instability: InstabilityManager;
  private readonly hardcore: boolean;
  private readonly experimentalScoring: boolean;
  /** Separate random stream for word speeds, so the word sequence is unaffected. */
  private readonly speedRng: SeededRandom;
  /** Independent stream for layout sampling: clutter fixes must not change scroll drops. */
  private readonly laneRng: SeededRandom;
  /** 3–4 letter words Transmutation can turn long words into. */
  private readonly shortWords: readonly string[];
  private awardedLevelBonuses: Bonus[] = [];
  private peakVolley = 0;
  private flowCaptures: FlowCapture[] = [];
  private arcaneVolley: ArcaneVolleyState = emptyArcaneVolley();
  /** Volley-only clock: excludes empty-field downtime, without affecting combat. */
  private volleyFlowTick = 0;
  /** Fixed-point remainder for Temporal Flow: 4 Volley ticks per 5 real ticks. */
  private volleyClock = emptyTemporalFlowClock();
  private volleyFlowProtected = false;
  /** One re-engagement grace per successful capture, never a clock rewind. */
  private volleyGraceAvailable = false;
  private volleyGraceTicks = 0;
  /** Successful spell casts buy a bounded thinking window, not a free capture. */
  private volleySpellRefreshUsed = false;
  private peakArcaneVolleyCaptures = 0;
  private activeVolleyMultiplier = 1;
  private peakArcaneVolleyMultiplier = 1;
  /** Words for Alter's easy window: short and simple, never longer than the level allows. */
  private readonly easyGenerator: WordGenerator | null;
  private readonly log: Command[] = [];
  private workshopElement: ElementalStatus | null = null;
  private pendingElementalMultiplier = 1;
  /** Ward scars and All-In wager (D-084). Legacy scoring keeps a fresh, unused Ward. */
  private ward: WardScarState = freshWard();
  /** Perfect captures in the current freeze (Frostbound Focus). */
  private iceFocus = 0;
  /** Barrier absorbed a corrected typo in the current entry (score insurance). */
  private insuredEntry = false;
  private readonly poolOverride: number | null;
  private readonly allIn = { wagers: 0, points: 0, harvests: 0, shocks: 0, typedPoints: 0 };
  /** Typel Runes earned this level (id → count). Arcane preview only. */
  private readonly runeCounts: Record<string, number> = {};
  private runePoints = 0;
  private runeTracker: RuneTracker | null = null;
  private readonly s: GameState;
  private readonly spellContext: SpellContext;
  private endlessStartedTick: number | null = null;
  private endlessWaveActive = false;
  /** Short respite after a campaign surge, without lowering the level's baseline. */
  private recoveryUntilTick = 0;

  constructor(options: EngineOptions) {
    this.config = options.config;
    this.seed = options.seed;
    this.field = options.field ?? FIELD;
    this.rng = new SeededRandom(options.seed);
    this.generator = options.experimentalWordGenerator
      ? options.experimentalWordGenerator(options.words, options.config, this.rng, options.seed)
      : new WordGenerator(options.words, options.config, this.rng);
    this.hardcore = options.hardcore === true;
    this.experimentalScoring = options.experimentalScoring === true;
    this.speedRng = new SeededRandom((this.seed ^ 0x5eed5eed) >>> 0);
    this.laneRng = new SeededRandom((this.seed ^ 0x1a4e1a4e) >>> 0);
    this.ward = this.experimentalScoring && options.initialWard ? parseWard(options.initialWard.cap, options.initialWard.wagers) : freshWard();
    // A scarred Ward can never start above its maximum.
    this.instability = new InstabilityManager(Math.max(100 - this.ward.cap, options.initialInstability ?? 0));
    this.poolOverride = options.poolLimitOverride && options.poolLimitOverride > 0 ? Math.floor(options.poolLimitOverride) : null;
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
    this.s = createInitialState(this.poolOverride ? rawCharges(options.initialSpells) : sanitizeCharges(options.initialSpells), this.instability.value);
    this.carried = (options.initialWords ?? []).map((w) => ({ ...w, isTarget: false, typed: 0 }));
    this.s.combo = carried;
    this.s.maxCombo = carried;
    this.s.peakMultiplier = this.experimentalScoring ? precisionComboMultiplier(carried) : multiplierOf(carried);
    this.s.cleanStreak = Math.max(0, Math.floor(options.initialCleanStreak ?? 0));
    this.s.peakCleanStreak = this.s.cleanStreak;
    this.spellContext = this.createSpellContext();
    if (this.experimentalScoring) {
      this.runeTracker = new RuneTracker(
        this.events,
        {
          tick: () => this.s.tick,
          fieldHeight: this.field.height,
          volley: () => this.volleyMultiplier,
          allIn: () => allInMultiplier(this.ward),
          wordsOnField: () => this.s.words.length,
          combo: () => this.s.combo,
        },
        (rune) => this.awardRune(rune),
        () => this.s.words,
      );
    }
  }

  /** Runes pay small fixed points, never multiplied (provisional, D-085). */
  private awardRune(rune: RuneDef): void {
    this.runeCounts[rune.id] = (this.runeCounts[rune.id] ?? 0) + 1;
    this.runePoints += rune.points;
    this.s.score += rune.points;
    this.events.emit('runeAwarded', { id: rune.id, name: rune.name, points: rune.points, category: rune.category });
    this.events.emit('scoreChanged', { score: this.s.score, combo: this.s.combo });
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

  /** Current fixed-tick sustained Volley multiplier for the typewriter HUD. */
  /** Preview-only readable window for the second-word Volley trigger.
   * UI consumes simulation state without changing timing or word spawning. */
  get volleyArmedProgress(): number {
    if (!this.experimentalScoring || this.arcaneVolley.captures !== 1 || this.arcaneVolley.lastTick === null) return 0;
    const window = volleyWindowTicks(this.arcaneVolley.lastLetters, this.hardcore);
    return Math.max(0, 1 - (this.volleyFlowTick - this.arcaneVolley.lastTick) / window);
  }

  get volleyMultiplier(): number {
    return this.experimentalScoring
      ? arcaneVolleyMultiplier(this.arcaneVolley, this.volleyFlowTick, this.hardcore)
      : sustainedVolleyMultiplier(this.flowCaptures, this.s.tick, this.hardcore);
  }

  /** Resume the *same* simulation after the player accepts the boss victory. */
  continueIntoEndless(config: DifficultyConfig): void {
    if (this.s.status !== 'won' || !isSurvival(this.config)) return;
    this.config = config;
    this.endlessStartedTick = this.s.tick;
    this.endlessWaveActive = false;
    this.s.status = 'playing';
    this.s.windingDown = false;
    this.s.completed = 0;
    this.s.spawnTimerMs = Math.min(this.s.spawnTimerMs, config.spawnInterval);
    this.s.input = '';
    this.s.targetId = null;
    this.s.pinnedId = null;
    this.s.penalizedId = null;
    // Keep words, their positions/speeds, score, charges, Combo, Volley,
    // active spell effects, ward and the existing seeded random streams.
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
    return isSurvival(this.config) ? Math.max(0, this.config.survivalMs! - this.elapsedMs) : null;
  }

  /**
   * Current pace. Normal levels use their fixed values; a boss level moves
   * smoothly from its base values to its `ramp` values over the timer.
   */
  get pace(): Pace {
    const c = this.config;
    let pace = { fallSpeed: c.initialFallSpeed, spawnInterval: c.spawnInterval, maxActiveWords: c.maxActiveWords };
    if (isSurvival(c) && c.ramp) {
      const t = Math.min(1, this.elapsedMs / c.survivalMs!);
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
        fallSpeed: pace.fallSpeed * Math.pow(1 + c.escalation.speed, steps),
        spawnInterval: pace.spawnInterval / Math.pow(1 + c.escalation.spawn, steps),
        maxActiveWords: Math.min(16, pace.maxActiveWords + Math.floor(steps / 4)),
      };
    }
    // Within a quota level, words come slower at the start and faster near the end (D-051).
    if (!isSurvival(c) && c.spawnRamp) pace = { ...pace, spawnInterval: pace.spawnInterval * (1 + c.spawnRamp - 2 * c.spawnRamp * this.progress) };
    if (this.s.surgeTicks > 0)
      pace = { ...pace, spawnInterval: pace.spawnInterval * SURGE_SPAWN_FACTOR, maxActiveWords: pace.maxActiveWords + SURGE_EXTRA_WORDS };
    if (!c.escalation && this.s.surgeTicks === 0 && this.s.tick < this.recoveryUntilTick)
      pace = { ...pace, spawnInterval: pace.spawnInterval * 1.25,
        maxActiveWords: Math.max(4, pace.maxActiveWords - 2) };
    if (c.escalation) {
      const wave = this.endlessWave;
      // Arrival pressure changes in waves, but the word-based difficulty floor
      // keeps rising independently. Slow's spawn rate is intentionally unchanged.
      pace = { ...pace, spawnInterval: pace.spawnInterval * wave.spawnFactor,
        maxActiveWords: Math.max(4, Math.min(16, pace.maxActiveWords + wave.extraWords)) };
    }
    return pace;
  }

  /** How far through the level we are (0–1): share of the quota, or of the boss timer. */
  private carried: WordState[] = [];

  /** How many charges fit right now: the base pool, widened by a clean run (D-057). */
  get poolLimit(): number {
    return this.poolOverride ?? poolSizeFor(this.s.manaStreak);
  }

  /** Ward as the player sees it: stability, scarred maximum and All-In window. */
  get wardInfo(): { stability: number; cap: number; wagers: number; allInTicks: number; allInMultiplier: number } {
    return {
      stability: 100 - this.instability.value,
      cap: this.ward.cap,
      wagers: this.ward.wagers,
      allInTicks: this.ward.allInTicks,
      allInMultiplier: allInMultiplier(this.ward),
    };
  }

  private endAllIn(reason: 'breach' | 'mistake' | 'heal'): void {
    if (this.ward.allInTicks === 0) return;
    this.ward = { ...this.ward, allInTicks: 0 };
    this.events.emit('allInChanged', { active: false, ticks: 0, multiplier: 1, reason });
  }

  /** Deterministic Endless pressure cycle: build, surge, relief, settle. */
  get endlessWave(): { phase: 'build' | 'surge' | 'relief' | 'settle'; spawnFactor: number; extraWords: number } {
    if (!this.config.escalation) return { phase: 'settle', spawnFactor: 1, extraWords: 0 };
    const origin = this.endlessStartedTick ?? 0;
    const seconds = ((this.s.tick - origin) * SIMULATION_STEP_MS / 1000) % ENDLESS_WAVE_SECONDS;
    if (seconds < ENDLESS_WAVE_SURGE_START) {
      const t = seconds / ENDLESS_WAVE_SURGE_START;
      return { phase: 'build', spawnFactor: 1 - 0.12 * t, extraWords: 0 };
    }
    if (seconds < ENDLESS_WAVE_SURGE_END)
      return { phase: 'surge', spawnFactor: 0.72, extraWords: 2 };
    if (seconds < ENDLESS_WAVE_RECOVERY_END)
      return { phase: 'relief', spawnFactor: 1.3, extraWords: -2 };
    return { phase: 'settle', spawnFactor: 1, extraWords: 0 };
  }

  private get progress(): number {
    const c = this.config;
    if (c.requiredWords) return Math.min(1, this.s.completed / c.requiredWords);
    if (c.survivalMs) return Math.min(1, this.elapsedMs / c.survivalMs);
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
    if (s.surgeTicks > 0 && --s.surgeTicks === 0) {
      if (!c.escalation) this.recoveryUntilTick = s.tick + Math.round(4000 / SIMULATION_STEP_MS);
      this.events.emit('surgeChanged', { active: false });
    }
    if (!c.requiredWords && !c.survivalMs && c.rampWords) {
      const lap = Math.floor(s.completed / c.rampWords);
      if (lap !== s.surgeLap) {
        s.surgeLap = lap;
        s.surgesStarted = 0;
      }
    }
    if (c.escalation) {
      const active = this.endlessWave.phase === 'surge';
      if (active !== this.endlessWaveActive) {
        this.endlessWaveActive = active;
        this.events.emit('surgeChanged', { active });
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

    // Surviving the boss timer wins immediately, preserving the field for Endless.
    const remaining = this.survivalRemainingMs;
    if (remaining !== null && remaining <= 0) return this.end('won');

    this.tickPacing();

    if (this.ward.allInTicks > 0) {
      this.ward = tickAllIn(this.ward);
      if (this.ward.allInTicks === 0) this.events.emit('allInChanged', { active: false, ticks: 0, multiplier: 1, reason: 'expired' });
    }

    // Flow Preservation: monotonic Volley time. The first return after an
    // empty field grants at most 0.4 s of paused Volley time, once per
    // successful capture. Empty/refill cycles cannot stack the allowance.
    if (this.experimentalScoring) {
      if (s.words.length === 0) {
        this.volleyFlowProtected = true;
      } else {
        if (this.volleyFlowProtected) {
          if (this.volleyGraceAvailable) {
            this.volleyGraceTicks = Math.round(400 / SIMULATION_STEP_MS);
            this.volleyGraceAvailable = false;
          }
          this.volleyFlowProtected = false;
        }
        // D-077: Volley time keeps running during Ice. Slow's timer is paused by
        // the freeze, so its 80% Volley clock pauses with it.
        const grace = this.volleyGraceTicks > 0;
        if (this.volleyGraceTicks > 0) this.volleyGraceTicks--;
        this.volleyClock = advanceTemporalFlow(this.volleyClock, s.slowStacks.length > 0 && s.freezeTicks === 0, grace);
        this.volleyFlowTick = this.volleyClock.tick;
      }
    }

    // Frostbinding: nothing moves and nothing spawns (slow stacks wait too).
    if (s.freezeTicks > 0) {
      for (const word of s.words) word.prevY = word.y;
      // Ice melt: a cleared board thaws in a short rest instead of wasting the freeze.
      if (this.experimentalScoring && s.words.length === 0 && s.freezeTicks > ICE_MELT_TICKS) {
        s.freezeTicks = ICE_MELT_TICKS;
        this.events.emit('iceMelting', { ticks: ICE_MELT_TICKS });
      }
      if (--s.freezeTicks === 0) {
        this.iceFocus = 0;
        this.events.emit('spellEnded', { spell: 'ice' });
      }
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
    if (s.spawnTimerMs === 0 && !s.windingDown && s.words.length < pace.maxActiveWords) {
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
      case 'cast':
        return this.castSpell(command.spell);
    }
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
      if (this.experimentalScoring) {
        this.iceFocus = 0;
        if (!this.insuredEntry && s.barrier > 0) {
          // Barrier score insurance (prototype): one layer covers this entry's typos.
          s.barrier--;
          this.insuredEntry = true;
          this.events.emit('barrierChanged', { remaining: s.barrier });
          this.events.emit('scoreInsured', { barrierLeft: s.barrier });
        }
        if (!this.insuredEntry) {
          this.setCombo(0);
          this.setCleanStreak(0, 'typo');
          this.shrinkPool();
          this.flowCaptures = [];
          this.arcaneVolley = emptyArcaneVolley();
          this.activeVolleyMultiplier = 1;
          if (this.hardcore) this.endAllIn('mistake');
        }
      } else this.setCleanStreak(streakAfterTypo(s.cleanStreak), 'typo');
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
      const cleanSpell = !s.entryTypo;
      this.resetInput(true);
      return this.castSpell(input, cleanSpell);
    }

    // 3. Anything else is an incomplete or misspelled word:
    // guess what the player meant and treat it as a missed submission.
    // A word already penalised for a typo in this same entry isn't penalised again.
    const guess = pinned ?? guessIntendedWord(s.words, input);
    // A wrong entry drops the multiplier one tier (D-040) and ends the Clean Streak (D-046).
    this.setCombo(this.experimentalScoring ? 0 : comboAfterWrongEntry(s.combo));
    if (this.experimentalScoring) {
      this.iceFocus = 0;
      if (this.hardcore) this.endAllIn('mistake');
    }
    this.flowCaptures = [];
    this.arcaneVolley = emptyArcaneVolley();
    this.activeVolleyMultiplier = 1;
    this.setCleanStreak(0, 'wrongEntry');
    this.shrinkPool();
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

  private castSpell(spell: SpellId, cleanTyped = false): void {
    const s = this.s;
    if (!consumeCharge(s.spells, spell)) {
      this.events.emit('spellFizzled', { spell });
      return;
    }
    s.spellsCast[spell]++;
    if (this.experimentalScoring && !this.volleySpellRefreshUsed && this.volleyMultiplier > 1) {
      // A successful spell is a rhythm action: refresh, don't pause or capture.
      this.arcaneVolley = { ...this.arcaneVolley, lastTick: this.volleyFlowTick };
      this.volleySpellRefreshUsed = true;
    }
    if (this.experimentalScoring && this.hardcore && cleanTyped) {
      // Hardcore rewards the typed spell as a precision combo action, not an enemy capture.
      this.setCombo(s.combo + 1);
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      const points = arcaneScore(spell.length * SCORING.pointsPerLetter, precisionComboMultiplier(s.combo), 1, allInMultiplier(this.ward));
      if (this.ward.allInTicks > 0) this.allIn.points += points;
      s.score += points;
      this.events.emit('scoreChanged', { score: s.score, combo: s.combo });
    }
    const elementalSpells: Partial<Record<SpellId, Element>> = { fire: 'fire', ice: 'ice', shock: 'shock', wind: 'wind' };
    const incoming = elementalSpells[spell];
    this.pendingElementalMultiplier = 1;
    if (incoming) {
      const transition = applyElementalStatus(this.workshopElement, incoming, s.tick, Math.round(8000 / SIMULATION_STEP_MS));
      this.workshopElement = transition.next;
      this.pendingElementalMultiplier = transition.damageMultiplier;
      if (transition.previous && transition.outcome.reaction !== 'none') {
        this.events.emit('elementalReaction', {
          previous: transition.previous, incoming, reaction: transition.outcome.reaction,
          damageMultiplier: transition.damageMultiplier,
        });
      }
    }
    this.events.emit('spellCast', { spell, charges: { ...s.spells } });
    SPELLS[spell].cast(this.spellContext);
    this.pendingElementalMultiplier = 1;
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
    this.s.penalizedId = word.id;
    if (!this.experimentalScoring) {
      word.speed += this.config.errorAcceleration;
      return;
    }
    // Catch loop: plunge (or escalate a plunge) instead of a small speed bump.
    const current = word.plunge ?? 0;
    let tier = current + 1;
    if (current === 0) {
      const roll = new SeededRandom((this.seed ^ Math.imul(this.s.tick + word.id * 31 + 3, 0x27d4eb2f)) >>> 0).next();
      tier = roll < PLUNGE_ODDS[0]! ? 1 : roll < PLUNGE_ODDS[0]! + PLUNGE_ODDS[1]! ? 2 : 3;
    }
    tier = Math.min(3, tier);
    if (tier === current) return;
    word.speed = (word.speed / PLUNGE_SPEED[current]!) * PLUNGE_SPEED[tier]!;
    word.plunge = tier as 1 | 2 | 3;
    this.events.emit('wordPlunged', { word, tier });
  }

  private resetInput(unpin: boolean): void {
    const s = this.s;
    s.input = '';
    s.penalizedId = null;
    s.entryTypo = false;
    this.insuredEntry = false;
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
    // Keep the spawn cadence and word count unchanged. Prefer a clear lane
    // near the top so crowded fields remain readable, even under stacked Slow.
    let x = Math.round(minX < maxX ? this.rng.range(minX, maxX) : this.field.width / 2);
    if (minX < maxX && s.words.some((w) => w.y < 90)) {
      const score = (candidate: number): number => s.words.reduce((penalty, w) => {
        if (w.y >= 90) return penalty;
        const required = halfWidth + w.text.length * this.field.approxCharWidth / 2 + 12;
        const overlap = Math.max(0, required - Math.abs(candidate - w.x));
        return penalty + overlap * (w.y < 45 ? 2 : 1);
      }, 0);
      let best = score(x);
      for (let i = 0; i < 10; i++) {
        const candidate = Math.round(this.laneRng.range(minX, maxX));
        const penalty = score(candidate);
        if (penalty < best) { x = candidate; best = penalty; }
        if (best === 0) break;
      }
    }

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
    // Read before removeWord: removing the aimed word resets the entry.
    const entryInsured = this.insuredEntry;
    this.removeWord(word);
    s.completed++;
    const perfect = word.errors === 0 && !s.entryTypo;
    // Barrier insurance: a protected corrected capture is not perfect; it keeps Combo/Volley but adds nothing.
    const insured = this.experimentalScoring && !perfect && entryInsured;
    if (!this.experimentalScoring) this.setCombo(s.combo + 1);
    else if (perfect) this.setCombo(s.combo + this.comboStep());
    else if (!insured) this.setCombo(0);
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.completionTicksTotal += s.tick - word.spawnTick;
    const multiplier = this.experimentalScoring ? precisionComboMultiplier(s.combo) : multiplierOf(s.combo);
    // Clean Streak: a word typed with no typo adds one. The capture that reaches
    // a milestone already scores at its multiplier (D-046).
    if (word.errors === 0 && !s.entryTypo) {
      this.setCleanStreak(s.cleanStreak + 1, 'capture');
      this.growPool();
    }
    const bonuses = this.wordBonuses(word);
    this.flowCaptures = this.flowCaptures.filter((capture) => s.tick - capture.tick <= 300);
    if (perfect) this.flowCaptures.push({ tick: s.tick, letters: word.text.length });
    else this.flowCaptures = [];
    if (this.experimentalScoring) {
      this.volleySpellRefreshUsed = false;
      this.volleyGraceAvailable = perfect;
      this.volleyGraceTicks = 0;
    }
    if (this.experimentalScoring) this.arcaneVolley = perfect
      ? arcaneVolleyCapture(this.arcaneVolley, this.volleyFlowTick, word.text.length, this.hardcore)
      : insured ? this.arcaneVolley : emptyArcaneVolley();
    this.activeVolleyMultiplier = this.experimentalScoring
      ? arcaneVolleyMultiplier(this.arcaneVolley, this.volleyFlowTick, this.hardcore)
      : sustainedVolleyMultiplier(this.flowCaptures, s.tick, this.hardcore);
    if (this.experimentalScoring) {
      this.peakArcaneVolleyMultiplier = Math.max(this.peakArcaneVolleyMultiplier, this.activeVolleyMultiplier);
      if (this.activeVolleyMultiplier > 1)
        this.peakArcaneVolleyCaptures = Math.max(this.peakArcaneVolleyCaptures, this.arcaneVolley.captures);
    }
    if (this.experimentalScoring && this.activeVolleyMultiplier > 1 && !bonuses.some((b) => b.id === 'volley')) bonuses.push({ id: 'volley', count: this.flowCaptures.length, rate: 0, points: 0 });
    const points = this.experimentalScoring
      ? arcaneScore(this.basePoints(word), multiplier, this.activeVolleyMultiplier, allInMultiplier(this.ward))
      : scoreWord(word.text.length, multiplier, bonuses, streakMultiplierOf(s.cleanStreak));
    if (this.experimentalScoring && this.ward.allInTicks > 0) {
      this.allIn.points += points;
      this.allIn.typedPoints += points;
    }
    s.score += points;
    for (const b of bonuses) s.bonusCounts[b.id] = (s.bonusCounts[b.id] ?? 0) + 1;

    this.events.emit('wordCompleted', { word, points, combo: s.combo, multiplier, bonuses, streakMultiplier: this.experimentalScoring ? 1 : streakMultiplierOf(s.cleanStreak), perfect, volley: this.activeVolleyMultiplier });
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
    const overflowPoints = stored ? 0 : OVERFLOW_POINTS * (this.experimentalScoring ? precisionComboMultiplier(s.combo) : multiplierOf(s.combo));
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
    if (this.experimentalScoring) this.endAllIn('breach');
    this.setCombo(0);
    this.flowCaptures = [];
    this.activeVolleyMultiplier = 1;
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

  /** Sets the Clean Streak (D-046) and reports the change. */
  /** A clean capture: the pool may widen a step. */
  private growPool(): void {
    const before = this.poolLimit;
    if (this.experimentalScoring) this.s.manaStreak = this.s.combo;
    else this.s.manaStreak++;
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
    const before = this.experimentalScoring ? Math.floor(s.combo / 10) : tierOf(s.combo);
    s.combo = combo;
    const after = this.experimentalScoring ? Math.floor(combo / 10) : tierOf(combo);
    if (after !== before) {
      const multiplier = this.experimentalScoring ? precisionComboMultiplier(combo) : multiplierOf(combo);
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
    s.recentCaptures = s.recentCaptures.filter((t) => s.tick - t <= VOLLEY_TICKS);
    s.recentCaptures.push(s.tick);
    const volley = s.recentCaptures.length;
    this.peakVolley = Math.max(this.peakVolley, volley);
    if (!this.experimentalScoring && volley >= 3) add('volley', Math.min(B.volleyMax, (volley - 2) * B.volleyPer), volley);

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
    if (result === 'won') this.runeTracker?.levelWon();
    // Legacy end-of-level bonuses are superseded in Arcane/Typel scoring (four-pillar register).
    if (result === 'won' && !this.experimentalScoring) {
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

  /** Combo gained by a perfect capture: +1, or Frostbound Focus steps during Ice. */
  private comboStep(): number {
    if (this.s.freezeTicks === 0) return 1;
    const step = ICE_FOCUS_STEPS[Math.min(this.iceFocus, ICE_FOCUS_STEPS.length - 1)]!;
    this.iceFocus++;
    this.events.emit('iceFocus', { streak: this.iceFocus, gain: step });
    return step;
  }

  /** Arcane base points: Alter keeps the original word's value (prototype). */
  private basePoints(word: WordState): number {
    return (word.originalLength ?? word.text.length) * SCORING.pointsPerLetter;
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
        // Every heal obeys the scarred maximum.
        const floor = 100 - this.ward.cap;
        s.instability = this.instability.add(-Math.max(0, Math.min(points, this.instability.value - floor)));
        this.events.emit('instabilityChanged', { value: s.instability, stage: this.instability.stage });
      },
      wind: (heal) => this.castWindSpell(heal),
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
    if (this.experimentalScoring) {
      // D-079 direction, provisional: Combustion Chain. The lower half ignites;
      // flames leap between nearby words. Base points × (1 + 0.25 per generation);
      // no Combo, Volley or quota.
      const { burned, links } = combustionChain(s.words, this.field.height);
      if (burned.length === 0) return;
      let points = 0;
      for (const { word, depth } of burned) {
        this.removeWord(word);
        points += Math.round(wordPoints(word.text.length, 1) * (1 + FIRE_TUNING.depthBonus * depth) * this.pendingElementalMultiplier);
      }
      s.score += points;
      this.events.emit('wordsBurned', { words: burned.map((b) => b.word), points, depths: burned.map((b) => b.depth), links });
      this.events.emit('scoreChanged', { score: s.score, combo: s.combo });
      return;
    }
    const burned = s.words.filter((w) => w.y >= this.field.height * FIRE_MIN_DEPTH);
    if (burned.length === 0) return;
    let points = 0;
    for (const word of burned) {
      this.removeWord(word);
      points += Math.round(wordPoints(word.text.length, 1) * this.pendingElementalMultiplier);
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
    if (this.experimentalScoring) {
      // D-080 direction, provisional odds: guaranteed first strike, seeded spatial chain.
      const rng = new SeededRandom((this.seed ^ Math.imul(this.s.tick + 7, 0x85ebca6b)) >>> 0);
      // D-086: the 3 words closest to the Ward are always struck; the chain grows from them.
      const firsts = [...this.s.words].sort((a, b) => b.y - a.y || a.id - b.id).slice(0, 3);
      const chain = shockChain(this.s.words, firsts, rng);
      return this.shockPayout(chain.struck, chain.links);
    }
    const struck = [first, ...rest];
    if (this.experimentalScoring) {
      // Prototype cash-out: base × earned Combo × All-In; arcs unchanged (D-080 odds undecided).
      const base = struck.reduce((sum, w) => sum + Math.round(this.basePoints(w) * this.pendingElementalMultiplier), 0);
      const allIn = allInMultiplier(this.ward);
      const total = arcaneScore(base, precisionComboMultiplier(this.s.combo), 1, allIn);
      this.claimWords(struck, () => 0);
      this.s.score += total;
      if (allIn > 1) {
        this.allIn.points += total;
        this.allIn.shocks++;
      }
      this.events.emit('wordsShocked', { words: struck, points: total });
      return this.afterClaim(struck);
    }
    const points = this.claimWords(struck, (w) => Math.round(wordPoints(w.text.length, 1) * this.pendingElementalMultiplier));
    this.events.emit('wordsShocked', { words: struck, points });
    this.afterClaim(struck);
  }

  /** The single authoritative Wind decision (D-084); legacy rules keep the flat heal. */
  private castWindSpell(heal: number): void {
    const s = this.s;
    if (!this.experimentalScoring) return this.spellContext.restoreWard(heal);
    const r = castWind(this.ward, 100 - this.instability.value);
    this.ward = r.ward;
    s.instability = this.instability.add(100 - r.stability - this.instability.value);
    s.peakInstability = Math.max(s.peakInstability, s.instability);
    if (r.outcome === 'wager') this.allIn.wagers++;
    this.events.emit('instabilityChanged', { value: s.instability, stage: this.instability.stage });
    this.events.emit('windCast', { outcome: r.outcome, stability: r.stability, cap: r.ward.cap, scar: r.scar, endedAllIn: r.endedAllIn, wagers: r.ward.wagers });
    if (r.outcome === 'wager')
      this.events.emit('allInChanged', { active: true, ticks: r.ward.allInTicks, multiplier: allInMultiplier(r.ward), reason: 'wager' });
    else if (r.endedAllIn) this.events.emit('allInChanged', { active: false, ticks: 0, multiplier: 1, reason: 'heal' });
  }

  /** Shock cash-out: base × earned Combo × All-In; never adds Combo or Volley; counts quota. */
  private shockPayout(struck: WordState[], links: ChainLink[]): void {
    const base = struck.reduce((sum, w) => sum + Math.round(this.basePoints(w) * this.pendingElementalMultiplier), 0);
    const allIn = allInMultiplier(this.ward);
    const total = arcaneScore(base, precisionComboMultiplier(this.s.combo), 1, allIn);
    this.claimWords(struck, () => 0);
    this.s.score += total;
    if (allIn > 1) {
      this.allIn.points += total;
      this.allIn.shocks++;
    }
    this.events.emit('wordsShocked', { words: struck, points: total, links });
    this.afterClaim(struck);
  }

  /** Harvest: every word counts toward the quota, at half its base points. */
  private harvestAll(): void {
    const words = [...this.s.words];
    if (words.length === 0) return;
    if (this.experimentalScoring) {
      // D-084: full original base × earned Combo × active Volley × All-In, rounded once.
      // Volley is consumed after paying out; Combo persists; no captures are added.
      const base = words.reduce((sum, w) => sum + this.basePoints(w), 0);
      const volley = this.volleyMultiplier;
      const allIn = allInMultiplier(this.ward);
      const total = arcaneScore(base, precisionComboMultiplier(this.s.combo), volley, allIn);
      this.claimWords(words, () => 0);
      this.s.score += total;
      if (allIn > 1) {
        this.allIn.points += total;
        this.allIn.harvests++;
      }
      this.arcaneVolley = emptyArcaneVolley();
      this.activeVolleyMultiplier = 1;
      this.flowCaptures = [];
      this.events.emit('wordsHarvested', { words, points: total, volley, allIn });
      return this.afterClaim(words);
    }
    // Half base points × the combo and Clean Streak multipliers at the moment of casting.
    const factor = this.experimentalScoring ? precisionComboMultiplier(this.s.combo) : multiplierOf(this.s.combo) * streakMultiplierOf(this.s.cleanStreak);
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
    // Typel (D-086): every word longer than 3 letters is rewritten; legacy keeps its length gate.
    const long = s.words.filter((w) => w.text.length >= (this.experimentalScoring ? 4 : minLength));
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
      word.originalLength ??= word.text.length;
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
      peakVolley: this.peakVolley,
      endCombo: s.combo,
      endCleanStreak: s.cleanStreak,
      peakCleanStreak: s.peakCleanStreak,
      peakMultiplier: s.peakMultiplier,
      scoringModel: this.experimentalScoring ? 'arcane' : 'legacy',
      peakArcaneVolleyMultiplier: this.experimentalScoring ? this.peakArcaneVolleyMultiplier : undefined,
      peakArcaneVolleyCaptures: this.experimentalScoring ? this.peakArcaneVolleyCaptures : undefined,
      endArcaneVolleyMultiplier: this.experimentalScoring ? this.volleyMultiplier : undefined,
      bonusCounts: { ...s.bonusCounts },
      levelBonuses: [...this.awardedLevelBonuses],
      elapsedMs,
      averageCompletionMs:
        s.completed === 0 ? 0 : (s.completionTicksTotal / s.completed) * SIMULATION_STEP_MS,
      spellsCast: { ...s.spellsCast },
      ...(this.experimentalScoring
        ? {
            allInWagers: this.allIn.wagers,
            allInPoints: this.allIn.points,
            allInTypedPoints: this.allIn.typedPoints,
            allInHarvests: this.allIn.harvests,
            allInShocks: this.allIn.shocks,
            wardCap: this.ward.cap,
            wardWagers: this.ward.wagers,
            runeCounts: { ...this.runeCounts },
            runePoints: this.runePoints,
          }
        : {}),
    };
  }
}

/** Sandbox charges: whole non-negative numbers, no pool trimming. */
function rawCharges(input?: Partial<SpellCharges>): SpellCharges {
  const charges = emptyCharges();
  for (const id of SPELL_IDS) {
    const v = input?.[id];
    if (typeof v === 'number' && Number.isFinite(v)) charges[id] = Math.max(0, Math.floor(v));
  }
  return charges;
}
