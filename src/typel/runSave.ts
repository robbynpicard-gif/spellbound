import type { Command } from '../core/GameEngine';
import type { Mode, StartPhase } from './apprenticeship';

/**
 * D-102 save and resume for the continuous apprenticeship.
 *
 * Policy: a run is saved at every internal checkpoint (and the boss entry) as
 * its seed plus the exact command log up to that tick. Resuming replays the
 * log deterministically, which restores everything exactly as it was at the
 * checkpoint: field, score, Combo, Arcane Rush, spell charges, Ward, Director
 * and every random stream. Play after the last checkpoint is not kept, so
 * resuming can never duplicate or farm score. Endless is not saved: leaving
 * Endless ends it.
 *
 * Stored under its own key, so progress and records are never touched.
 */
const KEY = 'typel.activeRun.v1';
/** Bump when the run's structure or generation changes: old saves are then discarded, never replayed wrongly. */
export const RUN_RULESET = 'run-2';

/**
 * Records for the continuous ruleset are kept apart from the old level-based
 * ones ("normal:3", "normal:3:director"), which stay in the save untouched.
 */
export const runRecordKey = (mode: Mode, trial: number) => `${mode}:${trial}:${RUN_RULESET}`;

export interface SavedRun {
  ruleset: string;
  mode: Mode;
  trial: number;
  start: StartPhase;
  seed: number;
  /** The checkpoint tick the log runs to. */
  tick: number;
  commands: Command[];
  phase: string;
  score: number;
  savedAt: number;
  /** The run was resumed after the Ward fell (Flawless Perfection then can't be earned). */
  fell: boolean;
}

export function loadRun(): SavedRun | null {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null') as SavedRun | null;
    if (!raw || raw.ruleset !== RUN_RULESET || !Array.isArray(raw.commands) || typeof raw.seed !== 'number') return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveRun(run: SavedRun): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(run));
  } catch {
    /* storage full or unavailable: the run simply can't be resumed */
  }
}

export function clearRun(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
