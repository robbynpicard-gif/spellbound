import type { SpellId } from '../gameplay/SpellManager';
import { Music, type Mood } from './Music';
import { midi, Synth } from './synth';
import type { WizardId } from '../gameplay/Wizards';

export type { Mood } from './Music';

/**
 * All sound (decisions.md D-038, D-041): a dynamic score plus sound effects,
 * synthesised with the Web Audio API. Music and sound effects are separate
 * buses, switched independently. Browsers allow sound only after a click or key
 * press, so the context is created by `unlock()` on the first gesture.
 *
 * Sound-effect principles:
 * - Everything is tuned to the score (D minor pentatonic), so effects sit
 *   inside the music instead of on top of it.
 * - Rewards rise: each capture in a combo plays the next note up the scale
 *   (Peggle's rising bounce, Balatro's climbing ticks); a miss resets it.
 * - Repetition is varied: every key and capture has small random changes in
 *   pitch, level and timing, so a thousand keystrokes never sound identical.
 * - Mistakes are soft and wooden, never harsh: the game should feel fair.
 * - Spells sound like their element: fire crackles, ice cracks and chimes,
 *   shock buzzes, wind gusts.
 */

/** D minor pentatonic over three octaves (MIDI), for anything that climbs. */
const PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89, 91, 93, 96];

class AudioEngine {
  private ctx: BaseAudioContext | null = null;
  private sy!: Synth;
  private music!: Music;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private musicOn = true;
  private sfxOn = true;
  private pending: { mood: Mood; stress: number; heat: number } = { mood: 'menu', stress: 0, heat: 0 };
  private lastKey = 0;

