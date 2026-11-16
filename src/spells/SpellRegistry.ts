import spellsData from '../data/spells.json';
import { isSpellId, SPELL_IDS, type SpellId } from '../gameplay/SpellManager';
import type { SpellContext, SpellData, SpellDefinition } from './BaseSpell';

/**
 * Spell effects (GDD §10). Descriptions, keys and timings live in
 * src/data/spells.json; only the behaviour is code.
 *
 * Sources for the original's behaviour are fan guides, not the game file
 * (original-game-research.md #9–12), so these are documented adaptations.
 */
const EFFECTS: Record<SpellId, (ctx: SpellContext, data: SpellData) => void> = {
  // Fire Book: "burn all words".
  fire: (ctx) => ctx.burnAllWords(),
  // Ice Book: "freeze all words".
  ice: (ctx, data) => ctx.freeze(ctx.ticks(data.durationMs ?? 5000)),
  // Slow Book: "slow them".
  slow: (ctx, data) => ctx.slow(ctx.ticks(data.durationMs ?? 8000), data.speedFactor ?? 0.5),
  // Wind Book: "renew your life", reset the danger bar, "erase incorrectly typed words".
  wind: (ctx) => {
    ctx.resetInstability();
    ctx.resetWordSpeeds();
  },
};

function loadSpells(raw: unknown): Record<SpellId, SpellDefinition> {
  if (!Array.isArray(raw)) throw new Error('spells.json must be an array');
  const byId = new Map<SpellId, SpellData>();
  for (const entry of raw as SpellData[]) {
    if (!isSpellId(entry.id)) throw new Error(`Unknown spell id "${String(entry.id)}"`);
    if (!entry.name || !entry.book) throw new Error(`Spell "${entry.id}" is missing fields`);
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
 * ("fire", "ice", "slow", "wind") in the typing console and pressing Enter.
 */
export const SPELLS: Readonly<Record<SpellId, SpellDefinition>> = loadSpells(spellsData);
