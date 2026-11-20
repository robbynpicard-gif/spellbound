import type { LifetimeStats } from '../storage/LifetimeStats';

/** Long-term Triumphs are derived from authoritative lifetime counters.
 * Tiers are earned once, never spent or repeatedly awarded. */
export const TRIUMPH_TIERS = ['Bronze', 'Silver', 'Gold'] as const;
export const TRIUMPH_DEFINITIONS = [
  { id: 'scribe', title: 'The Patient Scribe', metric: 'wordsCaptured', targets: [100, 1000, 10000], unit: 'words captured' },
  { id: 'journey', title: 'The Long Apprenticeship', metric: 'levelsPlayed', targets: [10, 100, 500], unit: 'levels played' },
  { id: 'victory', title: 'Keeper of the Wards', metric: 'levelsWon', targets: [5, 50, 250], unit: 'levels won' },
  { id: 'precision', title: 'Unbroken Quill', metric: 'bestCleanStreak', targets: [10, 25, 50], unit: 'best clean streak' },
  { id: 'chain', title: 'Weaver of Words', metric: 'bestCombo', targets: [20, 50, 100], unit: 'best combo' },
  { id: 'volley', title: 'Storm of Letters', metric: 'volleyBonuses', targets: [10, 100, 500], unit: 'Volley bonuses' },
] as const;

export function triumphProgress(lifetime: Readonly<LifetimeStats>) {
  return TRIUMPH_DEFINITIONS.map((definition) => {
    const value = definition.metric === 'volleyBonuses'
      ? (lifetime.bonusCounts.volley ?? 0)
      : lifetime[definition.metric];
    const tier = definition.targets.filter((target) => value >= target).length;
    const next = tier < definition.targets.length ? definition.targets[tier] : null;
    return { ...definition, value, tier, next };
  });
}

/** Compare before and after lifetime snapshots; only newly crossed tiers are announced.
 * If a single session crosses several thresholds, announce every tier in order. */
export function newlyEarnedTriumphs(before: Readonly<LifetimeStats>, after: Readonly<LifetimeStats>) {
  const previous = triumphProgress(before);
  return triumphProgress(after).flatMap((current, index) => {
    const oldTier = previous[index]!.tier;
    return Array.from({ length: Math.max(0, current.tier - oldTier) }, (_, i) => ({
      id: current.id,
      title: current.title,
      tier: oldTier + i + 1,
      tierName: TRIUMPH_TIERS[oldTier + i]!,
    }));
  });
}
