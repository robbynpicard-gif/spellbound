import { triumphProgress } from '../gameplay/Triumphs';
import { parseWard } from '../gameplay/WardScar';
import { earnedRuneIds } from '../ui/screens';
import type { GameStats } from '../gameplay/ScoringSystem';
import {
  applyRunResult,
  CAMPAIGN_MODES,
  emptyCampaignRecords,
  isCampaignMode,
  noteLevelReached,
  type CampaignMode,
  type CampaignRecords,
  type CampaignRun,
  type RunOutcome,
  type RunSummary,
} from '../modes/CampaignMode';
import { DISCOVERY_ORDER, STAGE_COUNT, STAGE_LEVELS } from '../difficulty/Stages';
import { isSpellId, sanitizeCharges, SPELL_IDS, type SpellId } from '../gameplay/SpellManager';
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
/** v5 (D-047): the Campaign became 2 modes × 5 stages × 20 levels. */
export const SAVE_VERSION = 5;

/** A level of the Campaign: which mode, which stage, which level of it. */
export interface LevelPick {
  mode: CampaignMode;
  stage: number;
  level: number;
}

/** Practice records live apart from Campaign records (GDD §14). */
export interface PracticeData {
  /** Keyed by practiceKey(pick, filter), e.g. "normal:2:7:original". */
  records: Record<string, PracticeRecord>;
  /** Last setup used, pre-selected next time. */
  last: LevelPick;
  lastFilter: ModifierFilter;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  /** Records per mode and stage: `stages.normal[0]` is Normal stage 1. */
  stages: Record<CampaignMode, CampaignRecords[]>;
  /** A stage run in progress, saved between levels so it can be continued. */
  savedRun: CampaignRun | null;
  /** Records from the old 20-level campaign were cleared; tell the player once. */
  resetNotice: boolean;
  practice: PracticeData;
  /** Player profile. Added within v3 (missing in older v3 saves → defaults). */
  profile: { name: string; duelLevel: number };
  /** Options. Added within v4 (missing → defaults). */
  /** Player settings: music and sound effects on/off (D-038). */
  settings: AudioSettings;
  /** Everything ever played (D-042). Added within v4 (missing → zeros). */
  lifetime: LifetimeStats;
  /** Spell on each number key, 1–8 (Normal quick-cast). Added within v5. */
  spellSlots: SpellId[];
  /** Persistent Rune seal counts; additive within save version 5. */
  runeCounts: Record<string, number>;
  /** Cosmetic-only featured Triumph, null until selected. */
  featuredTriumph: string | null;
  /** Featured Rune and chosen unlocked seal finish, cosmetic only. */
  featuredRune: string | null;
  runeFinish: 'wax' | 'bronze' | 'silver' | 'gold';
}

export interface AudioSettings {
  music: boolean;
  sfx: boolean;
  /** Announcer channel (D-053): its own switch and volume. */
  voice: boolean;
  /** Volumes 0–100. */
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
}

export const DEFAULT_AUDIO: AudioSettings = { music: true, sfx: true, voice: true, masterVolume: 100, musicVolume: 80, sfxVolume: 80, voiceVolume: 80 };

/** The subset of the Web Storage API we use (lets tests pass a fake). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptyPractice(): PracticeData {
  return { records: {}, last: { mode: 'normal', stage: 1, level: 1 }, lastFilter: 'original' };
}

export function emptyStages(): Record<CampaignMode, CampaignRecords[]> {
  const stages = () => Array.from({ length: STAGE_COUNT }, () => emptyCampaignRecords());
  return { normal: stages(), hardcore: stages() };
}

export function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    stages: emptyStages(),
    savedRun: null,
    resetNotice: false,
    practice: emptyPractice(),
    profile: { name: '', duelLevel: 1 },
    settings: { ...DEFAULT_AUDIO },
    lifetime: emptyLifetime(),
    spellSlots: [...DISCOVERY_ORDER],
    runeCounts: {},
    featuredTriumph: null,
    featuredRune: null,
    runeFinish: 'wax',
  };
}

/** A valid layout uses each of the 8 spells exactly once; anything else falls back to the default. */
export function parseSpellSlots(raw: unknown): SpellId[] {
  if (!Array.isArray(raw) || raw.length !== SPELL_IDS.length) return [...DISCOVERY_ORDER];
  const ok = raw.every((id) => isSpellId(id)) && new Set(raw).size === SPELL_IDS.length;
  return ok ? (raw as SpellId[]) : [...DISCOVERY_ORDER];
}

