import { FIELD } from '../core/GameConfig';
import { SPELL_IDS, type SpellId } from '../gameplay/SpellManager';
import { validateLevels, type DifficultyConfig } from './DifficultyConfig';

/**
 * The campaign (decisions.md D-047, docs/design.md §4): two modes, Normal and
 * Hardcore, each with 5 stages. A stage is one run of 20 levels: 19 standard
 * levels, then a boss. Ten stages in all.
 *
 * Levels are generated from a speed target per stage rather than written by
 * hand. Every number that sets difficulty is in STAGE_TUNING below.
 *
 * Speeds are **Wizzy Type gameplay WPM**: the in-game WPM a player must keep
 * up (letters arriving per minute ÷ 5), not typing-test WPM.
 */
export type StageMode = 'normal' | 'hardcore';
export const STAGE_COUNT = 5;
export const STAGE_LEVELS = 20;
/** Stage 1 introduces a starter spell at this level (owner, 2026-11-17). */
export const INTRO_LEVEL = 2;
/** Each stage introduces a spell at this level. */
export const SPELL_LEVEL = 10;

export const STAGE_NAMES = ["The Apprentice's Tower", 'The Forgotten Stacks', "The Alchemist's Vault", 'The Storm Spire', 'The Unwritten'] as const;
export const BOSS_NAMES = ['The Bell Tower', 'The Last Index', 'The Crucible', 'Eye of the Storm', 'The Last Word'] as const;

/**
 * Tuning, per mode. `targetWpm[s]` is the pace of stage s's boss (the agreed
 * baseline, to be calibrated in play). Standard levels ramp from the previous
 * stage's target (`startWpm` for stage 1) up toward this one.
 */
export const STAGE_TUNING: Record<
  StageMode,
  {
    startWpm: number;
    targetWpm: readonly number[];
    /** Word length range per stage (early levels of a stage use one letter less at the top). */
    lengths: readonly (readonly [number, number])[];
    /** Seconds a word takes to fall, at the first and the last level of the mode. */
    fallSeconds: readonly [number, number];
    instabilityPerMiss: readonly number[];
    errorAcceleration: readonly number[];
    maxComplexity: readonly (number | null)[];
  }
> = {
  // WPM only sets how often words arrive; fall speed and word length are set
  // separately below. Stage 1 now opens at the busy rhythm of the later stages
  // (a word about every 1.3 s, falling in ~15 s) with tiny 2–4 letter words, so
  // the game feels alive from the first level and grows harder through word
  // length and fall speed rather than through waiting (D-057).
  normal: {
    startWpm: 23,
    targetWpm: [29, 35, 42, 48, 56],
    lengths: [[2, 4], [3, 5], [3, 6], [4, 7], [4, 8]],
    fallSeconds: [15, 10],
    instabilityPerMiss: [10, 11, 12, 13, 14],
    errorAcceleration: [12, 14, 16, 18, 20],
    maxComplexity: [0.5, 1, 1.5, 2, null],
  },
  hardcore: {
    startWpm: 35,
    targetWpm: [40, 48, 56, 64, 72],
    lengths: [[3, 5], [3, 6], [4, 7], [4, 8], [5, 9]],
    fallSeconds: [13, 8],
    instabilityPerMiss: [12, 13, 14, 15, 16],
    errorAcceleration: [16, 18, 20, 22, 24],
    maxComplexity: [1, 1.5, 2, 2.5, null],
  },
};

/** Standard levels reach this share of the stage target by level 19; the boss averages the target. */
const LEVEL_19_SHARE = 0.95;
/** The boss starts at this share of the target and ramps to BOSS_END_SHARE. */
const BOSS_START_SHARE = 0.9;
const BOSS_END_SHARE = 1.12;
/** Boss survival time per stage. */
export const BOSS_SECONDS = [60, 70, 80, 90, 100] as const;
/** A standard level lasts roughly this long at its own pace (a stage ≈ 15 minutes). */
const LEVEL_SECONDS = 37;
export const SPELL_DROP_CHANCE = 0.144; // 20% fewer (D-054)

/**
 * In-level intensity (D-051): how much each level speeds up from its start to
 * its end. Gentle early in a stage, pressing in the back half, fierce in the
 * last quarter, so the break between levels feels earned.
 */
function levelRamp(level: number): { speedRamp: number; spawnRamp: number } {
  if (level >= 15) return { speedRamp: 0.3, spawnRamp: 0.3 };
  if (level >= 10) return { speedRamp: 0.22, spawnRamp: 0.2 };
  return { speedRamp: 0.15, spawnRamp: 0.1 };
}
/** Words already falling when a level starts, so there is a choice from the first second. */
const OPENING_WORDS: Record<StageMode, number> = { normal: 4, hardcore: 5 };
/** Surges start at this level of each stage, so spells matter by levels 6–7. */
export const SURGE_FROM_LEVEL = 6;
/** Extra surge length in Hardcore. */
const HARDCORE_SURGE_MS = 1000;

