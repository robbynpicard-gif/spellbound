/**
 * Arcane Trials, prototype (D-114, D-119, D-120; Yellow scope).
 *
 * One representative trial built on the existing engine and Difficulty
 * Director: a single continuous encounter (no checkpoints, phases or
 * intermissions) with an authored, fixed pressure profile, the shared
 * event bursts and recoveries, and a D-109 spawn formation for its
 * tactical identity. All eight spells, the shared bank, the D-115 spell
 * identities and the normal scoring apply unchanged.
 *
 * Every number is EXPERIMENTAL and exists to be playtested.
 */
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import type { DirectorSpec, TrialProfile } from '../difficulty/DifficultyDirector';
import type { SpellCharges } from '../gameplay/SpellManager';
import { LEARN_CHECKPOINTS, runSegmentConfig, SPELL_ORDER } from './apprenticeship';

export type TrialAdaptation = 'off' | 'both' | 'up';

export interface ArcaneTrialDef {
  id: string;
  title: string;
  /** One line on the trial's tactical identity. */
  identity: string;
  /** Scrolls to resolve (typed, Shocked or Harvested) to survive the trial. */
  quota: number;
  profile: TrialProfile;
  /** Where the words come from (0 = short Slow vocabulary, 1 = the full late range). */
  vocabulary: number;
  /** Speed bands and density reference on the Academy journey (0–1). */
  position: number;
  startingBank: Partial<SpellCharges>;
}

/**
 * The Crosswind Trial: pressure sweeps from one side of the sky to the
 * other in runs of scrolls, while some scrolls enter partway down, so
 * threats stand at several heights at once. Tactically it invites WIND (push
 * back a crowded side), SHOCK (a one-sided cluster conducts), FIRE (a low
 * front) and BARRIER (a crossing where two sides land together). None is
 * required: clean, well-ordered typing is still the main way through (D-119).
 */
export const CROSSWIND: ArcaneTrialDef = {
  id: 'crosswind',
  title: 'The Crosswind Trial',
  identity: 'The sky leans one way, then the other. Some scrolls drop in halfway down. Read the wind; type through it.',
  quota: 560,
  vocabulary: 0.35,
  position: 0.8,
  profile: {
    baseline: [0.35, 0.9],
    k: 1.3,
    swell: { period: 70, amplitude: 0.12 },
    eventScale: 1.15,
    recoveryScale: 1.2,
    formation: { kind: 'crosswind', edgeShare: 0.75, band: 0.5, run: [5, 9], stagger: { chance: 0.3, depth: [0.08, 0.3] } },
  },
  startingBank: { slow: 1, barrier: 1, wind: 1, fire: 1, ice: 1, shock: 1, alter: 1, harvest: 1 },
};

export const ARCANE_TRIALS: readonly ArcaneTrialDef[] = [CROSSWIND];

/**
 * The trial as one continuous encounter. `adaptation` exists to compare
 * against the Academy's D-116 controller; the prototype plays 'off' (D-120:
 * an authored, reproducible profile that does not ease when the player struggles).
 */
export function arcaneTrialConfig(def: ArcaneTrialDef, adaptation: TrialAdaptation = 'off'): DifficultyConfig {
  // Pace references (spawn interval, concurrency) from the final apprenticeship's Master phase.
  const base = runSegmentConfig('normal', 9, LEARN_CHECKPOINTS + 2);
  const director: DirectorSpec = {
    ...base.director!,
    kind: 'trial',
    apprenticeship: def.position,
    vocabulary: def.vocabulary,
    adaptive: adaptation,
    adaptiveBounds: 'run',
    trial: def.profile,
  };
  return {
    ...base,
    name: def.title,
    requiredWords: def.quota,
    survivalMs: undefined,
    rampWords: null,
    openingWords: 0,
    availableSpells: [...SPELL_ORDER],
    introducesSpell: null,
    director,
  };
}
