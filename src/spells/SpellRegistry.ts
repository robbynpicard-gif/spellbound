import spellsData from '../data/spells.json';
import { isSpellId, SPELL_IDS, type SpellId } from '../gameplay/SpellManager';
import type { SpellContext, SpellData, SpellDefinition } from './BaseSpell';

/**
 * Spell effects (docs/plans/spells-v2.md). Descriptions, drop weights and
 * timings live in src/data/spells.json; only the behaviour is code.
 */
const EFFECTS: Record<SpellId, (ctx: SpellContext, data: SpellData) => void> = {
  slow: (ctx, data) => ctx.slow(ctx.ticks(data.durationMs ?? 8000), data.speedFactor ?? 0.6),
  ice: (ctx, data) => ctx.freeze(ctx.ticks(data.durationMs ?? 8000)),
  barrier: (ctx, data) => ctx.addBarrier(data.blocks ?? 2),
  shock: (ctx, data) => ctx.chainLightning(data.arcs ?? 3),
  alter: (ctx, data) => {
    ctx.transmute(data.minLength ?? 6);
    ctx.easyWords(ctx.ticks(data.durationMs ?? 8000));
  },
  fire: (ctx) => ctx.burnAllWords(),
  wind: (ctx, data) => {
    ctx.wind(data.heal ?? 50);
    ctx.resetWordSpeeds();
  },
  harvest: (ctx) => ctx.harvestAll(),
};

function loadSpells(raw: unknown): Record<SpellId, SpellDefinition> {
  if (!Array.isArray(raw)) throw new Error('spells.json must be an array');
  const byId = new Map<SpellId, SpellData>();
  for (const entry of raw as SpellData[]) {
    if (!isSpellId(entry.id)) throw new Error(`Unknown spell id "${String(entry.id)}"`);
    if (!entry.name || !entry.book || !entry.summary) throw new Error(`Spell "${entry.id}" is missing fields`);
    if (typeof entry.dropWeight !== 'number' || !(entry.dropWeight > 0))
      throw new Error(`Spell "${entry.id}" needs a positive dropWeight`);
    byId.set(entry.id, entry);
  }
  const registry = {} as Record<SpellId, SpellDefinition>;
  for (const id of SPELL_IDS) {
    const data = byId.get(id);
    if (!data) throw new Error(`spells.json has no entry for "${id}"`);
    const effect = EFFECTS[id];
    registry[id] = { ...data, cast: (ctx) => effect(ctx, data) };
  }
  return registry;
}

/**
 * Central spell registry (GDD §6). A spell is cast by typing its id
 * (e.g. "shock") in the typing console and pressing Enter.
 */
export const SPELLS: Readonly<Record<SpellId, SpellDefinition>> = loadSpells(spellsData);

/** Drop weight multiplier for the spell a level introduces. */
export const INTRO_DROP_BOOST = 3;

/** Relative drop weights for a level's scrolls (the introduced spell is boosted). */
export function dropWeights(
  available: readonly SpellId[],
  introduced: SpellId | null | undefined,
): Partial<Record<SpellId, number>> {
  const weights: Partial<Record<SpellId, number>> = {};
  for (const id of available) weights[id] = SPELLS[id].dropWeight * (id === introduced ? INTRO_DROP_BOOST : 1);
  return weights;
}
