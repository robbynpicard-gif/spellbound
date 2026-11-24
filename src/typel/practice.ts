/**
 * D-125 Practice suite: pure rules for the Sandbox and Free Type, kept out of
 * the Academy, Arcade and Trials (which never read them).
 *
 * Every number here is EXPERIMENTAL.
 */
import { FIELD } from '../core/GameConfig';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { SPELL_DROP_CHANCE } from '../difficulty/Stages';
import type { SpellCharges, SpellId } from '../gameplay/SpellManager';
import { sandboxConfig, SPELL_ORDER } from './apprenticeship';

// ───────────────────────── Sandbox ─────────────────────────

export type LengthProfile = 'short' | 'mixed' | 'long';

export interface SandboxSettings {
  /** Average milliseconds between new scrolls. */
  spawnMs: number;
  /** Seconds a scroll takes to fall from the top to the Ward. */
  fallSeconds: number;
  lengths: LengthProfile;
  /** Most scrolls on the field at once. */
  maxActive: number;
  /** Pace rises as you capture (default off). */
  escalation: boolean;
  /** Per spell: can it be cast at all, and does it keep its charge. */
  spells: Record<SpellId, { enabled: boolean; unlimited: boolean }>;
  /** Spell scrolls can drop from captured words. */
  drops: boolean;
  /** Off hides score, Combo and Arcane Rush and their feedback. */
  scoring: boolean;
  /** A fixed seed replays the same sky; null = a new one each start. */
  seed: number | null;
}

export const SANDBOX_LIMITS = {
  spawnMs: { min: 300, max: 4000, step: 100 },
  fallSeconds: { min: 3, max: 20, step: 1 },
  maxActive: { min: 1, max: 16, step: 1 },
} as const;

/** Word-length profiles (relative weights by letters). Short follows D-123's early vocabulary. */
export const LENGTH_PROFILES: Record<LengthProfile, Readonly<Record<number, number>>> = {
  short: { 2: 4, 3: 5, 4: 1 },
  mixed: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 1.5, 7: 1, 8: 0.5 },
  long: { 5: 1, 6: 2, 7: 2, 8: 1.5, 9: 1, 10: 0.5 },
};

/** Spells start with this many charges when not unlimited. */
export const SANDBOX_LIMITED_CHARGES = 3;

/** With escalation on: every `perWords` captures, scrolls fall and arrive this much faster. */
export const SANDBOX_ESCALATION = { perWords: 10, speed: 0.04, spawn: 0.05 } as const;

export function defaultSandboxSettings(): SandboxSettings {
  return {
    spawnMs: 1600,
    fallSeconds: 10,
    lengths: 'short',
    maxActive: 8,
    escalation: false,
    spells: Object.fromEntries(SPELL_ORDER.map((s) => [s, { enabled: true, unlimited: true }])) as SandboxSettings['spells'],
    drops: false,
    scoring: true,
    seed: null,
  };
}

const clampTo = (v: number, r: { min: number; max: number }) => Math.min(r.max, Math.max(r.min, Math.round(v)));

/** Normalizes settings into their limits (a stored or edited value can never break the session). */
export function cleanSandboxSettings(s: SandboxSettings): SandboxSettings {
  return {
    ...s,
    spawnMs: clampTo(s.spawnMs, SANDBOX_LIMITS.spawnMs),
    fallSeconds: clampTo(s.fallSeconds, SANDBOX_LIMITS.fallSeconds),
    maxActive: clampTo(s.maxActive, SANDBOX_LIMITS.maxActive),
    lengths: s.lengths in LENGTH_PROFILES ? s.lengths : 'short',
  };
}

export const enabledSpells = (s: SandboxSettings): SpellId[] => SPELL_ORDER.filter((id) => s.spells[id]?.enabled);
export const unlimitedSpells = (s: SandboxSettings): SpellId[] => SPELL_ORDER.filter((id) => s.spells[id]?.enabled && s.spells[id]?.unlimited);

/** The Sandbox battlefield: the classic fixed pace (no Director, no adaptation), shaped only by the settings. */
export function sandboxPracticeConfig(settings: SandboxSettings): DifficultyConfig {
  const s = cleanSandboxSettings(settings);
  const weights = LENGTH_PROFILES[s.lengths];
  const lengths = Object.keys(weights).map(Number);
  const base = sandboxConfig('normal', 1);
  return {
    ...base,
    name: 'Sandbox',
    requiredWords: null,
    survivalMs: undefined,
    rampWords: null,
    spawnRamp: undefined,
    speedRamp: 0,
    speedRampExtra: 0,
    initialFallSpeed: FIELD.height / s.fallSeconds,
    spawnInterval: s.spawnMs,
    maxActiveWords: s.maxActive,
    minWordLength: Math.min(...lengths),
    maxWordLength: Math.max(...lengths),
    wordLengthWeights: weights,
    escalation: s.escalation ? { ...SANDBOX_ESCALATION } : undefined,
    availableSpells: enabledSpells(s),
    spellDropChance: s.drops ? SPELL_DROP_CHANCE : 0,
    introducesSpell: null,
    director: undefined,
    openingWords: 0,
  };
}

