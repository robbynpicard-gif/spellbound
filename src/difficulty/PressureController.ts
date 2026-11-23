/**
 * D-116: the controlled-chaos pressure controller.
 *
 * A deterministic, skill-responsive layer inside the existing Difficulty
 * Director, bounded by each encounter's authored limits. Every half-second of
 * simulated time it reads what the player is doing and how the field looks:
 * - rolling effective typing rate (correct letters per engaged second);
 * - rolling accuracy;
 * - field workload and urgency (BattlefieldPressure);
 * - Ward breaches;
 * - recent powerful spells.
 *
 * It then nudges one number, the pressure offset L. The offset is damped (a
 * slow integrator with a dead band, so it doesn't oscillate) and clamped to
 * the encounter's bounds. L changes spawn timing, how many scrolls may be on
 * the field together, and the Director's pressure (word length and speed mix),
 * so a strong typist meets more competing demands, not just faster words.
 *
 * Deterministic: it reads only simulation state at fixed ticks, so a replay of
 * the same commands produces the same offsets. It never reads wall-clock time.
 * EXPERIMENTAL values throughout (D-118).
 */
import { measurePressure, type FieldTime, type FieldWord } from './BattlefieldPressure';

/** 'both': Opening Trial and Academy Normal. 'up': Endless (never eases below the escalation). 'off': Hardcore, Sandbox. */
export type AdaptiveMode = 'both' | 'up' | 'off';

export const PRESSURE_CONTROL = {
  /** Simulation ticks between samples (0.5 s at 60 Hz). */
  sampleTicks: 30,
  /** Rolling typing-rate and accuracy time constants, seconds. */
  skillTau: 8,
  accuracyTau: 10,
  /** Assumed typing rate before any evidence: 3 letters/s ≈ 36 WPM. */
  initialCps: 3,
  /**
   * Share of the player's shown typing rate the field should demand: the
   * letter rate needed to clear every scroll before it lands (nearest first,
   * with a short switch between scrolls), divided by the rolling rate.
   */
  targetUtilization: 0.6,
  /** No rise while this many scrolls are already on the field (readability first). */
  maxCalmWords: 10,
  /** No rise in the first seconds of a run: the controller needs evidence first. */
  warmupSeconds: 12,
  /** No change while |error| is inside this band (hysteresis: no oscillation). */
  deadband: 0.12,
  /** Offset units per second at an error of 1. */
  rate: 0.08,
  /** Easing is faster than rising: help arrives quickly, extra pressure builds slowly. */
  easeRate: 0.12,
  /** Urgent scrolls (≤ 4 s from the Ward) beyond which the player is under stress. */
  urgentStress: 2,
  accuracyFloor: 0.9,
  /** After a breach: ease for this many seconds. */
  breachHoldSeconds: 6,
  /** After a powerful spell: no rise for this many seconds (earned breathing room). */
  spellReliefSeconds: 3,
  /** Authored bounds of the offset. `hi` grows across the Academy. */
  bounds: {
    run: { lo: -0.6, hi: [1.1, 1.4] as readonly [number, number] },
    opening: { lo: -0.5, hi: [1, 1] as readonly [number, number] },
    endless: { lo: 0, hi: [1.2, 1.2] as readonly [number, number] },
  },
  /** How the offset acts. */
  effect: {
    /** Spawn interval × exp(−spawn · L). */
    spawn: 1,
    /** Extra scrolls allowed together per unit of L. */
    extraWords: 3,
    /** Added to the Director's pressure (longer, faster mix) per unit of L. */
    pressure: 0.15,
  },
  /** When the field is empty, the next scroll comes at most this long after it emptied. */
  idlePauseMs: 650,
} as const;

export interface ControllerInput {
  tick: number;
  correctChars: number;
  errors: number;
  missed: number;
  words: readonly FieldWord[];
  time: FieldTime;
}

export interface ControllerSnapshot {
  offset: number;
  cps: number;
  accuracy: number;
  utilization: number;
  error: number;
  lo: number;
  hi: number;
}

