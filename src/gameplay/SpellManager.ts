/**
 * Spell ids, in power order (least → most powerful), which is also the order
 * the Campaign introduces them (docs/plans/spells-v2.md). The id is the cast
 * word: type it and press Enter to cast.
 */
export const SPELL_IDS = ['slow', 'ice', 'barrier', 'shock', 'alter', 'fire', 'wind', 'harvest'] as const;
export type SpellId = (typeof SPELL_IDS)[number];

export type SpellCharges = Record<SpellId, number>;

/**
 * All spells share one pool of charges. There is no per-spell limit; how
 * often each spell drops (its drop weight) is what keeps strong spells rare.
 */
export const SPELL_POOL_SIZE = 8;

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
export function poolFull(charges: Readonly<SpellCharges>): boolean {
  return totalCharges(charges) >= SPELL_POOL_SIZE;
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
  let excess = totalCharges(charges) - SPELL_POOL_SIZE;
  for (let i = SPELL_IDS.length - 1; i >= 0 && excess > 0; i--) {
    const id = SPELL_IDS[i]!;
    const cut = Math.min(charges[id], excess);
    charges[id] -= cut;
    excess -= cut;
  }
  return charges;
}

/** Adds one charge (mutates). Returns false and changes nothing when the pool is full. */
export function addCharge(charges: SpellCharges, id: SpellId): boolean {
  if (poolFull(charges)) return false;
  charges[id]++;
  return true;
}

/** Uses one charge (mutates). Returns false when none are left. */
export function consumeCharge(charges: SpellCharges, id: SpellId): boolean {
  if (charges[id] <= 0) return false;
  charges[id]--;
  return true;
}
