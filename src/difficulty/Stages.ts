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
/** Levels where a stage introduces its first spell. */
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
  normal: {
    startWpm: 12,
    targetWpm: [18, 22, 26, 30, 35],
    lengths: [[3, 5], [3, 6], [4, 7], [4, 8], [5, 9]],
    fallSeconds: [17, 10],
    instabilityPerMiss: [10, 11, 12, 13, 14],
    errorAcceleration: [12, 14, 16, 18, 20],
    maxComplexity: [0.5, 1, 1.5, 2, null],
  },
  hardcore: {
    startWpm: 18,
    targetWpm: [25, 30, 35, 40, 45],
    lengths: [[3, 6], [4, 7], [4, 8], [5, 9], [5, 10]],
    fallSeconds: [14, 7.5],
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
export const BOSS_SECONDS = [60, 75, 90, 105, 120] as const;
/** A standard level lasts roughly this long at its own pace. */
const LEVEL_SECONDS = 65;
const SPELL_DROP_CHANCE = 0.12;

/**
 * Spell unlocks (D-047): two per stage, in power order. The first arrives at
 * level 10; the second is the reward for beating the boss and is first
 * playable at the start of the next stage. Stage 5 adds none: by then all
 * eight are known, and the final stage is the test.
 */
export function spellsOfStage(stage: number): { atLevel10: SpellId | null; fromBoss: SpellId | null } {
  if (stage < 1 || stage > 4) return { atLevel10: null, fromBoss: null };
  return { atLevel10: SPELL_IDS[(stage - 1) * 2]!, fromBoss: SPELL_IDS[(stage - 1) * 2 + 1]! };
}

/** Spells known when playing a given level of a stage. */
export function knownSpells(stage: number, level: number): SpellId[] {
  const known: SpellId[] = [];
  for (let s = 1; s < stage; s++) {
    const { atLevel10, fromBoss } = spellsOfStage(s);
    if (atLevel10) known.push(atLevel10);
    if (fromBoss) known.push(fromBoss);
  }
  const own = spellsOfStage(stage).atLevel10;
  if (own && level >= SPELL_LEVEL) known.push(own);
  return SPELL_IDS.filter((id) => known.includes(id));
}

/** The spell a level introduces with a pop-up (and drops more often), if any. */
export function introducedAt(stage: number, level: number): SpellId | null {
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
  const maxLen = level <= SPELL_LEVEL && !boss ? Math.max(minLen + 1, maxLenStage - 1) : maxLenStage;
  const avgLen = (minLen + maxLen) / 2;
  // Fall time shortens steadily over the whole mode (100 levels).
  const progress = (i * STAGE_LEVELS + (level - 1)) / (STAGE_COUNT * STAGE_LEVELS - 1);
  const fall = lerp(t.fallSeconds[0], t.fallSeconds[1], progress);
  const speed = round(FIELD.height / fall);
  const wpm = boss ? t.targetWpm[i]! * BOSS_START_SHARE : levelWpm(mode, stage, level);
  const spawn = spawnFor(wpm, avgLen);
  const room = (fallS: number, spawnMs: number) => Math.min(15, Math.max(4, Math.ceil((fallS * 1000) / spawnMs) + 2));
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
    modifierProbabilities: {},
    instabilityPerMiss: t.instabilityPerMiss[i]!,
    errorAcceleration: t.errorAcceleration[i]!,
    availableSpells: spells,
    spellDropChance: spells.length > 0 ? SPELL_DROP_CHANCE : 0,
    maxComplexity: t.maxComplexity[i] ?? null,
    introducesSpell: introducedAt(stage, level),
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
