import type { WizardId } from './Wizards';

/**
 * Cosmetic unlocks (decisions.md D-043), in the spirit of Peggle 2's master
 * outfits: every wizard has their own track. Playing a wizard earns mastery
 * (1 XP per point scored in a Campaign run with them); each mastery level
 * unlocks one item, and three feats of skill unlock more. Nothing is bought,
 * nothing is random, and every requirement is visible from the start.
 * Cosmetics never change the rules.
 */
export type Slot = 'outfit' | 'familiar' | 'flourish' | 'sigil' | 'ink' | 'title';
export const SLOTS: readonly Slot[] = ['outfit', 'familiar', 'flourish', 'sigil', 'ink', 'title'];

export const SLOT_NAMES: Record<Slot, string> = {
  outfit: 'Outfit',
  familiar: 'Familiar',
  flourish: 'Capture flourish',
  sigil: 'Sigil rune',
  ink: 'Ink',
  title: 'Title',
};

export type FeatId = 'flawless' | 'decuple' | 'champion';
export const FEATS: Record<FeatId, string> = {
  flawless: 'Win a level with no misses and no typos',
  decuple: 'Reach the ×10 multiplier',
  champion: 'Clear the whole Campaign',
};

export interface Cosmetic {
  /** Unique within its wizard and slot. */
  id: string;
  slot: Slot;
  name: string;
  /** Mastery level that unlocks it (1 = from the start), or a feat. */
  unlock: number | FeatId;
  /** outfit: sprite look ('a' | 'b' | 'c'); familiar: frame row; ink: colour; others: effect id. */
  value: string | number;
}

/** Total mastery XP needed for each level (index 0 = level 1). */
export const MASTERY_XP = [0, 1500, 4000, 8000, 13000, 20000, 29000, 40000, 54000, 70000];
export const MAX_MASTERY = MASTERY_XP.length;

/** Familiar sprite rows in public/assets/art/familiars.png (tools/pixelart/v5/familiars.py). */
export const FAMILIAR_ROWS = ['toad', 'star', 'bookworm', 'moth', 'beetle', 'ticktock', 'salamander', 'phoenix', 'mouse', 'crane', 'inkblot', 'parrot'];

type Track = [
  outfitA: string, outfitB: string, outfitC: string,
  familiar1: [string, string], familiar2: [string, string],
  flourish1: [string, string], flourishFeat: [string, string],
  sigil1: [string, string], sigilFeat: [string, string],
  ink: [string, string],
  title1: string, title2: string, titleFeat: string,
];

/** [name, effect id] pairs; familiars are [name, row id]. */
const TRACKS: Record<WizardId, Track> = {
  apprentice: [
    'Novice Robes', 'Candlelit', 'Archmage-in-Waiting',
    ['Toad', 'toad'], ['Wishing Star', 'star'],
    ['Starfall', 'stars'], ['Confetti', 'confetti'],
    ['Star', 'star'], ['Crescent', 'moon'],
    ['Sky Blue', '#5ad0f0'],
    'Promising', 'Late Bloomer', 'Actually Quite Good',
  ],
  archivist: [
    'Reading Robes', 'Night Shift', 'Crimson Index',
    ['Bookworm', 'bookworm'], ['Library Moth', 'moth'],
    ['Loose Letters', 'letters'], ['Old Dust', 'dust'],
    ['Open Book', 'book'], ['Skeleton Key', 'key'],
    ['Sepia', '#a8784a'],
    'Footnoted', 'Overdue', 'Keeper of the Last Copy',
  ],
  chronomancer: [
    'Midnight Coat', 'Pendulum', 'Bronze Hour',
    ['Clockwork Beetle', 'beetle'], ['Tick-Tock Bird', 'ticktock'],
    ['Gearwork', 'gears'], ['Falling Sand', 'sand'],
    ['Hourglass', 'hourglass'], ['Spiral', 'spiral'],
    ['Verdigris', '#4ab8a0'],
    'Punctual', 'Fashionably Late', 'Ahead of Their Time',
  ],
  pyromancer: [
    'Ember Robes', 'Soot', 'Molten',
    ['Salamander', 'salamander'], ['Phoenix Chick', 'phoenix'],
    ['Embers', 'embers'], ['Fireworks', 'fireworks'],
    ['Flame', 'flame'], ['Sun', 'sun'],
    ['Cinder', '#ff7a30'],
    'Kindler', 'Ash-Speaker', 'Who Set the Library on Fire',
  ],
  cartographer: [
    'Field Coat', 'Sea Chart', 'Star Atlas',
    ['Compass Mouse', 'mouse'], ['Paper Crane', 'crane'],
    ['Paper Birds', 'paper'], ['Compass Points', 'compass'],
    ['Compass', 'compass'], ['X Marks the Spot', 'cross'],
    ['Sea Blue', '#3a8ad8'],
    'Wayfinder', 'Lost (Professionally)', 'Here Be Dragons',
  ],
  lexicant: [
    'Ink-Stained', 'Proofreader', 'Errata',
    ['Inkblot', 'inkblot'], ['Parrot', 'parrot'],
    ['Alphabet Soup', 'letters'], ['Ink Splash', 'ink'],
    ['Quill', 'quill'], ['All-Seeing Eye', 'eye'],
    ['Magenta', '#ff5ad0'],
    'Verbose', 'Malaprop', 'Lexicographer Extraordinaire',
  ],
};

