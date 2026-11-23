/**
 * Spell ids in the canonical Academy order (D-115): the order the
 * apprenticeships teach them. It is a curriculum, not a power ranking. The id
 * is the cast word: type it and press Enter to cast.
 */
export const SPELL_IDS = ['slow', 'barrier', 'wind', 'fire', 'ice', 'shock', 'alter', 'harvest'] as const;
export type SpellId = (typeof SPELL_IDS)[number];

export type SpellCharges = Record<SpellId, number>;

/**
 * All spells share one pool of charges. There is no per-spell limit; how
 * often each spell drops (its drop weight) is what keeps strong spells rare.
 */
export const SPELL_POOL_SIZE = 8;

/**
 * D-115 candidate per-spell caps (EXPERIMENTAL, not approved balance). Off by
 * default: the shared bank is the testing baseline. Turn on to test stockpiling.
 */
export const SPELL_CAP_CANDIDATES: Readonly<SpellCharges> = { slow: 4, barrier: 2, wind: 2, fire: 3, ice: 2, shock: 2, alter: 2, harvest: 1 };

/**
 * Mana pool growth (D-057): typing accurately widens the pool, so a clean run
 * banks more spells. A missed word or a wrong Enter drops it back to the base
 * size and anything that no longer fits is lost. A corrected typo costs nothing.
 */
export const POOL_GROWTH: readonly { at: number; size: number }[] = [
  { at: 0, size: SPELL_POOL_SIZE },
  { at: 25, size: 9 },
  { at: 50, size: 10 },
  { at: 100, size: 11 },
  { at: 200, size: 12 },
];
export const MAX_POOL_SIZE = POOL_GROWTH.at(-1)!.size;

/** How many charges fit after `streak` clean captures in a row. */
export function poolSizeFor(streak: number): number {
  let size = SPELL_POOL_SIZE;
  for (const step of POOL_GROWTH) if (streak >= step.at) size = step.size;
  return size;
}

/** Drops charges until they fit `limit`, taking from the fullest spell first. Returns how many were lost. */
export function trimToPool(charges: SpellCharges, limit: number): number {
  let lost = 0;
  while (totalCharges(charges) > limit) {
    let fullest: SpellId = SPELL_IDS[0]!;
    for (const id of SPELL_IDS) if (charges[id] > charges[fullest]) fullest = id;
    if (charges[fullest] === 0) break;
    charges[fullest]--;
    lost++;
  }
  return lost;
}

export function isSpellId(value: unknown): value is SpellId {
  return typeof value === 'string' && (SPELL_IDS as readonly string[]).includes(value);
}

export function emptyCharges(): SpellCharges {
  return { slow: 0, ice: 0, barrier: 0, shock: 0, alter: 0, fire: 0, wind: 0, harvest: 0 };
}

/** Charges held across all spells. */
export function totalCharges(charges: Readonly<SpellCharges>): number {
  let total = 0;
  for (const id of SPELL_IDS) total += charges[id];
  return total;
}

/** True when no more charges fit in the pool. */
export function poolFull(charges: Readonly<SpellCharges>, limit: number = SPELL_POOL_SIZE): boolean {
  return totalCharges(charges) >= limit;
}

/**
 * Normalises a possibly partial/invalid charge table: whole, non-negative
 * numbers for every spell, trimmed (from the strongest spell down) to fit the pool.
 */
export function sanitizeCharges(input?: Partial<Record<string, unknown>>): SpellCharges {
  const charges = emptyCharges();
  for (const id of SPELL_IDS) {
    const value = input?.[id];
    if (typeof value === 'number' && Number.isFinite(value)) charges[id] = Math.max(0, Math.floor(value));
  }
  let excess = totalCharges(charges) - MAX_POOL_SIZE;
  for (let i = SPELL_IDS.length - 1; i >= 0 && excess > 0; i--) {
    const id = SPELL_IDS[i]!;
    const cut = Math.min(charges[id], excess);
    charges[id] -= cut;
    excess -= cut;
  }
  return charges;
}

/** Adds one charge (mutates). Returns false and changes nothing when the pool is full. */
export function addCharge(charges: SpellCharges, id: SpellId, limit: number = SPELL_POOL_SIZE, caps?: Readonly<Partial<SpellCharges>> | null): boolean {
  if (poolFull(charges, limit)) return false;
  const cap = caps?.[id];
  if (cap !== undefined && charges[id] >= cap) return false;
  charges[id]++;
  return true;
}

/** Uses one charge (mutates). Returns false when none are left. */
export function consumeCharge(charges: SpellCharges, id: SpellId): boolean {
  if (charges[id] <= 0) return false;
  charges[id]--;
  return true;
}
