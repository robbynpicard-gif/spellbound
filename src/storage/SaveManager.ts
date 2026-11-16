import type { GameResult } from '../core/GameEvents';
import type { GameStats } from '../gameplay/ScoringSystem';
import {
  applyCampaignResult,
  emptyCampaignProgress,
  type CampaignOutcome,
  type CampaignProgress,
  type LevelRecord,
} from '../modes/CampaignMode';

export const SAVE_KEY = 'spellbound.save';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  campaign: CampaignProgress;
}

/** The subset of the Web Storage API we use (lets tests pass a fake). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, campaign: emptyCampaignProgress() };
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

/**
 * Turns stored text back into SaveData. Anything unreadable or from an
 * unknown version yields a fresh save instead of crashing the game.
 */
export function parseSave(raw: string | null, totalLevels: number): SaveData {
  if (!raw) return emptySave();
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== SAVE_VERSION || typeof data.campaign !== 'object' || !data.campaign) {
      return emptySave();
    }
    const save = emptySave();
    const unlocked = Math.floor(num(data.campaign.highestUnlocked, 1));
    save.campaign.highestUnlocked = Math.min(Math.max(unlocked, 1), totalLevels);
    for (const [key, r] of Object.entries(data.campaign.levels ?? {})) {
      if (typeof r !== 'object' || r === null) continue;
      const rec = r as Partial<LevelRecord>;
      save.campaign.levels[key] = {
        bestScore: num(rec.bestScore),
        bestWpm: num(rec.bestWpm),
        bestAccuracy: Math.min(num(rec.bestAccuracy), 1),
        bestCombo: num(rec.bestCombo),
        completions: num(rec.completions),
        attempts: num(rec.attempts),
      };
    }
    return save;
  } catch {
    return emptySave();
  }
}

/** Returns the browser's localStorage, or null if it is blocked (private mode, etc.). */
export function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = '__spellbound_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * Loads and saves player progress. If storage is unavailable the game still
 * works; progress simply lasts until the page is closed.
 */
export class SaveManager {
  private save: SaveData;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly totalLevels: number,
  ) {
    let raw: string | null = null;
    try {
      raw = storage?.getItem(SAVE_KEY) ?? null;
    } catch {
      raw = null;
    }
    this.save = parseSave(raw, totalLevels);
  }

  get persistent(): boolean {
    return this.storage !== null;
  }

  get campaign(): Readonly<CampaignProgress> {
    return this.save.campaign;
  }

  recordCampaignResult(level: number, result: GameResult, stats: GameStats): CampaignOutcome {
    const outcome = applyCampaignResult(this.save.campaign, level, result, stats, this.totalLevels);
    this.write();
    return outcome;
  }

  private write(): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      // Storage full or blocked: keep playing with in-memory progress.
    }
  }
}
