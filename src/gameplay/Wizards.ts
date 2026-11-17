/**
 * The wizards you can play a Campaign run as (decisions.md D-042).
 *
 * Each wizard has a passive (always on) and a signature power. The power is
 * fired by typing a **sigil scroll**: a rare falling word in the wizard's
 * colour, like Peggle's green pegs. All wizards share the same levels and
 * spells. Pure data: the rules live in GameEngine.
 */
export type WizardId = 'apprentice' | 'archivist' | 'chronomancer' | 'pyromancer' | 'hedgewitch' | 'warden';

export const WIZARD_IDS: readonly WizardId[] = [
  'apprentice',
  'archivist',
  'chronomancer',
  'pyromancer',
  'hedgewitch',
  'warden',
];

export interface WizardDef {
  id: WizardId;
  name: string;
  /** One line under the name. */
  epithet: string;
  passive: { name: string; text: string };
  power: { name: string; text: string };
  /** Sigil scrolls and the wizard's highlights. */
  color: number;
}

export const WIZARDS: Record<WizardId, WizardDef> = {
  apprentice: {
    id: 'apprentice',
    name: 'The Apprentice',
    epithet: 'Eager, untested, surprisingly lucky.',
    passive: { name: 'Fresh Start', text: 'No passive. The game as it was meant to be played.' },
    power: { name: 'Second Wind', text: 'For 8 seconds, captures score double and a miss cannot break your combo.' },
    color: 0xe0b050,
  },
  archivist: {
    id: 'archivist',
    name: 'The Archivist',
    epithet: 'Has read every word. Twice.',
    passive: { name: 'Well Read', text: 'Long words (9+ letters) fall 15% slower.' },
    power: { name: 'Recall', text: 'For 8 seconds, the first 3 letters + Enter capture a word, if only one word starts that way.' },
    color: 0x8fb8e0,
  },
  chronomancer: {
    id: 'chronomancer',
    name: 'The Chronomancer',
    epithet: 'Late for everything, on purpose.',
    passive: { name: 'Borrowed Time', text: 'A miss drops your multiplier one tier instead of resetting the combo.' },
    power: { name: 'Rewind', text: 'Undoes your last miss (ward damage and combo) and pushes every word back up.' },
    color: 0x60d0c0,
  },
  pyromancer: {
    id: 'pyromancer',
    name: 'The Pyromancer',
    epithet: 'Banned from three libraries.',
    passive: { name: 'Hot Hands', text: 'All points +20%, but the ward takes 20% more damage.' },
    power: { name: 'Kindle', text: 'Your next 4 captures each set the nearest word alight, capturing it for half points.' },
    color: 0xff7838,
  },
  hedgewitch: {
    id: 'hedgewitch',
    name: 'The Hedge Witch',
    epithet: 'Grows things in the margins.',
    passive: { name: 'Green Thumb', text: 'Spell scrolls appear 50% more often.' },
    power: { name: 'Overgrowth', text: 'Vines catch the 3 lowest words and hold them in place for 6 seconds.' },
    color: 0x78c860,
  },
  warden: {
    id: 'warden',
    name: 'The Warden',
    epithet: 'Has never once been asked to leave.',
    passive: { name: 'Standing Guard', text: 'Every level starts with one Barrier block.' },
    power: { name: 'Bastion', text: 'For 6 seconds the ward takes no damage and misses keep your combo, but points are halved.' },
    color: 0xc0c8d8,
  },
};

export function isWizardId(value: unknown): value is WizardId {
  return typeof value === 'string' && (WIZARD_IDS as readonly string[]).includes(value);
}

// ── tuning (engine reads these) ──

/** Chance a new word carries a sigil (no sigil on the field and no power running). */
export const SIGIL_CHANCE = 0.07;
/** Captures needed in a level before the first sigil can appear. */
export const SIGIL_AFTER = 4;
export const SECOND_WIND_MS = 8000;
export const RECALL_MS = 8000;
export const RECALL_LETTERS = 3;
export const REWIND_LIFT = 0.15;
export const ARCHIVIST_LONG_FROM = 9;
export const ARCHIVIST_SLOW = 0.85;
export const PYRO_SCORE = 1.2;
export const PYRO_DAMAGE = 1.2;
export const KINDLE_CHARGES = 4;
export const WITCH_DROP = 1.5;
export const OVERGROWTH_WORDS = 3;
export const OVERGROWTH_MS = 6000;
export const BASTION_MS = 6000;
