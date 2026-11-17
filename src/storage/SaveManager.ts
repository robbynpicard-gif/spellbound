import type { GameStats } from '../gameplay/ScoringSystem';
import {
  applyRunResult,
  emptyCampaignRecords,
  noteLevelReached,
  type CampaignMode,
  type CampaignRecords,
  type RunOutcome,
  type RunSummary,
} from '../modes/CampaignMode';
import {
  applyPracticeResult,
  emptyPracticeRecord,
  isModifierFilter,
  practiceKey,
  type ModifierFilter,
  type PracticeOutcome,
  type PracticeRecord,
} from '../modes/PracticeMode';

import { sanitizeName } from '../multiplayer/protocol';
import type { GameResult } from '../core/GameEvents';
import { isWizardId, type WizardId } from '../gameplay/Wizards';
import {
  emptyLifetime,
  parseLifetime,
  recordLevelStats,
  recordRunStats,
  type LifetimeStats,
  type PlayMode,
} from './LifetimeStats';

export const SAVE_KEY = 'wizzytype.save';
/** Save written before the game was renamed (read once, then rewritten under SAVE_KEY). */
export const LEGACY_SAVE_KEY = 'spellbound.save';
export const SAVE_VERSION = 4;

/** Practice records live apart from Campaign records (GDD §14). */
export interface PracticeData {
  /** Keyed by practiceKey(level, filter), e.g. "3:original". */
  records: Record<string, PracticeRecord>;
  /** Last setup used, pre-selected next time. */
  lastLevel: number;
  lastFilter: ModifierFilter;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  /** Normal-mode campaign records. */
  campaign: CampaignRecords;
  /** Hardcore campaign records, kept apart from Normal. */
  hardcore: CampaignRecords;
  practice: PracticeData;
  /** Player profile. Added within v3 (missing in older v3 saves → defaults). */
  profile: { name: string; duelLevel: number };
  /** Options. Added within v4 (missing → defaults). */
  /** Player settings: music and sound effects on/off (D-038). */
  settings: AudioSettings;
  /** Everything ever played (D-042). Added within v4 (missing → zeros). */
  lifetime: LifetimeStats;
  /** Wizard picked last time, pre-selected next time. */
  lastWizard: WizardId;
}

export interface AudioSettings {
  music: boolean;
  sfx: boolean;
}

/** The subset of the Web Storage API we use (lets tests pass a fake). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptyPractice(): PracticeData {
  return { records: {}, lastLevel: 1, lastFilter: 'original' };
}

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    campaign: emptyCampaignRecords(),
    hardcore: emptyCampaignRecords(),
    practice: emptyPractice(),
    profile: { name: '', duelLevel: 1 },
    settings: { music: true, sfx: true },
    lifetime: emptyLifetime(),
    lastWizard: 'apprentice',
  };
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
    ...(isWizardId(r.wizard) ? { wizard: r.wizard } : {}),
  };
}

function parseCampaign(c: Record<string, unknown>, totalLevels: number): CampaignRecords {
  return {
    highestReached: clampLevel(c.highestReached, totalLevels),
    bestRun: parseRun(c.bestRun, totalLevels),
    runsStarted: num(c.runsStarted),
    runsCompleted: num(c.runsCompleted),
  };
}

function parsePractice(raw: unknown, totalLevels: number): PracticeData {
  const practice = emptyPractice();
  if (typeof raw !== 'object' || raw === null) return practice;
  const p = raw as Partial<Record<keyof PracticeData, unknown>>;
  practice.lastLevel = clampLevel(p.lastLevel, totalLevels);
  if (isModifierFilter(p.lastFilter)) practice.lastFilter = p.lastFilter;
  if (typeof p.records === 'object' && p.records !== null) {
    for (const [key, r] of Object.entries(p.records as Record<string, unknown>)) {
      if (!/^\d+:(all|original|none)$/.test(key) || typeof r !== 'object' || r === null) continue;
      const rec = emptyPracticeRecord();
      for (const field of Object.keys(rec) as (keyof PracticeRecord)[]) {
        rec[field] = num((r as Record<string, unknown>)[field]);
      }
      rec.bestAccuracy = Math.min(rec.bestAccuracy, 1);
      practice.records[key] = rec;
    }
  }
  return practice;
}

function parseProfile(raw: unknown, totalLevels: number): SaveData['profile'] {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    name: typeof r.name === 'string' ? sanitizeName(r.name).slice(0, 16) : '',
    duelLevel: clampLevel(r.duelLevel, totalLevels),
  };
}

function parseSettings(raw: unknown): SaveData['settings'] {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return { music: typeof r.music === 'boolean' ? r.music : true, sfx: typeof r.sfx === 'boolean' ? r.sfx : true };
}

/**
 * Turns stored text back into SaveData. Anything unreadable yields a fresh
 * save instead of crashing. Older versions are migrated:
 * v1 (per-level campaign) → highest unlocked becomes highest reached;
 * v2 (campaign runs) → kept, practice starts empty;
 * v3 → kept, Hardcore records start empty (v4 added Hardcore).
 */
