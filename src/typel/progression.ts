/**
 * Academy progression (D-115, D-118). Pure functions over saved progress, so
 * the rules can be tested without the UI.
 *
 * - The spell-free Opening Trial comes first; attempting it (cleared or not,
 *   D-112) opens the first apprenticeship.
 * - Clearing an apprenticeship's Normal examination opens the next
 *   apprenticeship and that apprenticeship's optional Hardcore.
 * - A spell is in the player's repertoire once its apprenticeship's Normal
 *   examination is cleared (plus the spell being taught right now).
 * - Normal replays keep the stage's difficulty but use the whole repertoire.
 * - Hardcore is fixed and reproducible: a fixed seed per apprenticeship, no
 *   skill adaptation. It never gates anything.
 */
import type { SpellCharges, SpellId } from '../gameplay/SpellManager';
import { LEGACY_SPELL_ORDER, SPELL_ORDER, TRIALS, type Mode, type Trial } from './apprenticeship';

export interface ProgressView {
  completed: { normal: number[]; hardcore: number[] };
  opening: { cleared: { normal: boolean; hardcore: boolean }; runs: number };
  /** Options → playtesting: everything open. */
  unlockAll?: boolean;
}

/** Is this apprenticeship (1–9) open in this mode? */
export function trialUnlocked(p: ProgressView, mode: Mode, trial: number): boolean {
  if (p.unlockAll) return true;
  const normalDone = new Set(p.completed.normal);
  if (mode === 'hardcore') return normalDone.has(trial);
  if (trial === 1) return p.opening.runs > 0 || normalDone.size > 0;
  return normalDone.has(trial - 1);
}

/** The Opening Trial's Hardcore opens once its Normal has been cleared. */
export function openingUnlocked(p: ProgressView, mode: Mode): boolean {
  return mode === 'normal' || !!p.unlockAll || p.opening.cleared.normal;
}

/** Why a locked entry is locked, for the menu. */
export function lockReason(mode: Mode, trial: number): string {
  if (mode === 'hardcore') return 'Clear its Normal examination to unlock Hardcore.';
  if (trial === 1) return 'Attempt the Opening Trial first.';
  return `Clear ${TRIALS[trial - 2]!.title} (Normal) to unlock.`;
}

/** Spells the player has earned: every apprenticeship whose Normal examination is cleared. */
export function unlockedSpells(p: ProgressView): SpellId[] {
  if (p.unlockAll) return [...SPELL_ORDER];
  const done = new Set(p.completed.normal);
  return SPELL_ORDER.filter((_, i) => done.has(i + 1));
}

/**
 * The spells available in an apprenticeship: what it teaches, everything
 * before it, and everything the player has earned since (D-115 replay rule).
 */
export function repertoire(p: ProgressView, trial: number): SpellId[] {
  const own = SPELL_ORDER.slice(0, Math.min(SPELL_ORDER.length, trial));
  const have = new Set<SpellId>([...own, ...unlockedSpells(p)]);
  return SPELL_ORDER.filter((s) => have.has(s));
}

/** Starting bank: 3 of the taught spell, then 1 each of the most recent others in the repertoire, 8 in all. */
export function startingBank(trial: Trial, spells: readonly SpellId[]): Partial<SpellCharges> {
  const charges: Partial<SpellCharges> = {};
  if (trial.spell) charges[trial.spell] = 3;
  let room = trial.spell ? 5 : 8;
  for (const s of [...spells].reverse()) {
    if (s === trial.spell) continue;
    if (room-- <= 0) break;
    charges[s] = 1;
  }
  return charges;
}

/** Hardcore's fixed, reproducible seed for an apprenticeship (0 = the Opening Trial). EXPERIMENTAL constant. */
export const hardcoreSeed = (trial: number): number => (0x5eed_7e1 + trial * 0x9e37) >>> 0;

/** Schema of saved progress. v2: apprenticeship indices follow the D-115 order. */
export const PROGRESS_VERSION = 2;

/** Old index (pre-D-115 order) → new index. The Final Examination (9) stays 9. */
export function migrateTrialIndex(oldIndex: number): number {
  if (oldIndex < 1 || oldIndex > LEGACY_SPELL_ORDER.length) return oldIndex;
  return SPELL_ORDER.indexOf(LEGACY_SPELL_ORDER[oldIndex - 1]!) + 1;
}

/**
 * Migrates saved completion lists written under the pre-D-115 order. An old
 * save can't say which spell order it cleared things in except by position, so
 * positions are mapped by spell: "completed the Flame apprenticeship" stays true.
 */
export function migrateCompleted(list: readonly number[]): number[] {
  return [...new Set(list.map(migrateTrialIndex))].sort((a, b) => a - b);
}
