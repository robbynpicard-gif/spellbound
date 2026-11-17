import { describe, expect, it } from 'vitest';
import {
  awardMastery,
  cosmeticsFor,
  emptyWardrobeEntry,
  featsFrom,
  loadout,
  masteryLevel,
  MASTERY_XP,
  MAX_MASTERY,
} from '../src/gameplay/Cosmetics';
import { WIZARD_IDS } from '../src/gameplay/Wizards';
import { parseWardrobe } from '../src/storage/SaveManager';

describe('Cosmetics (D-043)', () => {
  it('every wizard has a full, unique track: one unlock per mastery level plus three feats', () => {
    for (const id of WIZARD_IDS) {
      const items = cosmeticsFor(id);
      const keys = items.map((c) => `${c.slot}:${c.id}`);
      expect(new Set(keys).size).toBe(keys.length);
      for (let level = 2; level <= MAX_MASTERY; level++) expect(items.filter((c) => c.unlock === level)).toHaveLength(1);
      expect(items.filter((c) => typeof c.unlock === 'string')).toHaveLength(3);
      for (const f of items.filter((c) => c.slot === 'familiar' && c.id !== 'none')) expect(f.value).toBeGreaterThanOrEqual(0);
    }
  });

  it('mastery levels follow the XP table', () => {
    expect(masteryLevel(0)).toBe(1);
    expect(masteryLevel(MASTERY_XP[1]! - 1)).toBe(1);
    expect(masteryLevel(MASTERY_XP[1]!)).toBe(2);
    expect(masteryLevel(10_000_000)).toBe(MAX_MASTERY);
  });

  it('awarding XP and feats reports exactly what unlocked; equipping a locked item is ignored', () => {
    const e = emptyWardrobeEntry();
    const first = awardMastery('pyromancer', e, { xp: MASTERY_XP[2]!, feats: [] });
    expect(first.map((c) => c.unlock)).toEqual([2, 3]);
    expect(awardMastery('pyromancer', e, { xp: 0, feats: [] })).toEqual([]);
    const feat = awardMastery('pyromancer', e, { xp: 0, feats: ['decuple'] });
    expect(feat.map((c) => c.slot)).toEqual(['flourish']);
    e.equipped.outfit = 'c'; // not unlocked yet
    expect(loadout('pyromancer', e).outfit).toBe('a');
    e.equipped.flourish = 'fireworks';
    expect(loadout('pyromancer', e).flourish).toBe('fireworks');
  });

  it('feats come from how a level was played', () => {
    expect(featsFrom({ missed: 0, errors: 0, peakMultiplier: 10 }, true, false)).toEqual(['flawless', 'decuple']);
    expect(featsFrom({ missed: 0, errors: 0, peakMultiplier: 3 }, false, false)).toEqual([]);
    expect(featsFrom({ missed: 2, errors: 1, peakMultiplier: 2 }, true, true)).toEqual(['champion']);
  });

  it('the save keeps valid wardrobe data and drops the rest', () => {
    const w = parseWardrobe({ lexicant: { xp: 5000, feats: ['flawless', 'bogus'], equipped: { title: 't1', outfit: 'zzz' } }, warden: { xp: 9 } });
    expect(w.lexicant.xp).toBe(5000);
    expect(w.lexicant.feats).toEqual(['flawless']);
    expect(w.lexicant.equipped).toEqual({ title: 't1' });
    expect(Object.keys(w)).not.toContain('warden');
  });
});