/** Starting bank: one charge for unlimited spells (it is restored after each cast), a few for limited ones, none for disabled. */
export function sandboxStartingBank(s: SandboxSettings): Partial<SpellCharges> {
  const bank: Partial<SpellCharges> = {};
  for (const id of SPELL_ORDER) {
    const o = s.spells[id];
    if (!o?.enabled) continue;
    bank[id] = o.unlimited ? 1 : SANDBOX_LIMITED_CHARGES;
  }
  return bank;
}

// ───────────────────────── Free Type ─────────────────────────

/**
 * Free Type speed (D-125). Five characters = one standard word.
 *
 * - Only typed insertions count (letters, spaces, punctuation, line breaks);
 *   pastes and deletions don't.
 * - Active time excludes thinking pauses: a gap longer than `pauseMs`
 *   between keystrokes adds nothing.
 * - Rolling WPM uses the last `windowMs` of active time and is only valid
 *   once a full window has been typed, so the first keystrokes can't set an
 *   absurd peak or low.
 * - Peak and lowest track the valid rolling value while typing.
 * - No accuracy: there is no reference text.
 */
export const FREE_TYPE_TUNING = { windowMs: 10_000, pauseMs: 5_000, minWindowChars: 10 } as const;

export interface FreeTypeStats {
  /** Rolling WPM over the last window of active time; null until valid. */
  rolling: number | null;
  /** Average WPM over all active time; null until a full window is typed. */
  average: number | null;
  peak: number | null;
  lowest: number | null;
  /** Characters typed (insertions counted for speed). */
  typedChars: number;
  activeMs: number;
  /** A pause is in progress (no keystroke for longer than the threshold). */
  paused: boolean;
}

export class WpmTracker {
  /** Keystrokes on the active-time axis: [activeMs, chars]. */
  private events: [number, number][] = [];
  private lastKeyMs: number | null = null;
  private active = 0;
  private chars = 0;
  private peak: number | null = null;
  private lowest: number | null = null;

  constructor(private readonly t: { windowMs: number; pauseMs: number; minWindowChars: number } = FREE_TYPE_TUNING) {}

  /** A typed insertion of `chars` characters at wall time `nowMs`. */
  key(nowMs: number, chars = 1): void {
    if (chars <= 0) return;
    if (this.lastKeyMs !== null) {
      const gap = nowMs - this.lastKeyMs;
      if (gap > 0 && gap <= this.t.pauseMs) this.active += gap;
    }
    this.lastKeyMs = nowMs;
    this.chars += chars;
    this.events.push([this.active, chars]);
    // keep only what the window can still see
    const from = this.active - this.t.windowMs;
    while (this.events.length > 1 && this.events[0]![0] < from) this.events.shift();
    this.track();
  }

  private rollingAt(): number | null {
    if (this.active < this.t.windowMs) return null;
    const from = this.active - this.t.windowMs;
    let n = 0;
    for (const [at, c] of this.events) if (at > from) n += c;
    if (n < this.t.minWindowChars) return null;
    return n / 5 / (this.t.windowMs / 60_000);
  }

  private track(): void {
    const r = this.rollingAt();
    if (r === null) return;
    this.peak = this.peak === null ? r : Math.max(this.peak, r);
    this.lowest = this.lowest === null ? r : Math.min(this.lowest, r);
  }

  stats(nowMs: number): FreeTypeStats {
    const paused = this.lastKeyMs === null || nowMs - this.lastKeyMs > this.t.pauseMs;
    return {
      rolling: paused ? null : this.rollingAt(),
      average: this.active >= this.t.windowMs ? this.chars / 5 / (this.active / 60_000) : null,
      peak: this.peak,
      lowest: this.lowest,
      typedChars: this.chars,
      activeMs: this.active,
      paused,
    };
  }

  reset(): void {
    this.events = [];
    this.lastKeyMs = null;
    this.active = 0;
    this.chars = 0;
    this.peak = null;
    this.lowest = null;
  }
}

/** Word count for a free text: runs of letters/digits (apostrophes and hyphens inside words count as one word). */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
}
