/**
 * The wizards you can play a Campaign run as (decisions.md D-042).
 *
 * Each wizard has a passive (always on) and a signature power. The power is
 * fired by typing a **sigil scroll**: a rare falling word in the wizard's
 * colour, like Peggle's green pegs. All wizards share the same levels and
 * spells. Pure data: the rules live in GameEngine.
 */
export type WizardId = 'apprentice' | 'archivist' | 'chronomancer' | 'pyromancer' | 'cartographer' | 'lexicant';

export const WIZARD_IDS: readonly WizardId[] = [
  'apprentice',
  'archivist',
  'chronomancer',
  'pyromancer',
  'cartographer',
  'lexicant',
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
  cartographer: {
    id: 'cartographer',
    name: 'The Cartographer',
    epithet: 'Has mapped the edge of the world. It moved.',
    passive: { name: 'Charted Course', text: 'Words fall in 5 neat lanes, so the field is easy to read.' },
    power: { name: 'Compass Rose', text: 'For 6 seconds, capturing a word also captures every word in its lane.' },
    color: 0xd8b860,
  },
  lexicant: {
    id: 'lexicant',
    name: 'The Lexicant',
    epithet: 'Knows every word. Uses the wrong ones.',
    passive: { name: 'Fluent', text: 'Typos never speed words up or cost the Perfect bonus.' },
    power: { name: 'Malapropism', text: 'Every word on screen becomes the same short word: one Enter captures them all.' },
    color: 0xe25cc4,
  },
};

/**
 * The journey (D-044): chapter 1 is played in the wizard's own domain, then
 * every run sets out through the same three chapters into the darkness.
 */
export interface Domain {
  name: string;
  /** Names of chapter 1's five levels (the fifth is its boss). */
  levels: readonly [string, string, string, string, string];
  /** Backdrop art key suffix ('' = the original tower study). */
  art: string;
}

export const DOMAINS: Record<WizardId, Domain> = {
  apprentice: { name: 'The Tower Study', levels: ['The First Ward', 'Candlelight Study', 'Whispering Stacks', 'The Spiral Stair', 'The Bell Tower'], art: '' },
  archivist: { name: 'The Endless Stacks', levels: ['The Reading Room', 'The Card Catalogue', 'Restricted Section', 'The Long Gallery', 'The Last Copy'], art: 'archivist' },
  chronomancer: { name: 'The Clock Loft', levels: ['The Pendulum Hall', 'The Gear Garden', 'The Escapement', 'Hour Hand Bridge', 'The Stopped Bell'], art: 'chronomancer' },
  pyromancer: { name: 'The Kiln', levels: ['The Ash Hearth', 'The Bellows Room', 'The Glassworks', 'The Cinder Stair', 'The Furnace Heart'], art: 'pyromancer' },
  cartographer: { name: 'The Map Room', levels: ['The Drafting Table', 'The Globe Gallery', 'Uncharted Margins', 'The Compass Stair', 'Here Be Dragons'], art: 'cartographer' },
  lexicant: { name: 'The Scriptorium', levels: ['The Inkwell', 'Margin Notes', 'The Errata Hall', 'The Lexicon Stair', 'The Unspeakable Word'], art: 'lexicant' },
};

/** The road out of the domain, chapter by chapter (chapter 1 = the domain). */
export const JOURNEY: readonly string[] = ['', 'The Drowned Archive', 'The Ember Depths', "The Storm's Edge"];

export function chapterName(wizard: WizardId | null, chapter: number): string {
  if (chapter <= 1) return wizard ? DOMAINS[wizard].name : DOMAINS.apprentice.name;
  return JOURNEY[Math.min(JOURNEY.length - 1, chapter - 1)]!;
}

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
export const LANES = 5;
export const COMPASS_MS = 6000;
/** Malapropism: how long matching words keep echoing each other's capture. */
export const MALAPROPISM_MS = 3000;
