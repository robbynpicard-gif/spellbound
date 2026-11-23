/**
 * TypeL Apprenticeship (prototype, D-085). Replaces the 5 × 20 campaign as
 * the main mode. Nine apprenticeships: one per spell, then the Grandmaster (GAME-004).
 *
 * Difficulty is *extracted* from the old 5-stage curve (docs/decisions D-047,
 * src/difficulty/Stages.ts): each apprenticeship compresses one stage-like
 * climb into 12 levels plus a spell boss, and its starting point rises along
 * the old stage 1 → 5 curve. Masters, names and every line are PLACEHOLDERS.
 */
import { averageWordLength, type DifficultyConfig } from '../difficulty/DifficultyConfig';
import { DIRECTOR_TUNING, type DirectorSpec, type EncounterKind } from '../difficulty/DifficultyDirector';
import type { RunPlan, RunSegment } from '../core/GameEngine';
import { endlessConfig, stageLevel, type StageMode } from '../difficulty/Stages';
import type { SpellCharges, SpellId } from '../gameplay/SpellManager';

export type Mode = StageMode; // 'normal' | 'hardcore'

/** Fixed order (owner decision 2026-11-20); spells are cumulative. */
export const SPELL_ORDER: readonly SpellId[] = ['slow', 'fire', 'ice', 'barrier', 'shock', 'alter', 'wind', 'harvest'];
export const LEVELS_PER_TRIAL = 12;
export const BOSS_LEVEL = LEVELS_PER_TRIAL + 1;

export type Speaker = string;
export interface Line {
  who: Speaker;
  text: string;
}

export interface Trial {
  index: number; // 1–9
  id: string;
  spell: SpellId | null; // null for the Grandmaster's final trial
  title: string;
  master: string;
  bossName: string;
  intro: Line[];
  /** Short subtitles shown during play at these levels (never blocking). */
  hints: Partial<Record<number, Line>>;
  bossIntro: Line[];
  victory: Line[];
}

const GW = 'The Grandmaster';

