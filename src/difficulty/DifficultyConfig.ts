import { isSpellId, type SpellId } from '../gameplay/SpellManager';

/**
 * Everything that makes one level harder or easier than another.
 *
 * Campaign, Practice and multiplayer all read these same objects; no mode
 * calculates its own difficulty. Campaign levels live in src/data/levels.json
 * and are checked by validateLevels() when the game loads.
 */
export interface DifficultyConfig {
  level: number;
  name: string;
  /** Words to complete to clear the level. null = endless. */
  requiredWords: number | null;
  /** Fall speed of a newly spawned word, in field pixels per second. */
  initialFallSpeed: number;
  /** Milliseconds between spawns (when there is room for another word). */
  spawnInterval: number;
  /** Most words allowed on the field at once. */
  maxActiveWords: number;
  minWordLength: number;
  maxWordLength: number;
  /**
   * Relative chance of each word length, e.g. { 3: 1, 4: 2, 5: 2 }.
   * Omitted lengths in range get weight 0; omit the whole table for an even spread.
   */
  wordLengthWeights?: Readonly<Partial<Record<number, number>>>;
  /** Chance per spawn of each special modifier. Unused until Milestone 6. */
  modifierProbabilities: Readonly<Record<string, number>>;
  /** Instability (out of 100) added when a word reaches the ward line. */
  instabilityPerMiss: number;
  /**
   * Fall speed (px/s) added to the targeted word for each wrong keystroke.
   * Based on reports of the original game; see original-game-research.md #4–5.
   */
  errorAcceleration: number;
  /**
   * Spells whose scrolls can appear on this level. Charges already held can
   * always be cast; this only controls what can be found.
   */
  availableSpells: readonly SpellId[];
  /** Chance (0–1) that a newly spawned word carries a spell scroll. */
  spellDropChance: number;
  /**
   * Highest word complexity allowed (see wordComplexity: rare letters,
   * consonant clusters, names). Omit for no limit. Early levels keep this low.
   */
  maxComplexity?: number | null;
  /** Per-word speed variation, as a fraction (default 0.25 = ±25%). */
  speedVariance?: number;
  /** Average speed rises from ×(1−this) to ×(1+this) over the level's words (default 0.15). */
  speedRamp?: number;
  /**
   * Words over which the speed ramp runs when there is no quota (Practice keeps
   * the Campaign level's quota here so speeds match exactly).
   */
  rampWords?: number | null;
  /** Campaign chapter (1–4). Display only. */
  chapter?: number;
  /**
   * The spell this level introduces: the Campaign shows a pop-up about it
   * before the level starts, and its scrolls drop more often here.
   */
  introducesSpell?: SpellId | null;
  /**
   * Boss (survival) level: survive this long to clear it. Such levels have
   * no word quota (requiredWords is null).
   */
  survivalMs?: number | null;
  /**
   * Boss levels only: the pace reached by the end of the survival timer.
   * Fall speed, spawn interval and words on screen move smoothly from the
   * level's base values to these.
   */
  ramp?: Readonly<{ initialFallSpeed: number; spawnInterval: number; maxActiveWords: number }> | null;
}

/** True for a boss level (survive a timer instead of reaching a quota). */
export function isSurvival(config: DifficultyConfig): boolean {
  return typeof config.survivalMs === 'number' && config.survivalMs > 0;
}

