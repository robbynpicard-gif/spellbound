import { describe, expect, it } from 'vitest';
import { apprenticeshipRun, LEGACY_SPELL_ORDER, SPELL_ORDER, TRIALS } from '../src/typel/apprenticeship';
import {
  hardcoreSeed, migrateCompleted, migrateTrialIndex, openingUnlocked, repertoire, startingBank, trialUnlocked, unlockedSpells, type ProgressView,
} from '../src/typel/progression';

/** D-115 Academy progression, replay and Hardcore rules (D-118 implementation). */
const progress = (normal: number[] = [], o: Partial<ProgressView> = {}): ProgressView => ({
  completed: { normal, hardcore: [] }, opening: { cleared: { normal: false, hardcore: false }, runs: 0 }, ...o,
});

describe('Academy unlocks', () => {
  it('the Opening Trial comes first; attempting it opens the first apprenticeship', () => {
    expect(trialUnlocked(progress(), 'normal', 1)).toBe(false);
    expect(trialUnlocked(progress([], { opening: { cleared: { normal: false, hardcore: false }, runs: 1 } }), 'normal', 1)).toBe(true);
  });

  it('clearing Normal opens the next apprenticeship and that stage\'s Hardcore', () => {
    const p = progress([1, 2], { opening: { cleared: { normal: true, hardcore: false }, runs: 1 } });
    expect(trialUnlocked(p, 'normal', 3)).toBe(true);
    expect(trialUnlocked(p, 'normal', 4)).toBe(false);
    expect(trialUnlocked(p, 'hardcore', 2)).toBe(true);
    expect(trialUnlocked(p, 'hardcore', 3)).toBe(false);
    expect(openingUnlocked(p, 'hardcore')).toBe(true);
    expect(openingUnlocked(progress(), 'hardcore')).toBe(false);
  });

  it('Hardcore never gates anything: Normal unlocks ignore Hardcore completion', () => {
    const p = progress([1]);
    p.completed.hardcore = [];
    expect(trialUnlocked(p, 'normal', 2)).toBe(true);
  });

  it('the playtesting switch opens everything', () => {
    const p = progress([], { unlockAll: true });
    for (const t of TRIALS) {
      expect(trialUnlocked(p, 'normal', t.index)).toBe(true);
      expect(trialUnlocked(p, 'hardcore', t.index)).toBe(true);
    }
    expect(unlockedSpells(p)).toEqual([...SPELL_ORDER]);
  });
});

describe('repertoire and replay', () => {
  it('a first attempt offers the stage\'s spell and everything before it', () => {
    expect(repertoire(progress([1, 2, 3]), 4)).toEqual(['slow', 'barrier', 'wind', 'fire']);
  });

  it('replaying an earlier stage offers every spell earned since, with the same difficulty', () => {
    const p = progress([1, 2, 3, 4, 5]);
    const spells = repertoire(p, 2);
    expect(spells).toEqual(['slow', 'barrier', 'wind', 'fire', 'ice']);
    const first = apprenticeshipRun('normal', 2, 'learn', { spells: repertoire(progress([1]), 2) });
    const replay = apprenticeshipRun('normal', 2, 'learn', { spells });
    for (let i = 0; i < first.segments.length; i++) {
      const { availableSpells: a, ...restA } = first.segments[i]!.config;
      const { availableSpells: b, ...restB } = replay.segments[i]!.config;
      expect(restB).toEqual(restA); // identical difficulty
      expect(b.length).toBeGreaterThan(a.length); // later spells can drop
    }
    const bank = startingBank(TRIALS[1]!, spells);
    expect(bank.barrier).toBe(3);
    expect(Object.values(bank).reduce((x, y) => x + (y ?? 0), 0)).toBe(7);
  });

  it('Hardcore uses a fixed seed per stage', () => {
    expect(hardcoreSeed(3)).toBe(hardcoreSeed(3));
    expect(hardcoreSeed(3)).not.toBe(hardcoreSeed(4));
  });
});

describe('save compatibility (pre-D-115 order)', () => {
  it('maps old apprenticeship numbers by spell, so earned progress is kept', () => {
    for (let i = 1; i <= 8; i++) expect(SPELL_ORDER[migrateTrialIndex(i) - 1]).toBe(LEGACY_SPELL_ORDER[i - 1]);
    expect(migrateTrialIndex(9)).toBe(9);
    // Old save: Time (1) and Flame (2, old order) cleared → Time (1) and Flame (4, new order).
    expect(migrateCompleted([1, 2])).toEqual([1, 4]);
  });
});
