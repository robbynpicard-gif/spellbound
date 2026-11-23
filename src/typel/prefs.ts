/**
 * TypeL prototype storage (D-085): progress, records, Runes, Triumph totals
 * and accessibility. Its own keys, so it never touches older saves.
 */
import { migrateCompleted, PROGRESS_VERSION } from './progression';

const KEY = 'typel.progress.v1';

export interface TypeLProgress {
  /** Completed apprenticeships per mode (trial indices). */
  completed: { normal: number[]; hardcore: number[] };
  bestTrialScore: Record<string, number>;
  bestEndless: Record<string, number>;
  runes: Record<string, number>;
  lifetime: { words: number; perfect: number; peakVolley: number; wagers: number; levels: number; bosses: number };
  typing: { bestWpm: Record<string, number>; runs: number };
  /** D-112: the spell-free Opening Trial, per mode. */
  opening: { cleared: { normal: boolean; hardcore: boolean }; best: Record<string, number>; runs: number };
  reducedMotion: boolean | null;
  /** Save schema (D-118): 2 = apprenticeship indices in the D-115 order. */
  version?: number;
  /** Options → playtesting: open every apprenticeship and Hardcore, and give every spell. */
  unlockAll: boolean;
  /** Options → experiment: D-115 candidate per-spell bank caps. */
  spellCaps: boolean;
}

const fresh = (): TypeLProgress => ({
  completed: { normal: [], hardcore: [] },
  bestTrialScore: {},
  bestEndless: {},
  runes: {},
  lifetime: { words: 0, perfect: 0, peakVolley: 1, wagers: 0, levels: 0, bosses: 0 },
  typing: { bestWpm: {}, runs: 0 },
  opening: { cleared: { normal: false, hardcore: false }, best: {}, runs: 0 },
  reducedMotion: null,
  version: PROGRESS_VERSION,
  unlockAll: false,
  spellCaps: false,
});

function load(): TypeLProgress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<TypeLProgress> | null;
    const f = fresh();
    if (!raw) return f;
    // v1 saves numbered apprenticeships in the pre-D-115 spell order: map them by spell.
    const old = (raw.version ?? 1) < PROGRESS_VERSION;
    const completed = { ...f.completed, ...(raw.completed ?? {}) };
    if (old) {
      completed.normal = migrateCompleted(completed.normal ?? []);
      completed.hardcore = migrateCompleted(completed.hardcore ?? []);
    }
    return {
      ...f,
      ...raw,
      version: PROGRESS_VERSION,
      completed,
      lifetime: { ...f.lifetime, ...(raw.lifetime ?? {}) },
      typing: { ...f.typing, ...(raw.typing ?? {}) },
      opening: { ...f.opening, ...(raw.opening ?? {}), cleared: { ...f.opening.cleared, ...(raw.opening?.cleared ?? {}) } },
    };
  } catch {
    return fresh();
  }
}

class Prefs {
  data: TypeLProgress = load();

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable */
    }
  }

  reducedMotion(): boolean {
    if (this.data.reducedMotion !== null) return this.data.reducedMotion;
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  noteRune(id: string): void {
    this.data.runes[id] = (this.data.runes[id] ?? 0) + 1;
    this.save();
  }

  reset(): void {
    this.data = fresh();
    this.save();
  }
}

export const prefs = new Prefs();