const RUNE_IDS = ['volley', 'precision', 'chain', 'scribe'] as const;
/** Repeat Rune seals unlock cosmetic finishes at 5, 20 and 50 earned. */
export function isRuneFinishUnlocked(count: number, finish: SaveData['runeFinish']): boolean {
  return count >= ({ wax: 1, bronze: 5, silver: 20, gold: 50 }[finish]);
}

export function parseRuneCounts(raw: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const id of RUNE_IDS) {
    const count = (raw as Record<string, unknown>)[id];
    if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0)
      result[id] = Math.min(count, 1_000_000);
  }
  return result;
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
    ...(typeof r.stage === 'number' ? { stage: clampStage(r.stage) } : {}),
  };
}

const clampStage = (v: unknown): number => Math.min(Math.max(Math.floor(num(v, 1)), 1), STAGE_COUNT);

function parseStages(raw: unknown): Record<CampaignMode, CampaignRecords[]> {
  const out = emptyStages();
  if (typeof raw !== 'object' || raw === null) return out;
  for (const mode of CAMPAIGN_MODES) {
    const list = (raw as Record<string, unknown>)[mode];
    if (!Array.isArray(list)) continue;
    list.slice(0, STAGE_COUNT).forEach((c, i) => {
      if (typeof c === 'object' && c !== null) out[mode][i] = parseCampaign(c as Record<string, unknown>, STAGE_LEVELS);
    });
  }
  return out;
}

