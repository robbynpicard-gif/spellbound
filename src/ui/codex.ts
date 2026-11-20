/**
 * The Codex: how every mechanic works, built from the game's own numbers so
 * it never drifts from play. Shown from the main menu (never during a run),
 * and exported as docs/mechanics.md.
 */
import { BOSS_SECONDS, INTRO_LEVEL, SPELL_DROP_CHANCE, SPELL_LEVEL, spellsOfStage, STAGE_COUNT, STAGE_LEVELS, STAGE_NAMES, STAGE_TUNING, SURGE_FROM_LEVEL } from '../difficulty/Stages';
import { HARDCORE_HEAL, HARDCORE_HEAL_LEVELS } from '../modes/CampaignMode';
import { OVERFLOW_POINTS, SURGE_SPAWN_FACTOR } from '../core/GameEngine';
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
    intro: 'A great score is earned through precision, rhythm and judgement. The rules can be learned; the next run cannot be predicted.',
    points: [
      'Each letter has a base value of 10 points. Your Combo and Arcane Volley multiply that value, and Wind’s All-In doubles it while it lasts.',
      'For the curious: word points are rounded once from letters × 10 × Combo × Volley × All-In. Harvest pays the whole field’s base × Combo × Volley × All-In and spends your Volley; Shock pays base × Combo × All-In. Understanding the formula is possible; sustaining its multipliers is the real challenge.',
      'Combo begins at ×1 and gains ×1 for every 10 consecutive flawless captures. A typo, wrong entry or missed word breaks the precision chain.',
      'Volley ignites after two timely flawless captures at ×1.2. Linked captures build momentum, with increasingly rare mastery beyond ×5. Longer words receive a fairer capture window.',
      'An empty field preserves the Volley window, including its one-word buildup. A returning target offers brief re-engagement grace. Enemies and spawning do not pause.',
      'Find your own balance between longer words, maintaining precision and keeping your rhythm. The game will not predict your future score for you.',
    ],
    table: {
      head: ['Scoring art', 'Strategic consideration'],
      rows: [
        ['Word value', 'More letters mean more base points'],
        ['Combo', 'Protect a flawless streak; each ten words raises its tier'],
        ['Arcane Volley', 'Two words to ignite; sustained timely captures to grow'],
        ['Field control', 'Clearing the field preserves your window until words return'],
        ['Wind All-In', 'Risk your Ward and scar its maximum for a ×2 window'],
      ],
    },
  },
  {
    title: 'Mistakes',
    points: [
      'In the current solo scoring system, a typo, wrong entry or missed word breaks the precision chain and Volley momentum.',
      'A missed word harms the ward unless blocked by Barrier. Mistakes can also make the targeted word fall faster. A Barrier layer can also absorb one corrected typo, keeping your Combo.',
      'Ward scars: each Wind All-In lowers the Ward’s maximum. Healing (Wind, Hardcore milestones) never rises above it. Normal clears scars each level; Hardcore keeps them for the stage.',
    ],
  },
  {
    title: 'Bonuses',
    intro: 'Stylish captures, Runes and Triumphs enrich the arena, but they are not extra multipliers in the current solo word-score formula.',
    points: [
      'Experiment with precision, rhythm and elemental opportunities instead of chasing a projected number.',
      'Some older Rune criteria still use historical Volley statistics and are being reconciled separately.',
    ],
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