/** Every cosmetic for a wizard, in track order (mastery levels, then feats). */
export function cosmeticsFor(wizard: WizardId): Cosmetic[] {
  const [oa, ob, oc, f1, f2, fl1, flF, s1, sF, ink, t1, t2, tF] = TRACKS[wizard];
  const item = (slot: Slot, id: string, name: string, unlock: Cosmetic['unlock'], value: string | number): Cosmetic => ({ id, slot, name, unlock, value });
  return [
    // Starters
    item('outfit', 'a', oa, 1, 'a'),
    item('familiar', 'none', 'None', 1, ''),
    item('flourish', 'sparks', 'Sparks', 1, 'sparks'),
    item('sigil', 'diamond', 'Diamond', 1, 'diamond'),
    item('ink', 'default', 'Rose', 1, ''),
    item('title', 'none', 'No title', 1, ''),
    // The mastery track: one unlock per level
    item('title', 't1', t1, 2, t1),
    item('flourish', fl1[1], fl1[0], 3, fl1[1]),
    item('familiar', f1[1], f1[0], 4, FAMILIAR_ROWS.indexOf(f1[1])),
    item('ink', 'ink', ink[0], 5, ink[1]),
    item('outfit', 'b', ob, 6, 'b'),
    item('sigil', s1[1], s1[0], 7, s1[1]),
    item('title', 't2', t2, 8, t2),
    item('familiar', f2[1], f2[0], 9, FAMILIAR_ROWS.indexOf(f2[1])),
    item('outfit', 'c', oc, 10, 'c'),
    // Feats
    item('sigil', sF[1], sF[0], 'flawless', sF[1]),
    item('flourish', flF[1], flF[0], 'decuple', flF[1]),
    item('title', 'tF', tF, 'champion', tF),
  ];
}

/** What a player has earned with one wizard, and what they wear. */
export interface WardrobeEntry {
  xp: number;
  feats: FeatId[];
  equipped: Partial<Record<Slot, string>>;
}

export function emptyWardrobeEntry(): WardrobeEntry {
  return { xp: 0, feats: [], equipped: {} };
}

/** Mastery level (1–MAX_MASTERY) for an XP total. */
export function masteryLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < MASTERY_XP.length; i++) if (xp >= MASTERY_XP[i]!) level = i + 1;
  return level;
}

/** Progress toward the next mastery level: [xp into this level, xp this level needs] (null at max). */
export function masteryProgress(xp: number): [number, number] | null {
  const level = masteryLevel(xp);
  if (level >= MAX_MASTERY) return null;
  const from = MASTERY_XP[level - 1]!;
  return [xp - from, MASTERY_XP[level]! - from];
}

export function isUnlocked(item: Cosmetic, entry: Readonly<WardrobeEntry>): boolean {
  return typeof item.unlock === 'number' ? masteryLevel(entry.xp) >= item.unlock : entry.feats.includes(item.unlock);
}

/** The item worn in a slot (the starter when nothing valid is equipped). */
export function equipped(wizard: WizardId, entry: Readonly<WardrobeEntry>, slot: Slot): Cosmetic {
  const items = cosmeticsFor(wizard).filter((c) => c.slot === slot);
  const chosen = items.find((c) => c.id === entry.equipped[slot]);
  return chosen && isUnlocked(chosen, entry) ? chosen : items[0]!;
}

/** Everything a wizard is wearing, as the game needs it. */
export interface Loadout {
  outfit: string;
  /** Familiar sprite row, or -1 for none. */
  familiar: number;
  flourish: string;
  sigil: string;
  /** Typed-letter colour, or '' for the default. */
  ink: string;
  title: string;
}

export function loadout(wizard: WizardId, entry: Readonly<WardrobeEntry>): Loadout {
  const v = (slot: Slot) => equipped(wizard, entry, slot).value;
  const familiar = v('familiar');
  return {
    outfit: String(v('outfit')),
    familiar: typeof familiar === 'number' ? familiar : -1,
    flourish: String(v('flourish')),
    sigil: String(v('sigil')),
    ink: String(v('ink')),
    title: String(v('title')),
  };
}

/**
 * Adds a finished Campaign level to a wizard's mastery. Mutates `entry`.
 * Returns the items this unlocked (to announce them).
 */
export function awardMastery(
  wizard: WizardId,
  entry: WardrobeEntry,
  earned: { xp: number; feats: FeatId[] },
): Cosmetic[] {
  const before = cosmeticsFor(wizard).filter((c) => isUnlocked(c, entry));
  entry.xp += Math.max(0, Math.round(earned.xp));
  for (const f of earned.feats) if (!entry.feats.includes(f)) entry.feats.push(f);
  return cosmeticsFor(wizard).filter((c) => isUnlocked(c, entry) && !before.includes(c) && !before.some((b) => b.slot === c.slot && b.id === c.id));
}

/** Feats a finished level earns. */
export function featsFrom(stats: { missed: number; errors: number; peakMultiplier: number }, won: boolean, campaignCleared: boolean): FeatId[] {
  const out: FeatId[] = [];
  if (won && stats.missed === 0 && stats.errors === 0) out.push('flawless');
  if (stats.peakMultiplier >= 10) out.push('decuple');
  if (campaignCleared) out.push('champion');
  return out;
}

export function unlockText(item: Cosmetic): string {
  return typeof item.unlock === 'number' ? `Mastery ${item.unlock}` : FEATS[item.unlock];
}