  /** Call from any user gesture; safe to call repeatedly. */
  unlock(): void {
    const live = this.ctx as AudioContext | null;
    if (live) {
      if (live.state === 'suspended') void live.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
    this.attach(ctx, true);
  }

  /** Wires the buses and starts the score. `realtime` false is for offline rendering (samples, tests). */
  attach(ctx: BaseAudioContext, realtime: boolean): void {
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.6 : 0;
    this.sfxBus.gain.value = this.sfxOn ? 0.75 : 0;
    this.musicBus.connect(master);
    this.sfxBus.connect(master);
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    wet.connect(master);
    this.sy = new Synth(ctx, wet);
    this.music = new Music(this.sy, this.musicBus);
    this.music.set(this.pending);
    this.music.start(ctx.currentTime + 0.1, realtime);
  }

  /** Offline rendering: schedule the score up to `time`. */
  renderMusicUntil(time: number): void {
    this.music?.scheduleUntil(time);
  }

  /** Offline rendering: pretend "now" is `time` for the next sound effect. */
  at(time: number): this {
    this.clock = time;
    return this;
  }

  private clock: number | null = null;

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.3);
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.75 : 0, this.ctx.currentTime, 0.05);
  }

  /** Menu, a level, or a boss: changes tempo and ensemble at the next bar. */
  setMood(mood: Mood): void {
    this.update({ mood });
  }

  /** The ward's instability stage (0–4): darkens the score bar by bar. */
  setStress(stage: number): void {
    this.update({ stress: Math.min(3, Math.max(0, stage)) });
  }

  /** The combo multiplier tier (0–4): brightens the score. */
  setHeat(tier: number): void {
    this.update({ heat: Math.min(4, Math.max(0, tier)) });
  }

  private update(change: Partial<{ mood: Mood; stress: number; heat: number }>): void {
    this.pending = { ...this.pending, ...change };
    this.music?.set(change);
  }

  private get t(): number {
    if (this.clock !== null) {
      const c = this.clock;
      this.clock = null;
      return c;
    }
    return this.ctx!.currentTime;
  }

  private get ready(): boolean {
    return this.ctx !== null && this.sfxOn;
  }

  private vary(x: number, amount: number): number {
    return x * (1 + (Math.random() * 2 - 1) * amount);
  }

  // ───────────────────────── typing ─────────────────────────

  /** A typewriter key: a sharp strike, a wooden thock, then the typebar's clack against the platen. */
  key(): void {
    if (!this.ready) return;
    const now = this.t;
    if (this.clock === null && now - this.lastKey < 0.025 && now > this.lastKey) return;
    this.lastKey = now;
    const sy = this.sy, out = this.sfxBus;
    sy.noiseHit(out, now, 0.012, this.vary(0.32, 0.15), { type: 'bandpass', freq: this.vary(3200, 0.12), q: 1.4 });
    sy.tone(out, now, this.vary(190, 0.06), 0.045, this.vary(0.16, 0.15), { glideTo: 120, filter: { type: 'lowpass', freq: 900 } });
    const clack = now + this.vary(0.022, 0.25);
    sy.noiseHit(out, clack, 0.02, this.vary(0.22, 0.2), { type: 'highpass', freq: this.vary(1900, 0.1) });
    sy.tone(out, clack, this.vary(820, 0.05), 0.03, 0.04, { type: 'square', filter: { type: 'bandpass', freq: 1200, q: 6 } });
  }

  /** A slip of the finger: a dull wooden knock (the combo survives it). */
  typo(): void {
    if (!this.ready) return;
    const now = this.t;
    this.sy.tone(this.sfxBus, now, 140, 0.09, 0.2, { glideTo: 95, filter: { type: 'lowpass', freq: 700 } });
    this.sy.noiseHit(this.sfxBus, now, 0.04, 0.1, { type: 'bandpass', freq: 600, q: 2 });
  }

  /** Enter on a wrong word: crumpled paper and a falling two-note sigh. */
  wrongEntry(): void {
    if (!this.ready) return;
    const now = this.t;
    for (let k = 0; k < 5; k++) this.sy.noiseHit(this.sfxBus, now + k * 0.025 + Math.random() * 0.01, 0.03, 0.12, { type: 'bandpass', freq: 2500 + Math.random() * 2500, q: 2 });
    this.sy.tone(this.sfxBus, now + 0.04, midi(69), 0.25, 0.09, { type: 'triangle' });
    this.sy.tone(this.sfxBus, now + 0.18, midi(66), 0.35, 0.08, { type: 'triangle', glideTo: midi(64) });
  }

  /** Kept for older call sites. */
  error(): void {
    this.typo();
  }

  // ───────────────────────── rewards ─────────────────────────

  /**
   * A scroll captured: an inked stamp, then a chime one step higher than the
   * last (the combo climbs the scale), then a tick per bonus, each a little
   * higher and quicker.
   */
  capture(combo: number, bonuses: readonly string[] = []): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    sy.tone(out, now, 120, 0.08, 0.18, { glideTo: 70, filter: { type: 'lowpass', freq: 500 } });
    sy.noiseHit(out, now, 0.05, 0.1, { type: 'bandpass', freq: 1400, q: 1 });
    const step = Math.max(0, combo - 1);
    const n = PENTA[Math.min(PENTA.length - 1, step % 12)]! + (step >= 12 ? 12 : 0);
    sy.tone(out, now + 0.01, midi(n), 0.6, 0.14, { type: 'triangle', send: 0.35 });
    sy.tone(out, now + 0.01, midi(n + 12), 0.4, 0.05, { type: 'sine', send: 0.35 });
    const special = bonuses.filter((b) => b !== 'perfect' && b !== 'quick');
    special.forEach((_, k) => {
      const tn = midi(PENTA[Math.min(PENTA.length - 1, 6 + k * 2)]! + 12);
      sy.tone(out, now + 0.09 + k * 0.06 * (1 - k * 0.1), tn, 0.25, 0.06, { type: 'sine', send: 0.4 });
    });
    if (bonuses.includes('clutch')) sy.bell(out, now + 0.05, midi(93), 0.06, 0.5, 1.6);
    if (bonuses.includes('sweep')) [0, 2, 4, 5, 7].forEach((s, k) => sy.tone(out, now + 0.1 + k * 0.05, midi(PENTA[s + 5]! + 12), 0.5, 0.06, { type: 'triangle', send: 0.5 }));
  }

  /** A new multiplier tier: a brass stab and a bell, grander each tier, in the music's key. */
  tierUp(tier: number): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    const chord = [62, 65, 69, 74, 77].slice(0, 2 + tier);
    chord.forEach((n, k) => {
      sy.tone(out, now + k * 0.045, midi(n - 12), 0.55, 0.08, { type: 'sawtooth', attack: 0.02, filter: { type: 'lowpass', freq: 600, to: 2400 + tier * 600 }, send: 0.3 });
      sy.tone(out, now + k * 0.045, midi(n), 0.45, 0.05, { type: 'triangle', send: 0.3 });
    });
    sy.bell(out, now + chord.length * 0.045, midi(tier >= 3 ? 86 : 81), 0.1, 0.5, 2.8);
    if (tier >= 4) sy.noiseHit(out, now, 1.4, 0.18, { type: 'bandpass', freq: 400, to: 7000, q: 0.7 }, { attack: 0.05, send: 0.5 });
    this.setHeat(tier);
  }

  /** The multiplier slipped a tier: a muted slide down. */
  tierDown(tier = 0): void {
    if (!this.ready) return;
    this.sy.tone(this.sfxBus, this.t, midi(57), 0.5, 0.1, { type: 'sawtooth', glideTo: midi(45), filter: { type: 'lowpass', freq: 900 } });
    this.setHeat(tier);
  }

  // ───────────────────────── harm ─────────────────────────

  /** A scroll broke through the ward: a stone crack, a low boom, the ward humming. */
  miss(): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    sy.noiseHit(out, now, 0.12, 0.35, { type: 'highpass', freq: 1800 });
    for (let k = 0; k < 4; k++) sy.noiseHit(out, now + 0.02 + k * 0.03, 0.03, 0.18, { type: 'bandpass', freq: 3000 + Math.random() * 3000, q: 3 });
    sy.tone(out, now, 72, 0.7, 0.4, { glideTo: 38, filter: { type: 'lowpass', freq: 220 }, send: 0.3 });
    sy.tone(out, now + 0.05, midi(63), 0.9, 0.05, { type: 'sawtooth', drive: 3, filter: { type: 'bandpass', freq: 900, q: 3 }, send: 0.4 });
  }

  /** A miss stopped by the barrier: a ringing shield. */
  blocked(): void {
    if (!this.ready) return;
    const now = this.t;
    this.sy.noiseHit(this.sfxBus, now, 0.06, 0.25, { type: 'highpass', freq: 2500 });
    this.sy.bell(this.sfxBus, now, midi(74), 0.1, 0.5, 2.2);
  }

  /** A spell scroll captured: parchment unrolling and a rising shimmer. */
  pickup(): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    sy.noiseHit(out, now, 0.25, 0.1, { type: 'bandpass', freq: 1800, to: 4200, q: 1.5 });
    [0, 2, 4, 5].forEach((s, k) => sy.tone(out, now + 0.05 + k * 0.05, midi(PENTA[s + 4]! + 12), 0.4, 0.06, { type: 'triangle', send: 0.5 }));
  }

  // ───────────────────────── spells ─────────────────────────

  /** Casting: each spell sounds like its element. */
  cast(spell: SpellId): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    switch (spell) {
      case 'fire': {
        sy.noiseHit(out, now, 0.6, 0.35, { type: 'bandpass', freq: 300, to: 3000, q: 0.8 }, { attack: 0.03 }); // ignition whoosh
        sy.noiseHit(out, now + 0.1, 1.6, 0.3, { type: 'lowpass', freq: 600, to: 200 }, { attack: 0.2, curve: 'lin', send: 0.3 }); // roar
        for (let k = 0; k < 28; k++) {
          const tt = now + 0.1 + Math.random() * 1.5; // crackle
          sy.noiseHit(out, tt, 0.006 + Math.random() * 0.01, 0.15 + Math.random() * 0.2, { type: 'highpass', freq: 1500 + Math.random() * 4000 });
        }
        sy.tone(out, now, 80, 1.2, 0.18, { type: 'sawtooth', glideTo: 55, filter: { type: 'lowpass', freq: 300 }, drive: 2 });
        break;
      }
      case 'ice': {
        for (let k = 0; k < 14; k++) sy.noiseHit(out, now + k * 0.025 + Math.random() * 0.02, 0.015, 0.2, { type: 'highpass', freq: 5000 + Math.random() * 3000 }); // freezing crackle
        [93, 98, 101, 105].forEach((n, k) => sy.tone(out, now + 0.15 + k * 0.07, midi(n) * 1.007, 1.6, 0.05, { type: 'sine', send: 0.6 })); // glassy chimes
        sy.tone(out, now + 0.3, 420, 1.0, 0.04, { type: 'sawtooth', glideTo: 260, filter: { type: 'bandpass', freq: 900, q: 8 } }); // creak
        break;
      }
      case 'shock': {
        sy.tone(out, now, 58, 0.7, 0.16, { type: 'square', drive: 6, filter: { type: 'bandpass', freq: 1200, q: 1 } }); // electric buzz
        for (let k = 0; k < 6; k++) {
          const tt = now + 0.05 + k * 0.08 + Math.random() * 0.04;
          sy.tone(out, tt, 2400 + Math.random() * 1500, 0.06, 0.08, { type: 'square', glideTo: 300, drive: 4 }); // zaps
          sy.noiseHit(out, tt, 0.03, 0.2, { type: 'highpass', freq: 3500 });
        }
        sy.noiseHit(out, now, 0.4, 0.15, { type: 'bandpass', freq: 5000, q: 0.6 });
        break;
      }
      case 'slow': {
        sy.tone(out, now, midi(74), 1.3, 0.12, { type: 'sawtooth', glideTo: midi(50), filter: { type: 'lowpass', freq: 2400, to: 400 }, send: 0.4 }); // tape stop
        [0, 0.45, 1.0, 1.65].forEach((dt, k) => sy.noiseHit(out, now + dt, 0.03, 0.12 - k * 0.02, { type: 'bandpass', freq: 1500, q: 5 })); // slowing tick-tock
        break;
      }
      case 'barrier': {
        sy.tone(out, now, midi(38), 1.2, 0.12, { type: 'sawtooth', attack: 0.25, filter: { type: 'lowpass', freq: 400, to: 1200 } }); // rising hum
        sy.bell(out, now + 0.25, midi(50), 0.16, 0.6, 3.2); // gong
        break;
      }
      case 'alter': {
        sy.noiseHit(out, now, 0.5, 0.18, { type: 'bandpass', freq: 800, to: 5000, q: 2 }, { attack: 0.45, curve: 'lin' }); // reversed swell
        sy.tone(out, now, midi(69), 0.55, 0.08, { type: 'sine', attack: 0.45, glideTo: midi(81), send: 0.5 });
        for (let k = 0; k < 3; k++) sy.noiseHit(out, now + 0.5 + k * 0.07, 0.05, 0.12, { type: 'bandpass', freq: 2500, q: 1.5 }); // page flips
        break;
      }
      case 'wind': {
        sy.noiseHit(out, now, 1.8, 0.3, { type: 'bandpass', freq: 250, to: 1400, q: 3 }, { attack: 0.4, curve: 'lin', send: 0.4 }); // gust
        sy.noiseHit(out, now + 0.3, 1.4, 0.18, { type: 'bandpass', freq: 1400, to: 500, q: 4 }, { attack: 0.3, curve: 'lin' });
        sy.tone(out, now + 0.2, midi(86), 1.2, 0.03, { type: 'sine', attack: 0.4, glideTo: midi(81), send: 0.5 }); // whistle
        break;
      }
      case 'harvest': {
        for (let k = 0; k < 8; k++) sy.noiseHit(out, now + k * 0.06, 0.06, 0.1, { type: 'bandpass', freq: 2000 + k * 300, q: 1.2 }); // gathering pages
        [0, 2, 4, 5, 7].forEach((s, k) => sy.tone(out, now + 0.1 + k * 0.08, midi(PENTA[s + 2]!), 0.6, 0.07, { type: 'triangle', send: 0.5 }));
        break;
      }
    }
  }

  // ───────────────────────── wizard powers (D-042) ─────────────────────────

  /** A sigil scroll appears: a soft, high shimmer so you look for it. */
  sigilAppears(): void {
    if (!this.ready) return;
    const now = this.t;
    [81, 86, 89].forEach((n, k) => this.sy.tone(this.sfxBus, now + k * 0.07, midi(n), 0.9, 0.035, { type: 'sine', send: 0.7 }));
  }

  /** A sigil captured: the power fires. A rising bell arpeggio and choir swell, then the wizard's own flavour. */
  power(wizard: WizardId): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    [62, 69, 74, 77, 81, 86].forEach((n, k) => sy.bell(out, now + k * 0.055, midi(n), 0.07, 0.5, 1.8));
    for (const n of [62, 69, 74, 77]) sy.choir(out, now + 0.05, midi(n), 1.6, 0.03, 0.6);
    sy.noiseHit(out, now, 0.7, 0.12, { type: 'bandpass', freq: 600, to: 6000, q: 0.8 }, { attack: 0.3, curve: 'lin', send: 0.5 });
    const at = now + 0.3;
    switch (wizard) {
      case 'apprentice': // a bright brass flourish
        [62, 66, 69, 74].forEach((n, k) => sy.tone(out, at + k * 0.06, midi(n), 0.6, 0.07, { type: 'sawtooth', filter: { type: 'lowpass', freq: 900, to: 3600 }, send: 0.3 }));
        break;
      case 'archivist': // pages riffled, a quill scratch
        for (let k = 0; k < 10; k++) sy.noiseHit(out, at + k * 0.035, 0.04, 0.11, { type: 'bandpass', freq: 2200 + k * 180, q: 1.4 });
        sy.noiseHit(out, at + 0.4, 0.25, 0.07, { type: 'highpass', freq: 5000 });
        break;
      case 'chronomancer': // a clock spun backwards
        sy.tone(out, at, midi(50), 0.9, 0.1, { type: 'sawtooth', glideTo: midi(74), filter: { type: 'lowpass', freq: 400, to: 2600 }, send: 0.4 });
        for (let k = 0; k < 8; k++) sy.noiseHit(out, at + 0.6 - k * 0.07, 0.03, 0.1, { type: 'bandpass', freq: 1500, q: 5 });
        break;
      case 'pyromancer': // ignition
        sy.noiseHit(out, at, 0.5, 0.3, { type: 'bandpass', freq: 300, to: 3200, q: 0.8 }, { attack: 0.02 });
        sy.tone(out, at, 70, 0.9, 0.18, { type: 'sawtooth', glideTo: 50, filter: { type: 'lowpass', freq: 300 }, drive: 2 });
        break;
      case 'cartographer': // a map unrolled, a compass needle spinning to north
        sy.noiseHit(out, at, 0.45, 0.14, { type: 'bandpass', freq: 900, to: 3000, q: 1.2 }, { attack: 0.05, curve: 'lin' });
        sy.tone(out, at + 0.2, midi(81), 0.7, 0.05, { type: 'sine', glideTo: midi(93), send: 0.5 });
        sy.tone(out, at + 0.55, midi(93), 0.5, 0.04, { type: 'triangle', glideTo: midi(86), send: 0.5 });
        break;
      case 'lexicant': // every word at once: a babble of syllables, then one clear note
        for (let k = 0; k < 9; k++)
          sy.tone(out, at + k * 0.045, 300 + Math.random() * 500, 0.06, 0.06, { type: 'square', filter: { type: 'bandpass', freq: 1200, q: 3 } });
        sy.bell(out, at + 0.5, midi(86), 0.09, 0.5, 1.6);
        break;
    }
  }

  /** Compass Rose / Malapropism: extra words captured, a quick run of chimes up the scale. */
  echo(count: number): void {
    if (!this.ready) return;
    const now = this.t;
    for (let k = 0; k < Math.min(6, count); k++)
      this.sy.tone(this.sfxBus, now + 0.04 + k * 0.05, midi(PENTA[Math.min(PENTA.length - 1, 5 + k)]! + 12), 0.4, 0.06, { type: 'triangle', send: 0.5 });
  }

  /** Kindle: a neighbouring word catches fire. */
  kindle(): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    sy.noiseHit(out, now, 0.35, 0.22, { type: 'bandpass', freq: 400, to: 2400, q: 0.9 }, { attack: 0.02 });
    for (let k = 0; k < 10; k++) sy.noiseHit(out, now + 0.05 + Math.random() * 0.4, 0.008, 0.18, { type: 'highpass', freq: 2000 + Math.random() * 3000 });
  }

  /** The score counter's wheels turning: a tiny tick, pitched up by how far the roll has come. */
  counterTick(progress: number): void {
    if (!this.ready) return;
    const now = this.t;
    const n = PENTA[Math.min(PENTA.length - 1, 6 + Math.floor(progress * 6))]! + 12;
    this.sy.tone(this.sfxBus, now, midi(n), 0.05, 0.018, { type: 'square', filter: { type: 'lowpass', freq: 3000 } });
  }

  // ───────────────────────── moments ─────────────────────────

  /** A level begins: the carriage returns with a zing and a clunk. */
  levelStart(): void {
    if (!this.ready) return;
    const now = this.t;
    this.sy.noiseHit(this.sfxBus, now, 0.35, 0.16, { type: 'bandpass', freq: 1200, to: 3200, q: 3 }, { attack: 0.02, curve: 'lin' });
    this.sy.tone(this.sfxBus, now + 0.36, 160, 0.12, 0.25, { glideTo: 90, filter: { type: 'lowpass', freq: 800 } });
    this.sy.bell(this.sfxBus, now + 0.4, midi(86), 0.05, 0.3, 1.2);
  }

  /** The level is won: the typewriter bell, then choir, organ, timpani and bells over the ducked score. */
  finale(boss = false): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus;
    const t0 = this.t + 0.05;
    this.music.duck(t0, 0.8, 2.6);
    sy.bell(out, t0, midi(93), 0.12, 0.3, 1.5); // ding!
    const chords = boss
      ? [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [50, 57, 62, 66]]
      : [[50, 57, 62, 65], [55, 59, 62, 67], [57, 61, 64, 69], [50, 57, 62, 66]];
    const lens = [0.22, 0.22, 0.3, 1.8];
    let t = t0 + 0.25;
    chords.forEach((chord, ci) => {
      const len = lens[ci]!;
      for (const n of chord) {
        sy.choir(out, t, midi(n + 12), len + (ci === 3 ? 1.4 : 0.1), 0.035, 0.6);
        for (const oct of [-12, 0]) sy.tone(out, t, midi(n + oct), len + (ci === 3 ? 1 : 0), 0.016, { type: 'square', attack: 0.03, hold: len * 0.6, filter: { type: 'lowpass', freq: 1500 }, send: 0.5 });
      }
      sy.tone(out, t, midi(chord[0]! - 24), 0.9, 0.35, { glideTo: midi(chord[0]! - 28), filter: { type: 'lowpass', freq: 220 }, send: 0.3 }); // timpani
      if (ci === 3) chord.forEach((n, k) => sy.bell(out, t + k * 0.16, midi(n + 24), 0.07, 0.6, 3));
      t += len;
    });
  }

  /** Simple win (duels): a short rising phrase. */
  fanfare(): void {
    if (!this.ready) return;
    const now = this.t;
    [0, 2, 4, 7].forEach((s, k) => this.sy.tone(this.sfxBus, now + k * 0.14, midi(PENTA[s]!), 0.7, 0.12, { type: 'triangle', send: 0.4 }));
  }

  /** Run lost: the score collapses into a low, slow fall. */
  defeat(): void {
    if (!this.ready) return;
    const now = this.t;
    this.music.duck(now, 0.9, 3.5);
    [69, 65, 62, 57].forEach((n, k) => this.sy.tone(this.sfxBus, now + k * 0.3, midi(n), 1.0, 0.1, { type: 'sawtooth', filter: { type: 'lowpass', freq: 900, to: 300 }, send: 0.5 }));
    this.sy.tone(this.sfxBus, now + 1.0, 55, 2.4, 0.3, { glideTo: 30, filter: { type: 'lowpass', freq: 200 } });
    this.sy.noiseHit(this.sfxBus, now + 1.0, 2.5, 0.12, { type: 'lowpass', freq: 800, to: 120 }, { curve: 'lin', send: 0.5 });
  }

  /** A menu button: a soft paper tap. */
  click(): void {
    if (!this.ready) return;
    const now = this.t;
    this.sy.noiseHit(this.sfxBus, now, 0.02, 0.15, { type: 'bandpass', freq: 2200, q: 1.5 });
    this.sy.tone(this.sfxBus, now, midi(74), 0.12, 0.04, { type: 'triangle' });
  }
}

export const audio = new AudioEngine();