export const TRIALS: readonly Trial[] = [
  {
    index: 1, id: 'slow', spell: 'slow', title: 'The Apprenticeship of Time', master: 'The Chronomancer', bossName: 'The Temporal Trial',
    intro: [
      { who: GW, text: 'Every scroll that falls is a word someone could not hold. Catch them, apprentice. The Masters will teach you how.' },
      { who: 'The Chronomancer', text: 'Time is a river. SLOW thickens it. Words drift, and your rhythm has room to breathe.' },
    ],
    hints: {
      3: { who: 'The Chronomancer', text: 'The field is gentle. Slow it anyway, and see how long your Arcane Rush lasts.' },
      7: { who: 'The Chronomancer', text: 'Faster now. Slow can buy rhythm, or it can buy your life. Choose.' },
      11: { who: 'The Chronomancer', text: 'Save a Slow for when the sky fills. You will know the moment.' },
    },
    bossIntro: [{ who: 'The Chronomancer', text: 'The Temporal Trial begins. Survive it. Time is the only ally you were given.' }],
    victory: [{ who: 'The Chronomancer', text: 'You bent time without breaking your rhythm. The next Master is waiting.' }],
  },
  {
    index: 2, id: 'fire', spell: 'fire', title: 'The Apprenticeship of Flame', master: 'Master of Flame', bossName: 'The Pyre Tide',
    intro: [{ who: 'Master of Flame', text: 'FIRE takes the low and the close. It spreads where words crowd together. It pays little, but it saves much.' }],
    hints: {
      3: { who: 'Master of Flame', text: 'When the field is calm, let words gather before you burn. A crowded fire burns farther.' },
      7: { who: 'Master of Flame', text: 'Fire spares the high scrolls. Catch what it spares and the ashes remember.' },
      11: { who: 'Master of Flame', text: 'A fire held too long is a fire wasted. Burn when the Ward cries out.' },
    },
    bossIntro: [{ who: 'Master of Flame', text: 'The Tide rises. Burn, type, burn again.' }],
    victory: [{ who: 'Master of Flame', text: 'You did not burn everything. Good. A Master burns exactly enough.' }],
  },
  {
    index: 3, id: 'ice', spell: 'ice', title: 'The Apprenticeship of Frost', master: 'Master of Frost', bossName: 'The Glacier Choir',
    intro: [{ who: 'Master of Frost', text: 'ICE stops the world, not your hands. Type perfectly while it holds, and each word builds Focus: more Combo than you thought possible.' }],
    hints: {
      3: { who: 'Master of Frost', text: 'Freeze a full field and type without a single slip. Watch your Combo leap.' },
      7: { who: 'Master of Frost', text: 'A slip in the frost breaks your Combo like glass. That is the price of Focus.' },
      11: { who: 'Master of Frost', text: 'When panic comes, Ice is a breath held. Breathe, then type.' },
    },
    bossIntro: [{ who: 'Master of Frost', text: 'The Choir sings words faster than you can read. Freeze it. Silence it.' }],
    victory: [{ who: 'Master of Frost', text: 'Precision is a kind of stillness. You have found it.' }],
  },
  {
    index: 4, id: 'barrier', spell: 'barrier', title: 'The Apprenticeship of Wards', master: 'Master of Wards', bossName: 'The Siege of Quills',
    intro: [{ who: 'Master of Wards', text: 'BARRIER raises two layers. Each stops a word at the Ward, or catches your slip before it costs you the Combo.' }],
    hints: {
      3: { who: 'Master of Wards', text: 'Raise it early and type bravely. A shield is insurance, and insurance lets you gamble.' },
      7: { who: 'Master of Wards', text: 'A slip you correct is still a slip. The layer saves your Combo, not your perfection.' },
      11: { who: 'Master of Wards', text: 'Layers are few. Spend them on the Ward when the Ward is all you have.' },
    },
    bossIntro: [{ who: 'Master of Wards', text: 'The Siege comes in waves. Hold.' }],
    victory: [{ who: 'Master of Wards', text: 'Unbroken. That is the whole lesson.' }],
  },
  {
    index: 5, id: 'shock', spell: 'shock', title: 'The Apprenticeship of Storms', master: 'Master of Storms', bossName: 'The Thunderhead',
    intro: [{ who: 'Master of Storms', text: 'SHOCK always strikes the lowest word. Then it leaps, if it can, from word to word. Crowds make storms.' }],
    hints: {
      3: { who: 'Master of Storms', text: 'Lightning cashes in your Combo. Build it high, then let the storm pay you.' },
      7: { who: 'Master of Storms', text: 'The leap is never certain. Close words are likelier. Cast where they cluster.' },
      11: { who: 'Master of Storms', text: 'Even a lone strike saves the lowest word. Remember that when it matters.' },
    },
    bossIntro: [{ who: 'Master of Storms', text: 'The Thunderhead gathers. Let it gather. Then strike.' }],
    victory: [{ who: 'Master of Storms', text: 'You gambled and you knew the odds. That is not luck. That is weather-reading.' }],
  },
  {
    index: 6, id: 'alter', spell: 'alter', title: 'The Apprenticeship of Ink', master: 'Master of Ink', bossName: 'The Unwritten Tome',
    intro: [{ who: 'Master of Ink', text: 'ALTER rewrites long words into short ones. They keep their full worth. For a while, new words come small and kind.' }],
    hints: {
      3: { who: 'Master of Ink', text: 'A long word made short is a fortune made easy. Rewrite the field and harvest the letters.' },
      7: { who: 'Master of Ink', text: 'Short words are fast words. Fast words feed your Arcane Rush.' },
      11: { who: 'Master of Ink', text: 'When the words are cruel, rewrite them. That is what ink is for.' },
    },
    bossIntro: [{ who: 'Master of Ink', text: 'The Tome writes itself. Edit it.' }],
    victory: [{ who: 'Master of Ink', text: 'You read what was written and changed it. Few apprentices dare.' }],
  },
  {
    index: 7, id: 'wind', spell: 'wind', title: 'The Apprenticeship of Winds', master: 'Master of Winds', bossName: 'The Gale Engine',
    intro: [
      { who: 'Master of Winds', text: 'Below your Ward’s full strength, WIND mends it. At full strength, Wind wagers: the Ward falls to a quarter, and for ten breaths your words are worth double.' },
      { who: 'Master of Winds', text: 'Every wager scars the Ward. Mend it, and you may wager again, from a lower peak.' },
    ],
    hints: {
      3: { who: 'Master of Winds', text: 'The field is quiet. A quiet field is the safest place to wager.' },
      7: { who: 'Master of Winds', text: 'A word through the Ward breaks the wager. Is your rhythm worth the risk?' },
      11: { who: 'Master of Winds', text: 'Scarred and pressed, Wind is a lifeline first. A Master knows which.' },
    },
    bossIntro: [{ who: 'Master of Winds', text: 'The Engine howls. Survive it, or wager everything and win it.' }],
    victory: [{ who: 'Master of Winds', text: 'Your Ward is scarred. Wear it.' }],
  },
  {
    index: 8, id: 'harvest', spell: 'harvest', title: 'The Apprenticeship of Harvest', master: 'Master of Harvest', bossName: 'The Fallow Field',
    intro: [{ who: 'Master of Harvest', text: 'HARVEST gathers every word at once, at full worth, times all your hands have earned: Combo and Arcane Rush. The Rush is spent.' }],
    hints: {
      3: { who: 'Master of Harvest', text: 'Let the field ripen. Build your Arcane Rush high. Then reap.' },
      7: { who: 'Master of Harvest', text: 'What else might multiply a harvest? Your other Masters have told you more than they meant to.' },
      11: { who: 'Master of Harvest', text: 'A harvest also clears the field. Sometimes that is all you need.' },
    },
    bossIntro: [{ who: 'Master of Harvest', text: 'The Fallow Field grows fast. Reap it.' }],
    victory: [{ who: 'Master of Harvest', text: 'You reaped what you sowed. Now go and sow more.' }],
  },
  {
    index: 9, id: 'grand', spell: null, title: 'The Final Examination', master: GW, bossName: 'The Grandmaster’s Stand',
    intro: [{ who: GW, text: 'Eight Masters have taught you. Now you face me, with everything you have learned. Use all of it.' }],
    hints: {
      3: { who: GW, text: 'Every spell has two faces. Show me both.' },
      7: { who: GW, text: 'Combine them. I did not teach you that. Neither did they. Discover it.' },
      11: { who: GW, text: 'This is the edge of your skill. Stay on it.' },
    },
    bossIntro: [{ who: GW, text: 'Stand, apprentice. Stand against me.' }],
    victory: [{ who: GW, text: 'You are an apprentice no longer.' }],
  },
];

