import {
  applyRunResult,
  emptyCampaignRecords,
  noteLevelReached,
  type CampaignRecords,
  type RunOutcome,
  type RunSummary,
} from '../modes/CampaignMode';

export const SAVE_KEY = 'spellbound.save';
export const SAVE_VERSION = 2;

export interface SaveData {
  version: typeof SAVE_VERSION;
  campaign: CampaignRecords;
}

/** The subset of the Web Storage API we use (lets tests pass a fake). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, campaign: emptyCampaignRecords() };
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

const clampLevel = (v: unknown, totalLevels: number): number =>
  Math.min(Math.max(Math.floor(num(v, 1)), 1), totalLevels);

function parseRun(raw: unknown, totalLevels: number): RunSummary | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<RunSummary>;
  return {
    score: num(r.score),
    levelsCleared: Math.min(num(r.levelsCleared), totalLevels),
    reachedLevel: clampLevel(r.reachedLevel, totalLevels),
    victory: r.victory === true,
    accuracy: Math.min(num(r.accuracy), 1),
    wpm: num(r.wpm),
    completed: num(r.completed),
    missed: num(r.missed),
    maxCombo: num(r.maxCombo),
    elapsedMs: num(r.elapsedMs),
  };
}

/**
 * Turns stored text back into SaveData. Anything unreadable yields a fresh
 * save instead of crashing. Version 1 saves (per-level campaign, Milestone 2)
 * are migrated: their highest unlocked level becomes the highest reached.
 */
export function parseSave(raw: string | null, totalLevels: number): SaveData {
  if (!raw) return emptySave();
  try {
    const data = JSON.parse(raw) as { version?: number; campaign?: Record<string, unknown> };
    const c = data.campaign;
    if (typeof c !== 'object' || c === null) return emptySave();
    const save = emptySave();

    if (data.version === 1) {
      save.campaign.highestReached = clampLevel(c.highestUnlocked, totalLevels);
      return save;
    }
    if (data.version !== SAVE_VERSION) return emptySave();

    save.campaign.highestReached = clampLevel(c.highestReached, totalLevels);
    save.campaign.bestRun = parseRun(c.bestRun, totalLevels);
    save.campaign.runsStarted = num(c.runsStarted);
    save.campaign.runsCompleted = num(c.runsCompleted);
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
 * Loads and saves player records. If storage is unavailable the game still
 * works; records simply last until the page is closed.
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

  get campaign(): Readonly<CampaignRecords> {
    return this.save.campaign;
  }

  noteRunStarted(): void {
    this.save.campaign.runsStarted++;
    this.write();
  }

  noteLevelReached(level: number): void {
    noteLevelReached(this.save.campaign, Math.min(level, this.totalLevels));
    this.write();
  }

  recordRun(summary: RunSummary): RunOutcome {
    const outcome = applyRunResult(this.save.campaign, summary);
    this.write();
    return outcome;
  }

  private write(): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      // Storage full or blocked: keep playing with in-memory records.
    }
  }
}