/** Weighted average word length a level produces (a rough difficulty measure). */
export function averageWordLength(config: DifficultyConfig): number {
  let total = 0;
  let weightSum = 0;
  for (let len = config.minWordLength; len <= config.maxWordLength; len++) {
    const weight = config.wordLengthWeights ? (config.wordLengthWeights[len] ?? 0) : 1;
    total += len * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : total / weightSum;
}

/**
 * Peak typing demand in characters per second if the field is kept full:
 * how fast letters arrive (spawn rate × average length).
 */
export function letterArrivalRate(config: DifficultyConfig): number {
  return averageWordLength(config) / (config.spawnInterval / 1000);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Checks raw level data (e.g. parsed JSON) and returns typed configs, or
 * throws an Error listing every problem found. Levels must be numbered
 * 1, 2, 3… in order.
 */
export function validateLevels(data: unknown): DifficultyConfig[] {
  if (!Array.isArray(data) || data.length === 0) throw new Error('Levels must be a non-empty array');
  const problems: string[] = [];

  data.forEach((raw: Record<string, unknown>, index) => {
    const at = `level[${index}]`;
    const fail = (msg: string) => problems.push(`${at}: ${msg}`);
    if (typeof raw !== 'object' || raw === null) return fail('not an object');

    if (raw.level !== index + 1) fail(`level must be ${index + 1}`);
    if (typeof raw.name !== 'string' || raw.name.trim() === '') fail('name missing');
    if (!(raw.requiredWords === null || (isNum(raw.requiredWords) && raw.requiredWords > 0)))
      fail('requiredWords must be a positive number or null');
    for (const key of ['initialFallSpeed', 'spawnInterval', 'maxActiveWords', 'errorAcceleration'] as const) {
      if (!isNum(raw[key]) || (raw[key] as number) < 0) fail(`${key} must be a non-negative number`);
    }
    if (!isNum(raw.instabilityPerMiss) || raw.instabilityPerMiss <= 0 || raw.instabilityPerMiss > 100)
      fail('instabilityPerMiss must be in (0, 100]');
    if (!isNum(raw.minWordLength) || !isNum(raw.maxWordLength) || raw.minWordLength > raw.maxWordLength)
      fail('minWordLength/maxWordLength invalid');
    if (raw.wordLengthWeights !== undefined) {
      const weights = raw.wordLengthWeights as Record<string, unknown>;
      if (typeof weights !== 'object' || weights === null) fail('wordLengthWeights must be an object');
      else
        for (const [len, w] of Object.entries(weights)) {
          const n = Number(len);
          if (!isNum(w) || w < 0) fail(`weight for length ${len} invalid`);
          if (isNum(raw.minWordLength) && isNum(raw.maxWordLength) && (n < raw.minWordLength || n > raw.maxWordLength))
            fail(`weight for length ${len} is outside min/max word length`);
        }
    }
    if (typeof raw.modifierProbabilities !== 'object' || raw.modifierProbabilities === null)
      fail('modifierProbabilities must be an object');
    if (!Array.isArray(raw.availableSpells)) fail('availableSpells must be an array');
    else for (const id of raw.availableSpells) if (!isSpellId(id)) fail(`unknown spell "${String(id)}"`);
    if (!isNum(raw.spellDropChance) || raw.spellDropChance < 0 || raw.spellDropChance > 1)
      fail('spellDropChance must be between 0 and 1');
    if (raw.maxComplexity !== undefined && raw.maxComplexity !== null && (!isNum(raw.maxComplexity) || raw.maxComplexity < 0))
      fail('maxComplexity must be a number ≥ 0');
    if (raw.introducesSpell !== undefined && raw.introducesSpell !== null) {
      if (!isSpellId(raw.introducesSpell)) fail(`unknown introduced spell "${String(raw.introducesSpell)}"`);
      else if (Array.isArray(raw.availableSpells) && !raw.availableSpells.includes(raw.introducesSpell))
        fail('introducesSpell must be one of availableSpells');
    }
    if (raw.survivalMs !== undefined && raw.survivalMs !== null) {
      if (!isNum(raw.survivalMs) || raw.survivalMs <= 0) fail('survivalMs must be a positive number');
      if (raw.requiredWords !== null) fail('a survival level must have requiredWords: null');
    }
    if (raw.ramp !== undefined && raw.ramp !== null) {
      const ramp = raw.ramp as Record<string, unknown>;
      if (typeof ramp !== 'object') fail('ramp must be an object');
      else
        for (const key of ['initialFallSpeed', 'spawnInterval', 'maxActiveWords'] as const)
          if (!isNum(ramp[key]) || (ramp[key] as number) <= 0) fail(`ramp.${key} must be a positive number`);
    }
  });

  if (problems.length > 0) throw new Error(`Invalid level data:\n${problems.join('\n')}`);

  // JSON object keys are strings; convert length weights back to numeric keys.
  return (data as Record<string, unknown>[]).map((raw) => {
    const config = { ...raw } as unknown as DifficultyConfig;
    if (raw.wordLengthWeights) {
      config.wordLengthWeights = Object.fromEntries(
        Object.entries(raw.wordLengthWeights as Record<string, number>).map(([k, v]) => [Number(k), v]),
      );
    }
    return config;
  });
}
