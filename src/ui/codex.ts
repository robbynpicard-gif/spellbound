/**
 * The Codex: how every mechanic works, built from the game's own numbers so
 * it never drifts from play. Shown from the main menu (never during a run),
 * and exported as docs/mechanics.md.
 */
import { BOSS_SECONDS, INTRO_LEVEL, SPELL_DROP_CHANCE, SPELL_LEVEL, spellsOfStage, STAGE_COUNT, STAGE_LEVELS, STAGE_NAMES, STAGE_TUNING, SURGE_FROM_LEVEL } from '../difficulty/Stages';
import { HARDCORE_HEAL, HARDCORE_HEAL_LEVELS } from '../modes/CampaignMode';
import { OVERFLOW_POINTS, SURGE_SPAWN_FACTOR } from '../core/GameEngine';
import { SCORING, STREAK_MILESTONES, TIERS } from '../gameplay/ScoringSystem';
import { POOL_GROWTH, SPELL_POOL_SIZE } from '../gameplay/SpellManager';
import { SPELLS } from '../spells/SpellRegistry';

export interface CodexSection {
  title: string;
  intro?: string;
  points?: string[];
  table?: { head: string[]; rows: (string | number)[][] };
  /** A second table, if any. */
  table2?: { head: string[]; rows: (string | number)[][] };
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const DISCOVERY = [1, 2, 3, 4, 5].flatMap((s) => {
  const o = spellsOfStage(s);
  return [
    o.atLevel2 && [s, `Level ${INTRO_LEVEL}`, SPELLS[o.atLevel2].book],
    o.atLevel10 && [s, `Level ${SPELL_LEVEL}`, SPELLS[o.atLevel10].book],
    o.fromBoss && [s, 'Beat the boss (usable next stage)', SPELLS[o.fromBoss].book],
  ].filter(Boolean) as (string | number)[][];
});

export const CODEX: CodexSection[] = [
  {
    title: 'The basics',
    points: [
      'Words fall toward your ward. Type a word and press Enter to capture it. Typing picks the word that matches; Enter finishes it.',
      'A word that reaches the ward damages it (adds instability). At 100% instability the run is over.',
      `Ward damage per missed word: Normal ${STAGE_TUNING.normal.instabilityPerMiss.join('/')}% and Hardcore ${STAGE_TUNING.hardcore.instabilityPerMiss.join('/')}% (stages 1–5).`,
      `Normal restores the ward at the start of every level. Hardcore carries damage through the stage, heals ${HARDCORE_HEAL}% after levels ${HARDCORE_HEAL_LEVELS.join(', ')}, and starts each stage full.`,
      'Typos and wrong Enters make the word you were aiming at fall faster.',
      'Words still falling when you clear a level stay where they are for the next level, so you can read the field before it restarts.',
      'A captured word is swept to the desk, where its points and bonuses are read out, so nothing is written over the words still falling.',
    ],
  },
  {
    title: 'Stages and pace',
    points: [
      `${STAGE_COUNT} stages per mode, each a run of ${STAGE_LEVELS} levels. Levels 1–${STAGE_LEVELS - 1}: capture a set number of words. Level ${STAGE_LEVELS}: the boss — survive the timer (${BOSS_SECONDS.join('/')} s by stage) while the pace ramps up. Falling restarts the stage.`,
      'Each level opens with a few words already falling, then builds: words fall faster and arrive more often as you near the goal, more sharply later in the stage.',
      `Surges (from level ${SURGE_FROM_LEVEL}): short bursts where words arrive ${Math.round((1 / SURGE_SPAWN_FACTOR) * 10) / 10}× as often. One per level up to level 12, two from level 13, three in each boss.`,
      'When a boss timer runs out no more words come: clear what is still falling to finish. The win is already safe, so a late miss cannot end the run.',
      'Beat a boss to open the next stage, and to play Endless mode — the stage’s finishing pace, climbing with every word, with a best score kept per stage.',
    ],
    table: {
      head: ['Pace (in-game WPM)', 'Start', ...STAGE_NAMES.map((_, i) => `Stage ${i + 1}`)],
      rows: [
        ['Normal', STAGE_TUNING.normal.startWpm, ...STAGE_TUNING.normal.targetWpm],
        ['Hardcore', STAGE_TUNING.hardcore.startWpm, ...STAGE_TUNING.hardcore.targetWpm],
      ],
    },
  },
  {
    title: 'Spells',
    points: [
      `About ${pct(SPELL_DROP_CHANCE)} of words carry a spell scroll (coloured, with an icon). Capture the word to gain one charge.`,
      `All spells share one pool that starts at ${SPELL_POOL_SIZE} charges. Claiming a scroll with a full pool fizzles it for ${OVERFLOW_POINTS} × your combo multiplier points instead.`,
      `Typing accurately widens the pool: ${POOL_GROWTH.filter((g) => g.at > 0).map((g) => `${g.size} at ${g.at} clean`).join(', ')}. A missed word or a wrong Enter drops it back to ${SPELL_POOL_SIZE} and anything that no longer fits is lost. A corrected typo costs nothing.`,
      'Normal: cast with the number keys 1–8 (set them in the Spellbook), or type the spell’s name and press Enter. Hardcore: type the name and press Enter.',
      'No falling word is a spell name, and only the exact name casts.',
    ],
    table: {
      head: ['Spell (type this)', 'What it does'],
      rows: Object.values(SPELLS).map((s) => [s.book, s.description]),
    },
    table2: { head: ['Stage', 'When', 'New spell'], rows: DISCOVERY },
  },
  {
    title: 'Scoring',
    intro: `Word score = (${SCORING.pointsPerLetter} × letters × (1 + bonus %) + flat bonus) × combo multiplier × Clean Streak multiplier.`,
    points: [
      'Combo: +1 for every word captured. Score, combo and Clean Streak carry across all 20 levels of a stage.',
      'Clean Streak: words captured in a row without a single typo.',
    ],
    table: { head: ['Combo', 'Multiplier'], rows: TIERS.map((t, i) => [`${t.at}${TIERS[i + 1] ? `–${TIERS[i + 1]!.at - 1}` : '+'}`, `×${t.mult}`]) },
    table2: { head: ['Clean Streak', 'Multiplier'], rows: STREAK_MILESTONES.map((m) => [`${m.at}+`, `×${m.multiplier}`]) },
  },
  {
    title: 'Mistakes',
    table: {
      head: ['Mistake', 'Combo', 'Clean Streak', 'Also'],
      rows: [
        ['Typo (even if fixed)', 'Kept', 'Back one milestone', 'That word falls faster'],
        ['Wrong Enter', 'Down one tier', 'Reset to 0', 'The word you meant falls faster'],
        ['Missed word', 'Reset to 0', 'Reset to 0', 'Ward damage'],
        ['Word stopped by Barrier', 'Kept', 'Kept', 'No damage'],
      ],
    },
  },
  {
    title: 'Bonuses',
    intro: 'Each captured word can earn bonuses; their percentages add together before the multipliers.',
    table: {
      head: ['Bonus', 'How to earn it', 'Worth'],
      rows: [
        ['Perfect', 'No typos on the word', '+25%'],
        ['Quick', 'Capture it in the top 30% of the field', '+20%'],
        ['Clutch', 'Capture it in the last 15% before the ward', '+50%'],
        ['Arcane', 'A hard word (rare letters, clusters)', '+15% per point, up to +60%'],
        ['Long', 'A word of 9+ letters', '+20%'],
        ['Name', 'A proper name', '+30%'],
        ['Volley', 'Captures within 2 s of each other', '+10% per link, up to +50%'],
        ['Alliteration', 'Captures in a row with the same first letter', '+15% per link, up to +60%'],
        ['Librarian', 'Captures in alphabetical order', '+10% per link, up to +50%'],
        ['Metronome', '16 keystrokes in a very even rhythm', '+15%'],
        ['Clean Sweep', 'Empty the screen after 3+ captures', '+100 points (× multipliers)'],
      ],
    },
    table2: {
      head: ['End of level', 'How to earn it', 'Worth'],
      rows: [
        ['Flawless', 'No words missed', '+25% of the level’s points'],
        ['Under Par', 'Finish the level quickly', '+15% of the level’s points'],
        ['Comeback', 'Win after the ward fell to 25% or less', '+20% of the level’s points'],
      ],
    },
  },
];

/** The Codex as Markdown, for export. */
export function codexMarkdown(): string {
  const table = (t: { head: string[]; rows: (string | number)[][] }) =>
    [`| ${t.head.join(' | ')} |`, `|${t.head.map(() => '---').join('|')}|`, ...t.rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
  return CODEX.map((s) =>
    [`## ${s.title}`, s.intro, s.points?.map((p) => `- ${p}`).join('\n'), s.table && table(s.table), s.table2 && table(s.table2)].filter(Boolean).join('\n\n'),
  ).join('\n\n');
}