export function parseSave(raw: string | null, totalLevels: number): SaveData {
  if (!raw) return emptySave();
  try {
    const data = JSON.parse(raw) as {
      version?: number;
      campaign?: Record<string, unknown>;
      hardcore?: unknown;
      practice?: unknown;
    };
    const c = data.campaign;
    if (typeof c !== 'object' || c === null) return emptySave();
    const save = emptySave();

    switch (data.version) {
      case 1:
        save.campaign.highestReached = clampLevel(c.highestUnlocked, totalLevels);
        return save;
      case 2:
        save.campaign = parseCampaign(c, totalLevels);
        return save;
      case 3:
      case SAVE_VERSION:
        save.campaign = parseCampaign(c, totalLevels);
        if (data.version === SAVE_VERSION && typeof data.hardcore === 'object' && data.hardcore !== null)
          save.hardcore = parseCampaign(data.hardcore as Record<string, unknown>, totalLevels);
        save.practice = parsePractice(data.practice, totalLevels);
        save.profile = parseProfile((data as { profile?: unknown }).profile, totalLevels);
        save.settings = parseSettings((data as { settings?: unknown }).settings);
        save.lifetime = parseLifetime((data as { lifetime?: unknown }).lifetime);
        {
          const w = (data as { lastWizard?: unknown }).lastWizard;
          if (isWizardId(w)) save.lastWizard = w;
        }
        return save;
      default:
        return emptySave();
    }
  } catch {
    return emptySave();
  }
}

/** Returns the browser's localStorage, or null if it is blocked (private mode, etc.). */
export function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = '__wizzytype_probe__';
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
      raw = storage?.getItem(SAVE_KEY) ?? storage?.getItem(LEGACY_SAVE_KEY) ?? null;
    } catch {
      raw = null;
    }
    this.save = parseSave(raw, totalLevels);
  }

  get persistent(): boolean {
    return this.storage !== null;
  }

  /** Normal-mode campaign records. */
  get campaign(): Readonly<CampaignRecords> {
    return this.save.campaign;
  }

  get hardcore(): Readonly<CampaignRecords> {
    return this.save.hardcore;
  }

  records(mode: CampaignMode): Readonly<CampaignRecords> {
    return mode === 'hardcore' ? this.save.hardcore : this.save.campaign;
  }

  /** Furthest level reached in either mode (decides which levels Practice offers). */
  get highestReached(): number {
    return Math.max(this.save.campaign.highestReached, this.save.hardcore.highestReached);
  }

  get practice(): Readonly<PracticeData> {
    return this.save.practice;
  }

  private mutable(mode: CampaignMode): CampaignRecords {
    return mode === 'hardcore' ? this.save.hardcore : this.save.campaign;
  }

  noteRunStarted(mode: CampaignMode = 'normal'): void {
    this.mutable(mode).runsStarted++;
    this.write();
  }

  noteLevelReached(level: number, mode: CampaignMode = 'normal'): void {
    noteLevelReached(this.mutable(mode), Math.min(level, this.totalLevels));
    this.write();
  }

  recordRun(summary: RunSummary, mode: CampaignMode = 'normal'): RunOutcome {
    const outcome = applyRunResult(this.mutable(mode), summary);
    recordRunStats(this.save.lifetime, summary);
    this.write();
    return outcome;
  }

  notePracticeChoice(level: number, filter: ModifierFilter): void {
    this.save.practice.lastLevel = Math.min(Math.max(1, level), this.totalLevels);
    this.save.practice.lastFilter = filter;
    this.write();
  }

  get lifetime(): Readonly<LifetimeStats> {
    return this.save.lifetime;
  }

  /** Adds a finished level, Practice session or duel to the lifetime stats. */
  recordLevelStats(stats: GameStats, result: GameResult, context: { mode: PlayMode; boss?: boolean; wizard?: WizardId }): void {
    recordLevelStats(this.save.lifetime, stats, result, context);
    this.write();
  }

  get lastWizard(): WizardId {
    return this.save.lastWizard;
  }

  setLastWizard(wizard: WizardId): void {
    this.save.lastWizard = wizard;
    this.write();
  }

  /** Music and sound effects switches. */
  get audio(): Readonly<AudioSettings> {
    return this.save.settings;
  }

  setAudio(change: Partial<AudioSettings>): Readonly<AudioSettings> {
    this.save.settings = { ...this.save.settings, ...change };
    this.write();
    return this.save.settings;
  }

  get profile(): Readonly<SaveData['profile']> {
    return this.save.profile;
  }

  setProfile(name: string, duelLevel: number): void {
    this.save.profile = {
      name: sanitizeName(name),
      duelLevel: Math.min(Math.max(1, duelLevel), this.totalLevels),
    };
    this.write();
  }

  recordPractice(level: number, filter: ModifierFilter, stats: GameStats): PracticeOutcome {
    const outcome = applyPracticeResult(this.save.practice.records, practiceKey(level, filter), stats);
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