export const learnedSpells = (trial: number): SpellId[] => SPELL_ORDER.slice(0, Math.min(8, trial));

/** Starting charges: 3 of the new spell, then 1 each of the most recent others, 8 in all. */
export function startingCharges(trial: Trial): Partial<SpellCharges> {
  const learned = learnedSpells(trial.index);
  const charges: Partial<SpellCharges> = {};
  if (trial.spell) charges[trial.spell] = 3;
  const others = learned.filter((s) => s !== trial.spell).reverse();
  let room = trial.spell ? 5 : 8;
  for (const s of others) {
    if (room-- <= 0) break;
    charges[s] = 1;
  }
  return charges;
}

/** Position on the old stage curve: trial 1 → stage 1, trial 9 → stage 5. */
const stagePosition = (trial: number) => 1 + ((trial - 1) * 4) / 8;
/** Level 1–12 maps onto old levels 1–19; the boss is old level 20. */
const sourceLevel = (level: number) => (level >= BOSS_LEVEL ? 20 : Math.round(1 + ((level - 1) * 18) / (LEVELS_PER_TRIAL - 1)));

const INTEGER_KEYS = new Set(['requiredWords', 'maxActiveWords', 'minWordLength', 'maxWordLength', 'openingWords', 'rampWords']);

function blend(a: DifficultyConfig, b: DifficultyConfig, t: number): DifficultyConfig {
  const out: Record<string, unknown> = { ...a };
  for (const [k, va] of Object.entries(a)) {
    const vb = (b as unknown as Record<string, unknown>)[k];
    if (typeof va === 'number' && typeof vb === 'number') {
      const v = va + (vb - va) * t;
      out[k] = INTEGER_KEYS.has(k) ? Math.round(v) : v;
    } else if (k === 'ramp' && va && vb && typeof va === 'object') {
      const ra = va as Record<string, number>;
      const rb = vb as Record<string, number>;
      out[k] = Object.fromEntries(Object.keys(ra).map((key) => [key, ra[key]! + (rb[key]! - ra[key]!) * t]));
    }
  }
  return out as unknown as DifficultyConfig;
}