/** Surges for a level: one mid-level (6–12), two (13–19), three in the boss. */
function surgesFor(mode: StageMode, level: number, boss: boolean): { at: number; ms: number }[] {
  const extra = mode === 'hardcore' ? HARDCORE_SURGE_MS : 0;
  if (boss) return [0.3, 0.6, 0.85].map((at) => ({ at, ms: 6000 + extra }));
  if (level < SURGE_FROM_LEVEL) return [];
  if (level <= 12) return [{ at: 0.55, ms: 5000 + extra }];
  return [0.35, 0.75].map((at) => ({ at, ms: 4500 + extra }));
}

/**
 * Spell unlocks (D-047, revised 2026-11-17). Stage 1 starts with Fire at
 * level 2; each stage then adds one at level 10 and one for beating its boss
 * (first playable at the start of the next stage).
 */
interface StageSpells {
  atLevel2: SpellId | null;
  atLevel10: SpellId | null;
  fromBoss: SpellId | null;
}
const SCHEDULE: readonly StageSpells[] = [
  { atLevel2: 'slow', atLevel10: 'fire', fromBoss: 'ice' },
  { atLevel2: null, atLevel10: 'barrier', fromBoss: 'shock' },
  { atLevel2: null, atLevel10: 'alter', fromBoss: 'wind' },
  { atLevel2: null, atLevel10: 'harvest', fromBoss: null },
  { atLevel2: null, atLevel10: null, fromBoss: null },
];

/** Every spell in the order a player discovers it: the default number-key layout (1–8). */
export const DISCOVERY_ORDER: readonly SpellId[] = SCHEDULE.flatMap((s) =>
  [s.atLevel2, s.atLevel10, s.fromBoss].filter((id): id is SpellId => id !== null),
);

export function spellsOfStage(stage: number): StageSpells {
  return SCHEDULE[stage - 1] ?? { atLevel2: null, atLevel10: null, fromBoss: null };
}

/** Spells known when playing a given level of a stage. */
export function knownSpells(stage: number, level: number): SpellId[] {
  const known: SpellId[] = [];
  for (let s = 1; s < stage; s++) {
    const { atLevel2, atLevel10, fromBoss } = spellsOfStage(s);
    for (const id of [atLevel2, atLevel10, fromBoss]) if (id) known.push(id);
  }
  const own = spellsOfStage(stage);
  if (own.atLevel2 && level >= INTRO_LEVEL) known.push(own.atLevel2);
  if (own.atLevel10 && level >= SPELL_LEVEL) known.push(own.atLevel10);
  return SPELL_IDS.filter((id) => known.includes(id));
}