export interface ControllerEffect {
  spawnScale: number;
  extraWords: number;
  pressureBias: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class PressureController {
  private offset = 0;
  private cps: number = PRESSURE_CONTROL.initialCps;
  private accuracy = 1;
  private last: { tick: number; correct: number; errors: number; missed: number } | null = null;
  private breachUntil = -1;
  private reliefUntil = -1;
  private lastError = 0;
  private startTick = 0;
  private lastUtil = 0;
  private lo = 0;
  private hi = 0;

  constructor(private mode: AdaptiveMode, kind: 'run' | 'opening' | 'endless', apprenticeship: number) {
    this.setBounds(mode, kind, apprenticeship);
  }

  setBounds(mode: AdaptiveMode, kind: 'run' | 'opening' | 'endless', apprenticeship: number): void {
    this.mode = mode;
    const b = PRESSURE_CONTROL.bounds[kind];
    this.lo = mode === 'up' ? 0 : b.lo;
    this.hi = lerp(b.hi[0], b.hi[1], Math.min(1, Math.max(0, apprenticeship)));
    this.offset = Math.min(this.hi, Math.max(this.lo, this.offset));
  }

  get enabled(): boolean {
    return this.mode !== 'off';
  }

  /** A powerful spell just changed the field: let the player enjoy the room it made. */
  noteRelief(tick: number): void {
    this.reliefUntil = Math.max(this.reliefUntil, tick + PRESSURE_CONTROL.spellReliefSeconds * 60);
  }

  sample(i: ControllerInput): void {
    if (!this.enabled) return;
    const P = PRESSURE_CONTROL;
    if (!this.last) {
      this.last = { tick: i.tick, correct: i.correctChars, errors: i.errors, missed: i.missed };
      this.startTick = i.tick;
      return;
    }
    const dt = (i.tick - this.last.tick) / 60;
    if (dt <= 0) return;
    const typed = i.correctChars - this.last.correct;
    const slips = i.errors - this.last.errors;
    const breaches = i.missed - this.last.missed;
    this.last = { tick: i.tick, correct: i.correctChars, errors: i.errors, missed: i.missed };
    if (breaches > 0) this.breachUntil = i.tick + P.breachHoldSeconds * 60;

    // Skill: only engaged time counts (something on the field to type), so an empty field never reads as a slow typist.
    const engaged = i.words.length > 0;
    if (engaged || typed > 0) {
      const k = 1 - Math.exp(-dt / P.skillTau);
      const rate = typed / dt;
      // Typing rate is bounded by supply: only let it pull the estimate down when the field had enough to type.
      if (rate > this.cps || i.words.length >= 2) this.cps += (rate - this.cps) * k;
    }
    if (typed + slips > 0) {
      const k = 1 - Math.exp(-dt / P.accuracyTau);
      this.accuracy += (typed / (typed + slips) - this.accuracy) * k;
    }

    const p = measurePressure(i.words, i.time);
    const util = p.requiredLps / Math.max(1, this.cps);
    let e = P.targetUtilization - util;
    if (p.urgent >= P.urgentStress) e -= 0.25 * (p.urgent - P.urgentStress + 1);
    if (i.words.length >= P.maxCalmWords || i.tick < this.startTick + P.warmupSeconds * 60) e = Math.min(e, 0);
    if (this.accuracy < P.accuracyFloor) e -= (P.accuracyFloor - this.accuracy) * 4;
    if (i.tick < this.breachUntil) e = Math.min(e, -0.5);
    if (i.tick < this.reliefUntil || i.time.frozen) e = Math.min(e, 0);
    e = Math.max(-1.5, Math.min(1, e));
    this.lastError = e;
    this.lastUtil = util;
    if (Math.abs(e) <= P.deadband) return;
    const band = e > 0 ? e - P.deadband : e + P.deadband;
    this.offset += (band > 0 ? P.rate : P.easeRate) * band * dt;
    this.offset = Math.min(this.hi, Math.max(this.lo, this.offset));
  }

  effect(): ControllerEffect {
    if (!this.enabled) return { spawnScale: 1, extraWords: 0, pressureBias: 0 };
    const E = PRESSURE_CONTROL.effect;
    return {
      spawnScale: Math.exp(-E.spawn * this.offset),
      extraWords: Math.round(E.extraWords * this.offset),
      pressureBias: E.pressure * this.offset,
    };
  }

  get snapshot(): ControllerSnapshot {
    return { offset: this.offset, cps: this.cps, accuracy: this.accuracy, utilization: this.lastUtil, error: this.lastError, lo: this.lo, hi: this.hi };
  }
}