export function trialLevel(mode: Mode, trialIndex: number, level: number): DifficultyConfig {
  const trial = TRIALS[trialIndex - 1]!;
  const pos = stagePosition(trialIndex);
  const lo = Math.floor(pos);
  const hi = Math.min(5, lo + 1);
  const L = sourceLevel(level);
  const base = blend(stageLevel(mode, lo, L), stageLevel(mode, hi, L), pos - lo);
  const boss = level >= BOSS_LEVEL;
  return {
    ...base,
    level,
    name: boss ? trial.bossName : `${trial.title} · ${level}`,
    availableSpells: learnedSpells(trialIndex),
    introducesSpell: trial.spell,
    stage: Math.round(pos),
  };
}

export function trialEndless(mode: Mode, trialIndex: number): DifficultyConfig {
  const base = endlessConfig(mode, Math.round(stagePosition(trialIndex)));
  return { ...base, name: `Endless · ${TRIALS[trialIndex - 1]!.title}`, availableSpells: learnedSpells(trialIndex), introducesSpell: null };
}

export function sandboxConfig(mode: Mode, tier: number): DifficultyConfig {
  return { ...endlessConfig(mode, tier), name: `Sandbox · Tier ${tier}`, availableSpells: [...SPELL_ORDER], introducesSpell: null };
}

// ───────────── D-102: the continuous apprenticeship ─────────────
//
// One run per apprenticeship: Phase I Learn, Phase II Master (both made of the
// old levels' quotas, now internal checkpoints the player never sees as
// screens), then Phase III, the Boss Examination. The classic per-level
// configs above remain the source of each checkpoint's supporting levers
// (quota, base spawn interval and density, spell drops, boss timer and ramp);
// the Difficulty Director owns word length, fall speed, pressure events,
// recovery and Endless growth. The classic functions stay for regression
// tests and simulation comparison only; the player sees one system.

/** EXPERIMENTAL prototype values (D-102). */
export const RUN_TUNING = {
  /** Share of the Learn + Master checkpoints that form Phase I. */
  learnShare: 0.3,
  /** Hardcore Ward recovery when a checkpoint is reached (unchanged from the level rules). */
  hardcoreRecovery: { 4: 25, 8: 25 } as Record<number, number>,
};

/** Checkpoints (old levels) in Phase I: 4 of 12 at the prototype share. */
export const LEARN_CHECKPOINTS = Math.max(1, Math.min(LEVELS_PER_TRIAL - 1, Math.round(RUN_TUNING.learnShare * LEVELS_PER_TRIAL)));
export type StartPhase = 'learn' | 'master' | 'boss';

/** Normalized apprenticeship progression: trial 1 → 0, trial 9 → 1. */
export const apprenticeshipPosition = (trialIndex: number) => (Math.min(TRIALS.length, Math.max(1, trialIndex)) - 1) / (TRIALS.length - 1);

function withDirector(classic: DifficultyConfig, mode: Mode, trialIndex: number, kind: EncounterKind): DifficultyConfig {
  const director: DirectorSpec = { version: 2, mode, apprenticeship: apprenticeshipPosition(trialIndex), kind, referenceLength: averageWordLength(classic) };
  const rest: DifficultyConfig = { ...classic };
  delete rest.wordLengthWeights;
  return {
    ...rest,
    // The director chooses lengths (soft windows with rare tails), so the generator holds every usable length.
    minWordLength: DIRECTOR_TUNING.lengths.library[0],
    maxWordLength: DIRECTOR_TUNING.lengths.library[1],
    // Within-run variation and surges come from the director's continuous model, not per-level ramps.
    spawnRamp: 0,
    speedRamp: 0,
    speedRampExtra: 0,
    surges: [],
    escalation: null,
    director,
  };
}

/** One internal checkpoint (an old level) of the continuous run. */
export function runSegmentConfig(mode: Mode, trialIndex: number, level: number): DifficultyConfig {
  const boss = level >= BOSS_LEVEL;
  return withDirector(trialLevel(mode, trialIndex, level), mode, trialIndex, boss ? 'boss' : 'run');
}