/** The spell a level introduces with a pop-up (and drops more often), if any. */
export function introducedAt(stage: number, level: number): SpellId | null {
  if (level === INTRO_LEVEL && spellsOfStage(stage).atLevel2) return spellsOfStage(stage).atLevel2;
  if (level === SPELL_LEVEL) return spellsOfStage(stage).atLevel10;
  if (level === 1 && stage > 1) return spellsOfStage(stage - 1).fromBoss;
  return null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round = (v: number, step = 1) => Math.round(v / step) * step;

/** The in-game WPM a level demands (its average pace). */
export function levelWpm(mode: StageMode, stage: number, level: number): number {
  const t = STAGE_TUNING[mode];
  const target = t.targetWpm[stage - 1]!;
  const from = stage === 1 ? t.startWpm : t.targetWpm[stage - 2]!;
  if (level >= STAGE_LEVELS) return target;
  return lerp(from, target * LEVEL_19_SHARE, (level - 1) / (STAGE_LEVELS - 2));
}

/** Milliseconds between words that make `wpm` the pace for words of `avgLen` letters. */
function spawnFor(wpm: number, avgLen: number): number {
  return round((60000 * avgLen) / (wpm * 5), 10);
}

function buildLevel(mode: StageMode, stage: number, level: number): DifficultyConfig {
  const t = STAGE_TUNING[mode];
  const i = stage - 1;
  const boss = level === STAGE_LEVELS;
  const [minLen, maxLenStage] = t.lengths[i]!;
  // Each stage has a recognizable signature length, with shorter breathers
  // and longer previews. Retain the existing stage min/max ranges.
  const maxLen = maxLenStage;
  const signature = mode === 'normal' ? stage + 2 : stage + 3;
  const wordLengthWeights: Record<number, number> = {};
  const early = level <= 3;
  const middle = level <= 9;
  for (let length = minLen; length <= maxLen; length++) {
    const delta = length - signature;
    wordLengthWeights[length] = delta === 0 ? (early ? 7 : middle ? 6 : 3)
      : delta === -1 ? (early ? 1.4 : middle ? 1.8 : 2.5)
      : delta === 1 ? (early ? 0.8 : middle ? 1.6 : 3.5)
      : delta < -1 ? 0.12 : 0.25;
  }
  const avgLen = wordLengthWeights
    ? Object.entries(wordLengthWeights).reduce((sum, [length, weight]) => sum + Number(length) * weight, 0) /
      Object.values(wordLengthWeights).reduce((sum, weight) => sum + weight, 0)
    : (minLen + maxLen) / 2;
  // Fall time shortens steadily over the whole mode (100 levels).
  const progress = (i * STAGE_LEVELS + (level - 1)) / (STAGE_COUNT * STAGE_LEVELS - 1);
  const fall = lerp(t.fallSeconds[0], t.fallSeconds[1], progress);
  const speed = round(FIELD.height / fall);
  const wpm = boss ? t.targetWpm[i]! * BOSS_START_SHARE : levelWpm(mode, stage, level);
  const spawn = spawnFor(wpm, avgLen);
  const room = (fallS: number, spawnMs: number) => Math.min(16, Math.max(6, Math.ceil((fallS * 1000) / spawnMs) + 2));
  const spells = knownSpells(stage, level);
  const config: DifficultyConfig = {
    level,
    name: boss ? BOSS_NAMES[i]! : STAGE_NAMES[i]!,
    stage,
    chapter: Math.min(stage, 4),
    requiredWords: boss ? null : Math.max(10, round((LEVEL_SECONDS * 1000) / spawn)),
    initialFallSpeed: speed,
    spawnInterval: spawn,
    maxActiveWords: room(fall, spawn),
    minWordLength: minLen,
    maxWordLength: maxLen,
    ...(wordLengthWeights ? { wordLengthWeights } : {}),
    modifierProbabilities: {},
    instabilityPerMiss: t.instabilityPerMiss[i]!,
    errorAcceleration: t.errorAcceleration[i]!,
    availableSpells: spells,
    spellDropChance: spells.length > 0 ? SPELL_DROP_CHANCE : 0,
    maxComplexity: t.maxComplexity[i] ?? null,
    introducesSpell: introducedAt(stage, level),
    openingWords: OPENING_WORDS[mode],
    // D-054: an extra +30% fall speed by the end of each level (~15% harder overall).
    ...(boss ? {} : { ...levelRamp(level), speedRampExtra: 0.3 }),
    surges: surgesFor(mode, level, boss),
  };
  if (boss) {
    const endSpawn = spawnFor(t.targetWpm[i]! * BOSS_END_SHARE, avgLen);
    const endFall = fall * 0.88;
    config.survivalMs = BOSS_SECONDS[i]! * 1000;
    config.ramp = { initialFallSpeed: round(FIELD.height / endFall), spawnInterval: endSpawn, maxActiveWords: room(endFall, endSpawn) };
  }
  return config;
}

/** The 20 levels of one stage, validated. */
export function stageLevels(mode: StageMode, stage: number): DifficultyConfig[] {
  const raw = Array.from({ length: STAGE_LEVELS }, (_, k) => buildLevel(mode, stage, k + 1));
  return validateLevels(raw);
}

/** All ten stages, built once. */
export const STAGES: Record<StageMode, DifficultyConfig[][]> = {
  normal: Array.from({ length: STAGE_COUNT }, (_, s) => stageLevels('normal', s + 1)),
  hardcore: Array.from({ length: STAGE_COUNT }, (_, s) => stageLevels('hardcore', s + 1)),
};

export function stageLevel(mode: StageMode, stage: number, level: number): DifficultyConfig {
  const levels = STAGES[mode][stage - 1];
  if (!levels || level < 1 || level > STAGE_LEVELS) throw new RangeError(`No ${mode} stage ${stage} level ${level}`);
  return levels[level - 1]!;
}

/**
 * Wizard Duels pick from one flat list: the 100 Normal levels, numbered 1–100
 * and labelled "Stage s · Level n" (a duel needs a single level number).
 */
export function duelLevels(): DifficultyConfig[] {
  const flat = STAGES.normal.flatMap((levels, s) =>
    levels.map((l) => ({ ...l, name: `Stage ${s + 1} · ${l.level === STAGE_LEVELS ? l.name : `Level ${l.level}`}`, introducesSpell: null })),
  );
  return validateLevels(flat.map((l, k) => ({ ...l, stageLevel: l.level, level: k + 1 })));
}

/**
 * Endless mode (D-057): offered once a stage's boss is beaten. It opens at the
 * pace the stage finished on and keeps climbing, so the run ends only when the
 * ward does. Scores are kept per stage.
 */
export function endlessConfig(mode: StageMode, stage: number): DifficultyConfig {
  const boss = stageLevel(mode, stage, STAGE_LEVELS);
  // Continue at the boss's *final* pace, not the previous quota level's pace.
  const finish = boss.ramp ?? {
    initialFallSpeed: boss.initialFallSpeed,
    spawnInterval: boss.spawnInterval,
    maxActiveWords: boss.maxActiveWords,
  };
  return {
    ...boss,
    ...finish,
    name: `Endless · ${STAGE_NAMES[stage - 1] ?? ''}`,
    requiredWords: null,
    survivalMs: null,
    ramp: null,
    rampWords: stageLevel(mode, stage, STAGE_LEVELS - 1).requiredWords,
    surges: [],
    speedRampExtra: 0,
    escalation: { perWords: 25, speed: 0.055, spawn: 0.05 },
  };
}
