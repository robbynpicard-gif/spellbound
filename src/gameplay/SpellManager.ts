/** The four original spells (GDD §10). Additional spells are added here later. */
export const SPELL_IDS = ['fire', 'ice', 'slow', 'wind'] as const;
export type SpellId = (typeof SPELL_IDS)[number];

export type SpellCharges = Record<SpellId, number>;

/** Most charges of one spell a player may hold (GDD §10: three initially). */
export const MAX_SPELL_CHARGES = 3;

export function isSpellId(value: unknown): value is SpellId {
  return typeof value === 'string' && (SPELL_IDS as readonly string[]).includes(value);
}

export function emptyCharges(): SpellCharges {
  return { fire: 0, ice: 0, slow: 0, wind: 0 };
}

/** Normalises a possibly partial/invalid charge table into 0…MAX for every spell. */
export function sanitizeCharges(input?: Partial<Record<string, unknown>>): SpellCharges {
  const charges = emptyCharges();
  for (const id of SPELL_IDS) {
    const value = input?.[id];
    if (typeof value === 'number' && Number.isFinite(value)) {
      charges[id] = Math.min(MAX_SPELL_CHARGES, Math.max(0, Math.floor(value)));
    }
  }
  return charges;
}

/** Adds one charge (mutates). Returns false and changes nothing when already full. */
export function addCharge(charges: SpellCharges, id: SpellId): boolean {
  if (charges[id] >= MAX_SPELL_CHARGES) return false;
  charges[id]++;
  return true;
}

/** Uses one charge (mutates). Returns false when none are left. */
export function consumeCharge(charges: SpellCharges, id: SpellId): boolean {
  if (charges[id] <= 0) return false;
  charges[id]--;
  return true;
}