/** The whole apprenticeship as one run plan. `start` is a testing convenience (begin at Master or the boss). */
export function apprenticeshipRun(mode: Mode, trialIndex: number, start: StartPhase = 'learn'): RunPlan {
  const first = start === 'learn' ? 1 : start === 'master' ? LEARN_CHECKPOINTS + 1 : BOSS_LEVEL;
  const segments: RunSegment[] = [];
  for (let level = first; level <= BOSS_LEVEL; level++) {
    const config = runSegmentConfig(mode, trialIndex, level);
    segments.push({
      config: level === first ? config : { ...config, openingWords: 0 },
      phase: level >= BOSS_LEVEL ? 'boss' : level <= LEARN_CHECKPOINTS ? 'learn' : 'master',
      hardcoreRecovery: RUN_TUNING.hardcoreRecovery[level],
    });
  }
  return { segments, firstLevelIndex: Math.min(first, LEVELS_PER_TRIAL) - 1, levelSegments: LEVELS_PER_TRIAL };
}

/** Endless after the boss: no quota, no timer, and no permanent ceiling. */
export function apprenticeshipEndless(mode: Mode, trialIndex: number): DifficultyConfig {
  return { ...withDirector(trialEndless(mode, trialIndex), mode, trialIndex, 'endless'), rampWords: null };
}

/** Sandbox pace tiers 1–5 map onto the apprenticeship journey (tier 1 = first, tier 5 = last), played as Endless. */
export function sandboxRunConfig(mode: Mode, tier: number): DifficultyConfig {
  const trial = 1 + (Math.min(5, Math.max(1, tier)) - 1) * 2;
  return { ...withDirector(sandboxConfig(mode, tier), mode, trial, 'endless'), rampWords: null };
}

// ───────────── D-112: the spell-free opening challenge (GAME-002) ─────────────
//
// The Academy opens with a real typing examination: no spells, no spell
// scrolls, pressure that rises naturally until spells are clearly needed
// (D-107). It is finite, so a skilled typist can clear it; nothing is
// scripted to fail. It borrows the apprenticeships' own checkpoint configs
// along a rising path, so it uses the same Director, scoring and Ward rules.

/** EXPERIMENTAL prototype values (D-112): [apprenticeship, checkpoint level, words to capture]. */
export const OPENING_TUNING = {
  path: [
    [1, 1, 14], [2, 4, 12], [3, 6, 12], [5, 4, 12], [6, 6, 12], [7, 6, 13], [8, 8, 15],
  ] as ReadonlyArray<readonly [number, number, number]>,
  /** From this segment on, the HUD calls it Phase II ("the pressure deepens"). */
  masterFrom: 4,
  /**
   * D-113: the words stay near Slow's vocabulary (short and medium) while the
   * pressure, speed and density come from the later checkpoints. First → last segment.
   */
  vocabulary: [0, 0.15] as readonly [number, number],
};

export const OPENING = {
  title: 'The Opening Trial',
  short: 'Opening',
  examiner: GW,
  intro: [
    { who: GW, text: 'Before any Master teaches you, show me your hands. Type what falls. Catch it before it reaches the Ward.' },
  ] as readonly Line[],
  hints: {
    2: { who: GW, text: 'Good. Now it begins to quicken.' },
    4: { who: GW, text: 'The sky fills faster than hands alone can empty it. Remember this feeling.' },
    6: { who: GW, text: 'Hold. This is where a spell would have helped you.' },
  } as Record<number, Line>,
  passed: { who: GW, text: 'You held. Hands like that deserve tools. The Chronomancer is waiting.' } as Line,
  fell: { who: GW, text: 'The Ward fell, as it should here. Hands alone are not enough. That is what the Masters are for. The Chronomancer is waiting.' } as Line,
};

/** The whole opening challenge as one run plan, with no spells anywhere in it. */
export function openingRun(mode: Mode): RunPlan {
  const segments: RunSegment[] = OPENING_TUNING.path.map(([trial, level, words], i) => {
    const base = runSegmentConfig(mode, trial, level);
    const config: DifficultyConfig = {
      ...base,
      level: i + 1,
      name: `${OPENING.title} · ${i + 1}`,
      requiredWords: words,
      availableSpells: [],
      introducesSpell: null,
      spellDropChance: 0,
      openingWords: i === 0 ? base.openingWords : 0,
      director: base.director
        ? { ...base.director, vocabulary: OPENING_TUNING.vocabulary[0] + (OPENING_TUNING.vocabulary[1] - OPENING_TUNING.vocabulary[0]) * (i / Math.max(1, OPENING_TUNING.path.length - 1)) }
        : base.director,
    };
    return { config, phase: i >= OPENING_TUNING.masterFrom ? 'master' : 'learn' };
  });
  return { segments, firstLevelIndex: 0, levelSegments: segments.length };
}
