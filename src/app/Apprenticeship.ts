/**
 * Wind Master apprenticeship: a small, skippable vertical slice (D-083/D-084).
 *
 * PLACEHOLDER: mentor names, lines and lesson tuning are prototype stand-ins,
 * not canon. Lessons never touch Campaign progress, records or Runes; only
 * lesson completion is stored, under its own key.
 */
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { endlessConfig, stageLevel } from '../difficulty/Stages';
import type { GameStats } from '../gameplay/ScoringSystem';
import { SPELL_IDS, type SpellCharges, type SpellId } from '../gameplay/SpellManager';

export type Speaker = 'Grand Wizard' | 'Wind Master';

export interface Line {
  speaker: Speaker;
  text: string;
}

export interface Lesson {
  id: string;
  title: string;
  /** Shown before the encounter. Kept short: two or three lines. */
  intro: Line[];
  hardcore: boolean;
  spells: Partial<SpellCharges>;
  /** Ward damage already taken when the lesson starts (0 = full Ward). */
  startInstability: number;
  config: () => DifficultyConfig;
  /** Mentor response after a win. Discovery is recognized, never required. */
  debrief(stats: GameStats): Line[];
}

const WIND_SPELLS: SpellId[] = ['wind', 'harvest', 'barrier', 'slow'];

function lessonConfig(stage: number, level: number, patch: Partial<DifficultyConfig>): DifficultyConfig {
  return { ...stageLevel('normal', stage, level), introducesSpell: null, ...patch };
}

const found = (s: GameStats) => (s.allInHarvests ?? 0) > 0;

export const LESSONS: readonly Lesson[] = [
  {
    id: 'mend',
    title: 'Mending Air',
    intro: [
      { speaker: 'Grand Wizard', text: 'Apprentice. The Wind Master has agreed to train you. Listen to her, but trust your own hands.' },
      { speaker: 'Wind Master', text: 'Your Ward is already torn. Type WIND and press Enter, or use its number key, and feel it close.' },
    ],
    hardcore: false,
    spells: { wind: 2 },
    startInstability: 60,
    config: () => lessonConfig(1, 8, { requiredWords: 15, availableSpells: ['wind'], spellDropChance: 0.08 }),
    debrief: (s) => [
      (s.spellsCast?.wind ?? 0) > 0
        ? { speaker: 'Wind Master', text: 'Good. Wind mends what is torn, and it calms words your mistakes have hurried. That is its gentle side.' }
        : { speaker: 'Wind Master', text: 'You survived without me. Next time, try the Wind when the Ward is low.' },
    ],
  },
  {
    id: 'all-in',
    title: 'All In',
    intro: [
      { speaker: 'Wind Master', text: 'Wind cast at a whole Ward does not mend. It wagers. Your Ward falls to a quarter, and for ten breaths every word is worth double.' },
      { speaker: 'Wind Master', text: 'The wager leaves a scar. Wind can mend you again, but only up to the scar. Let a word through and the wager breaks.' },
    ],
    hardcore: false,
    spells: { wind: 3, harvest: 1 },
    startInstability: 0,
    config: () => lessonConfig(2, 6, { requiredWords: 20, availableSpells: ['wind'], spellDropChance: 0.08 }),
    debrief: (s) => {
      const lines: Line[] = [
        (s.allInWagers ?? 0) > 0
          ? { speaker: 'Wind Master', text: `You went All-In ${s.allInWagers} time${s.allInWagers === 1 ? '' : 's'} and earned ${s.allInPoints ?? 0} points inside the wind. Feel the scar? Each wager costs more.` }
          : { speaker: 'Wind Master', text: 'You never wagered. Cast Wind while your Ward is whole, then type fast and true.' },
      ];
      if (found(s)) lines.push({ speaker: 'Grand Wizard', text: 'A Harvest inside the wind, untaught. The Wind Master will pretend she is not impressed.' });
      return lines;
    },
  },
  {
    id: 'carry',
    title: 'What the Wind Carries',
    intro: [{ speaker: 'Wind Master', text: 'Harvest gathers every word at once, with what your hands have earned. What the wind might do to a harvest, I leave to you.' }],
    hardcore: false,
    spells: { wind: 2, harvest: 2, slow: 1 },
    startInstability: 0,
    config: () => lessonConfig(2, 12, { requiredWords: 28, availableSpells: ['wind', 'harvest', 'slow'], spellDropChance: 0.1 }),
    debrief: (s) =>
      found(s)
        ? [{ speaker: 'Wind Master', text: 'You found it yourself. A harvest gathered in the wind is worth twice as much, and your Volley is spent either way. Choose the moment.' }]
        : [{ speaker: 'Wind Master', text: 'A good gathering. But a harvest made while the wind is high… try it, and watch the number.' }],
  },
  {
    id: 'scarred',
    title: 'The Scarred Ward',
    intro: [
      { speaker: 'Wind Master', text: 'Your test. Hardcore rules: spells are typed, and any slip breaks a wager. Survive, and wager as often as you dare.' },
      { speaker: 'Grand Wizard', text: 'A scarred Ward is not a failure, apprentice. It is a receipt.' },
    ],
    hardcore: true,
    spells: { wind: 4, harvest: 2, barrier: 1 },
    startInstability: 0,
    config: () =>
      lessonConfig(2, 14, { requiredWords: null, survivalMs: 75_000, availableSpells: ['wind', 'harvest', 'barrier'], spellDropChance: 0.1 }),
    debrief: (s) => [
      (s.allInWagers ?? 0) >= 2
        ? { speaker: 'Wind Master', text: `Mastered: ${s.allInWagers} wagers, ${s.allInPoints ?? 0} points in the wind, and you are still standing.` }
        : { speaker: 'Wind Master', text: 'You survived. Mastery is surviving while wagering twice or more. Return when you are braver.' },
      { speaker: 'Grand Wizard', text: 'That is the end of this course. Other masters are waiting.' },
    ],
  },
];

// ───────────────────────── progress (lesson completion only) ─────────────────────────

const KEY = 'typel.apprenticeship.v1';

export function loadLessonProgress(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markLessonDone(id: string): void {
  const done = loadLessonProgress();
  done.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {
    /* storage unavailable: progress lasts this session */
  }
}

// ───────────────────────── sandbox ─────────────────────────

/** Generous charges for deliberate interaction tests. EXPERIMENTAL, sandbox only. */
export const SANDBOX_CHARGES: Partial<SpellCharges> = { wind: 6, harvest: 4, shock: 4, ice: 4, slow: 4, barrier: 3, alter: 2, fire: 2 };
export const SANDBOX_POOL = 40;

export function sandboxConfig(mode: 'normal' | 'hardcore', stage: number): DifficultyConfig {
  return { ...endlessConfig(mode, stage), name: `Spell Sandbox · Stage ${stage}`, availableSpells: [...SPELL_IDS], introducesSpell: null };
}

export const LESSON_SPELLS = WIND_SPELLS;