/** A saved run in progress: kept only if every field makes sense. */
function parseSavedRun(raw: unknown): CampaignRun | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isCampaignMode(r.mode)) return null;
  const t = (typeof r.totals === 'object' && r.totals !== null ? r.totals : {}) as Record<string, unknown>;
  return {
    mode: r.mode,
    stage: clampStage(r.stage),
    level: clampLevel(r.level, STAGE_LEVELS),
    instability: Math.min(num(r.instability), 99),
    ...(r.wardCap !== undefined ? (({ cap, wagers }) => ({ wardCap: cap, wardWagers: wagers }))(parseWard(r.wardCap, r.wardWagers)) : {}),
    score: num(r.score),
    levelsCleared: Math.min(num(r.levelsCleared), STAGE_LEVELS),
    spellCharges: sanitizeCharges(r.spellCharges as never),
    combo: Math.floor(num(r.combo)),
    cleanStreak: Math.floor(num(r.cleanStreak)),
    totals: {
      completed: num(t.completed),
      missed: num(t.missed),
      correctChars: num(t.correctChars),
      errors: num(t.errors),
      elapsedMs: num(t.elapsedMs),
      maxCombo: num(t.maxCombo),
    },
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

function parsePractice(raw: unknown): PracticeData {
  const practice = emptyPractice();
  if (typeof raw !== 'object' || raw === null) return practice;
  const p = raw as Partial<Record<keyof PracticeData, unknown>>;
  if (typeof p.last === 'object' && p.last !== null) {
    const l = p.last as Record<string, unknown>;
    if (isCampaignMode(l.mode)) practice.last = { mode: l.mode, stage: clampStage(l.stage), level: clampLevel(l.level, STAGE_LEVELS) };
  }
  if (isModifierFilter(p.lastFilter)) practice.lastFilter = p.lastFilter;
  if (typeof p.records === 'object' && p.records !== null) {
    for (const [key, r] of Object.entries(p.records as Record<string, unknown>)) {
      if (!/^(normal|hardcore):[1-5]:\d+:(all|original|none)$/.test(key) || typeof r !== 'object' || r === null) continue;
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
  const flag = (k: 'music' | 'sfx' | 'voice') => (typeof r[k] === 'boolean' ? (r[k] as boolean) : DEFAULT_AUDIO[k]);
  const vol = (k: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'voiceVolume') =>
    typeof r[k] === 'number' && Number.isFinite(r[k]) ? Math.round(Math.min(100, Math.max(0, r[k] as number))) : DEFAULT_AUDIO[k];
  return { music: flag('music'), sfx: flag('sfx'), voice: flag('voice'), masterVolume: vol('masterVolume'), musicVolume: vol('musicVolume'), sfxVolume: vol('sfxVolume'), voiceVolume: vol('voiceVolume') };
}

/**
 * Turns stored text back into SaveData. Anything unreadable yields a fresh
 * save instead of crashing.
 * - v5: the stage campaign (D-047).
 * - v1–v4 (the old 20-level campaign): campaign and practice records no longer
 *   match any level and are cleared (the player is told once); settings,
 *   profile, settings and lifetime stats are kept where present.
 */
export function parseSave(raw: string | null, totalLevels: number): SaveData {
  if (!raw) return emptySave();
  try {
    const data = JSON.parse(raw) as Record<string, unknown> & { version?: number };
    if (typeof data !== 'object' || data === null) return emptySave();
    const save = emptySave();
    const keepShared = () => {
      save.profile = parseProfile(data.profile, totalLevels);
      save.settings = parseSettings(data.settings);
      save.lifetime = parseLifetime(data.lifetime);
      save.spellSlots = parseSpellSlots(data.spellSlots);
      save.runeCounts = parseRuneCounts(data.runeCounts);
      save.featuredTriumph = typeof data.featuredTriumph === 'string' && ['scribe', 'journey', 'victory', 'precision', 'chain', 'volley', 'alliteration', 'librarian', 'metronome', 'sweep', 'nouns', 'verbs', 'adjectives', 'adverbs', 'awakening', 'illumination', 'incantation'].includes(data.featuredTriumph) ? data.featuredTriumph : null;
      save.featuredRune = typeof data.featuredRune === 'string' && (save.runeCounts[data.featuredRune] ?? 0) > 0 ? data.featuredRune : null;
      save.runeFinish = ['wax', 'bronze', 'silver', 'gold'].includes(String(data.runeFinish)) ? data.runeFinish as SaveData['runeFinish'] : 'wax';
      if (save.featuredRune && !isRuneFinishUnlocked(save.runeCounts[save.featuredRune] ?? 0, save.runeFinish)) save.runeFinish = 'wax';
    };
    if (data.version === SAVE_VERSION) {
      keepShared();
      save.stages = parseStages(data.stages);
      save.savedRun = parseSavedRun(data.savedRun);
      save.resetNotice = data.resetNotice === true;
      save.practice = parsePractice(data.practice);
      return save;
    }
    if (typeof data.version === 'number' && data.version >= 1 && data.version < SAVE_VERSION) {
      if (data.version >= 3) keepShared();
      save.resetNotice = true;
      return save;
    }
    return emptySave();
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

  /** Records for one stage of one mode. */
  records(mode: CampaignMode, stage: number): Readonly<CampaignRecords> {
    return this.mutable(mode, stage);
  }

  /** Stage 1 is always open; each later stage opens when the one before it is cleared. */
  stageUnlocked(mode: CampaignMode, stage: number): boolean {
    return stage === 1 || (stage >= 2 && stage <= STAGE_COUNT && this.mutable(mode, stage - 1).runsCompleted > 0);
  }

  /** Best run score over every stage of a mode (for the menus), or null. */
  bestScore(mode?: CampaignMode): number | null {
    const modes = mode ? [mode] : CAMPAIGN_MODES;
    let best: number | null = null;
    for (const m of modes) for (const r of this.save.stages[m]) if (r.bestRun) best = Math.max(best ?? 0, r.bestRun.score);
    return best;
  }

  get practice(): Readonly<PracticeData> {
    return this.save.practice;
  }

  private mutable(mode: CampaignMode, stage: number): CampaignRecords {
    return this.save.stages[mode][Math.min(Math.max(1, stage), STAGE_COUNT) - 1]!;
  }

  noteRunStarted(mode: CampaignMode, stage: number): void {
    this.mutable(mode, stage).runsStarted++;
    this.write();
  }

  noteLevelReached(mode: CampaignMode, stage: number, level: number): void {
    noteLevelReached(this.mutable(mode, stage), Math.min(level, STAGE_LEVELS));
    this.write();
  }

  recordRun(summary: RunSummary, mode: CampaignMode): RunOutcome {
    const outcome = applyRunResult(this.mutable(mode, summary.stage ?? 1), summary);
    recordRunStats(this.save.lifetime, summary);
    this.write();
    return outcome;
  }

  /** The run in progress, to continue later (null if none). */
  get savedRun(): Readonly<CampaignRun> | null {
    return this.save.savedRun;
  }

  /** Saves (a copy of) the run in progress between levels, or clears it with null. */
  /** Testing (D-055): clears Campaign progress and the saved run, for a fresh-run experience. */
  resetCampaign(): void {
    this.save.stages = emptyStages();
    this.save.savedRun = null;
    this.write();
  }

  setSavedRun(run: CampaignRun | null): void {
    this.save.savedRun = run ? (JSON.parse(JSON.stringify(run)) as CampaignRun) : null;
    this.write();
  }

  /** True once after old campaign records were cleared; reading it clears the flag. */
  takeResetNotice(): boolean {
    if (!this.save.resetNotice) return false;
    this.save.resetNotice = false;
    this.write();
    return true;
  }

  notePracticeChoice(pick: LevelPick, filter: ModifierFilter): void {
    this.save.practice.last = { ...pick };
    this.save.practice.lastFilter = filter;
    this.write();
  }

  /** Spell on each number key (index 0 = key 1). */
  get spellSlots(): readonly SpellId[] {
    return this.save.spellSlots;
  }

  setSpellSlots(slots: readonly SpellId[]): void {
    this.save.spellSlots = parseSpellSlots([...slots]);
    this.write();
  }

  get featuredTriumph(): string | null { return this.save.featuredTriumph; }

  /** Only unlocked Bronze-or-higher Triumphs can be displayed as a title. */
  setFeaturedTriumph(id: string | null): void {
    if (id !== null && !triumphProgress(this.save.lifetime).some((t) => t.id === id && t.tier > 0)) return;
    this.save.featuredTriumph = id;
    this.write();
  }

  get featuredRune(): string | null { return this.save.featuredRune; }
  get runeFinish(): SaveData['runeFinish'] { return this.save.runeFinish; }

  setFeaturedRune(id: string | null): void {
    if (id !== null && (this.save.runeCounts[id] ?? 0) < 1) return;
    this.save.featuredRune = id;
    this.save.runeFinish = 'wax';
    this.write();
  }

  setRuneFinish(finish: SaveData['runeFinish']): void {
    if (!this.save.featuredRune || !isRuneFinishUnlocked(this.save.runeCounts[this.save.featuredRune] ?? 0, finish)) return;
    this.save.runeFinish = finish;
    this.write();
  }

  get runeCounts(): Readonly<Record<string, number>> {
    return { ...this.save.runeCounts };
  }

  /** A completed session can earn each Rune once. Never grant on failed/abandoned Campaign levels. */
  recordRunes(stats: GameStats): string[] {
    const earned = earnedRuneIds(stats);
    for (const id of earned) this.save.runeCounts[id] = Math.min(1_000_000, (this.save.runeCounts[id] ?? 0) + 1);
    if (earned.length) this.write();
    return earned;
  }

  get lifetime(): Readonly<LifetimeStats> {
    return this.save.lifetime;
  }

  /** Adds a finished level, Practice session or duel to the lifetime stats. */
  recordLevelStats(stats: GameStats, result: GameResult, context: { mode: PlayMode; boss?: boolean }): void {
    recordLevelStats(this.save.lifetime, stats, result, context);
    this.write();
  }

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

  recordPractice(pick: LevelPick, filter: ModifierFilter, stats: GameStats): PracticeOutcome {
    const outcome = applyPracticeResult(this.save.practice.records, practiceKey(pick, filter), stats);
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
