/** TypeL Triumphs (prototype, D-085): long-term tiered milestones. Values PROVISIONAL. */
import { RUNES } from '../gameplay/runes/RuneCatalogue';
import type { TypeLProgress } from './prefs';

export interface Triumph {
  id: string;
  name: string;
  what: string;
  tiers: [number, number, number];
  value(p: TypeLProgress): number;
  format?: (v: number) => string;
}

export const TIER_NAMES = ['Copper', 'Silver', 'Gold Leaf'] as const;

export const TRIUMPHS: readonly Triumph[] = [
  { id: 'scribe', name: 'Scribe', what: 'Scrolls captured', tiers: [100, 1000, 10000], value: (p) => p.lifetime.words },
  { id: 'clean-hand', name: 'Clean Hand', what: 'Perfect captures', tiers: [50, 500, 5000], value: (p) => p.lifetime.perfect },
  { id: 'collector', name: 'Rune Collector', what: 'Different Runes earned', tiers: [5, 15, RUNES.length], value: (p) => Object.keys(p.runes).length },
  { id: 'apprentice', name: 'Apprentice', what: 'Apprenticeships completed (Normal)', tiers: [1, 4, 9], value: (p) => p.completed.normal.length },
  { id: 'hardened', name: 'Hardened', what: 'Apprenticeships completed (Hardcore)', tiers: [1, 4, 9], value: (p) => p.completed.hardcore.length },
  { id: 'surge', name: 'Surgebearer', what: 'Highest Volley reached', tiers: [2, 3, 5], value: (p) => p.lifetime.peakVolley, format: (v) => `×${v.toFixed(1)}` },
  { id: 'scarred', name: 'Scarred Veteran', what: 'All-In wagers taken', tiers: [1, 10, 50], value: (p) => p.lifetime.wagers },
  { id: 'swift', name: 'Swift Hand', what: 'Best Typing Trial WPM', tiers: [40, 70, 100], value: (p) => Math.max(0, ...Object.values(p.typing.bestWpm)) },
];

export function tierOf(t: Triumph, p: TypeLProgress): number {
  const v = t.value(p);
  return t.tiers.filter((x) => v >= x).length;
}
