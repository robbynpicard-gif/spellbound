import type { SpellId } from '../gameplay/SpellManager';
import { Music, type Mood } from './Music';
import { midi, Synth } from './synth';

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
  /** The announcer's own channel (D-053), for recorded voice lines. */
  voiceBus!: GainNode;
  private musicOn = true;
  private sfxOn = true;
  private voiceOn = true;
  /** Volumes 0–1 from the Options sliders. */
  private vol = { music: 0.8, sfx: 0.8, voice: 0.8 };
  private pending: { mood: Mood; stress: number; heat: number; drive?: number } = { mood: 'menu', stress: 0, heat: 0, drive: 0 };
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
    this.voiceBus = ctx.createGain();
    this.musicBus.gain.value = this.level('music');
    this.sfxBus.gain.value = this.level('sfx');
    this.voiceBus.gain.value = this.level('voice');
    this.musicBus.connect(master);
    this.voiceBus.connect(master);
    // Every effect passes through a gentle low-pass and a little extra low end:
    // rounder, warmer, never piercing (D-045).
    const round = ctx.createBiquadFilter();
    round.type = 'lowpass';
    round.frequency.value = 4600;
    round.Q.value = 0.5;
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowshelf';
    warm.frequency.value = 220;
    warm.gain.value = 3;
    this.sfxBus.connect(round).connect(warm).connect(master);
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

  /** Bus gain for a channel: its switch × its slider × its mix level. 80% on the slider = the old full level. */
  private level(ch: 'music' | 'sfx' | 'voice'): number {
    const on = ch === 'music' ? this.musicOn : ch === 'sfx' ? this.sfxOn : this.voiceOn;
    const mix = { music: 0.6, sfx: 0.75, voice: 0.9 }[ch];
    return on ? (mix * this.vol[ch]) / 0.8 : 0;
  }

  private apply(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.level('music'), t, 0.15);
    this.sfxBus.gain.setTargetAtTime(this.level('sfx'), t, 0.05);
    this.voiceBus.gain.setTargetAtTime(this.level('voice'), t, 0.05);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    this.apply();
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    this.apply();
  }

  setVoice(on: boolean): void {
    this.voiceOn = on;
    this.apply();
  }

  /** Volumes 0–100 for music, sound effects and the announcer. */
  setVolumes(v: { music: number; sfx: number; voice: number }): void {
    this.vol = { music: v.music / 100, sfx: v.sfx / 100, voice: v.voice / 100 };
    this.apply();
  }

  /** Applies every saved audio setting at once. */
  applySettings(a: { music: boolean; sfx: boolean; voice: boolean; musicVolume: number; sfxVolume: number; voiceVolume: number }): void {
    this.musicOn = a.music;
    this.sfxOn = a.sfx;
    this.voiceOn = a.voice;
    this.setVolumes({ music: a.musicVolume, sfx: a.sfxVolume, voice: a.voiceVolume });
  }

  /** Menu, a level, or a boss: changes tempo and ensemble at the next bar. */
  setMood(mood: Mood): void {
    this.update(mood === 'menu' ? { mood, drive: 0 } : { mood });
  }

  /** The ward's instability stage (0–4): darkens the score bar by bar. */
  setStress(stage: number): void {
    this.update({ stress: Math.min(3, Math.max(0, stage)) });
  }

  /** The combo multiplier tier (0–4): brightens the score. */
  setHeat(tier: number): void {
    this.update({ heat: Math.min(4, Math.max(0, tier)) });
  }

  /** Stage + level progress (0–1): the score speeds up and adds layers (D-054). */
  setDrive(drive: number): void {
    const d = Math.round(Math.max(0, Math.min(1, drive)) * 20) / 20;
    if (d !== this.pending.drive) this.update({ drive: d });
  }

  private update(change: Partial<{ mood: Mood; stress: number; heat: number; drive: number }>): void {
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

  /**
   * A typewriter key, brassy and clunky (D-045): the key goes down with a
   * wooden thunk, the brass typebar swings up and rings against the platen,
   * and the mechanism knocks back into place.
   */
  key(): void {
    if (!this.ready) return;
    const now = this.t;
    if (this.clock === null && now - this.lastKey < 0.025 && now > this.lastKey) return;
    this.lastKey = now;
    const sy = this.sy, out = this.sfxBus;
    const p = this.vary(1, 0.05);
    // 1. the key goes down: a short, solid thunk with a felt-and-wood body (not a hollow boom)
    sy.tone(out, now, 140 * p, 0.05, this.vary(0.14, 0.12), { glideTo: 95 * p, attack: 0.003, filter: { type: 'lowpass', freq: 500 } });
    sy.noiseHit(out, now, 0.035, this.vary(0.2, 0.15), { type: 'bandpass', freq: 480 * p, q: 0.9 });
    // 2. the brass typebar strikes close behind: a tight metal ring and a firm click
    const strike = now + this.vary(0.012, 0.25);
    sy.brass(out, strike, 600 * p, this.vary(0.06, 0.15), 0.15);
    sy.noiseHit(out, strike, 0.012, this.vary(0.13, 0.2), { type: 'bandpass', freq: 2000 * p, q: 0.8 });
    // 3. the mechanism settles: a dense, dry knock right after
    sy.noiseHit(out, strike + 0.01, 0.025, this.vary(0.12, 0.2), { type: 'bandpass', freq: 900 * p, q: 1.2 });
  }

  /** A slip of the finger: a soft, hollow wooden knock (the combo survives it). */
  typo(): void {
    if (!this.ready) return;
    const now = this.t;
    this.sy.tone(this.sfxBus, now, 150, 0.12, 0.22, { glideTo: 105, attack: 0.008, filter: { type: 'lowpass', freq: 600 } });
    this.sy.tone(this.sfxBus, now + 0.06, 120, 0.1, 0.12, { glideTo: 90, attack: 0.008, filter: { type: 'lowpass', freq: 500 } });
  }

  /** Enter on a wrong word: the carriage jams (a dull brass clunk) and a soft falling sigh. */
  wrongEntry(): void {
    if (!this.ready) return;
    const now = this.t;
    this.sy.brass(this.sfxBus, now, 300, 0.12, 0.25);
    this.sy.noiseHit(this.sfxBus, now, 0.12, 0.12, { type: 'lowpass', freq: 900 });
    this.sy.tone(this.sfxBus, now + 0.08, midi(62), 0.35, 0.08, { type: 'sine', attack: 0.02, glideTo: midi(57), send: 0.3 });
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
    // the stamp: a round, padded thump
    sy.tone(out, now, 105, 0.12, 0.24, { glideTo: 62, attack: 0.006, filter: { type: 'lowpass', freq: 400 } });
    sy.noiseHit(out, now, 0.06, 0.08, { type: 'lowpass', freq: 1100 });
    // the climbing note: a soft mallet tone, one step higher each word of the combo
    const step = Math.max(0, combo - 1);
    const n = PENTA[Math.min(PENTA.length - 1, step % 12)]! + (step >= 12 ? 12 : 0);
    // Small, capped lift as the combo grows: satisfying without burying the
    // typing clicks or turning long runs into an increasingly loud mix.
    const lift = 1 + Math.min(0.3, step * 0.015);
    sy.tone(out, now + 0.01, midi(n), 0.7, 0.13 * lift, { type: 'sine', attack: 0.012, send: 0.35 });
    sy.tone(out, now + 0.01, midi(n), 0.35, 0.05, { type: 'triangle', attack: 0.012, filter: { type: 'lowpass', freq: 2200 }, send: 0.3 });
    sy.tone(out, now + 0.01, midi(n + 12), 0.4, 0.03, { type: 'sine', attack: 0.015, send: 0.35 });
    const special = bonuses.filter((b) => b !== 'perfect' && b !== 'quick');
    special.forEach((_, k) => {
      const tn = midi(PENTA[Math.min(PENTA.length - 1, 6 + k * 2)]!);
      sy.tone(out, now + 0.09 + k * 0.06, tn, 0.35, 0.06, { type: 'sine', attack: 0.01, send: 0.45 });
    });
    if (bonuses.includes('clutch')) sy.bell(out, now + 0.05, midi(81), 0.05, 0.5, 1.8);
    if (bonuses.includes('sweep')) [0, 2, 4, 5, 7].forEach((st, k) => sy.tone(out, now + 0.1 + k * 0.06, midi(PENTA[st + 5]!), 0.6, 0.06, { type: 'sine', attack: 0.01, send: 0.5 }));
  }

  /** A new multiplier tier: a brass stab and a bell, grander each tier, in the music's key. */
  tierUp(tier: number): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    const chord = [62, 65, 69, 74, 77].slice(0, 2 + tier);
    chord.forEach((n, k) => {
      sy.tone(out, now + k * 0.045, midi(n - 12), 0.55, 0.08, { type: 'sawtooth', attack: 0.02, filter: { type: 'lowpass', freq: 500, to: 1600 + tier * 400 }, send: 0.3 });
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

  // ───────────────────────── Clean Streak (D-046) ─────────────────────────

  /**
   * A Clean Streak milestone: a quill flourish, then an illuminated chord that
   * grows with the tier (more bells, then choir, then a low swell).
   */
  streakMilestone(tier: number): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    sy.noiseHit(out, now, 0.18, 0.08, { type: 'bandpass', freq: 1400, to: 2600, q: 2 }, { attack: 0.02, curve: 'lin' }); // the quill
    const notes = [62, 69, 74, 77, 81, 86, 89].slice(0, 2 + tier);
    notes.forEach((n, k) => sy.bell(out, now + 0.12 + k * 0.07, midi(n), 0.06, 0.6, 2 + tier * 0.3));
    if (tier >= 3) for (const n of [62, 69, 74]) sy.choir(out, now + 0.15, midi(n), 1.2 + tier * 0.25, 0.025 + tier * 0.004, 0.7);
    if (tier >= 5) sy.tone(out, now + 0.1, midi(38), 1.8, 0.14, { type: 'sine', attack: 0.3, send: 0.4 });
  }

  /** A corrected typo cost the streak a milestone: a small ink-blot plop and a soft step down. */
  streakTypo(dropped: boolean): void {
    if (!this.ready) return;
    const now = this.t;
    this.sy.tone(this.sfxBus, now, 180, 0.08, 0.08, { glideTo: 120, attack: 0.006, filter: { type: 'lowpass', freq: 700 } });
    if (dropped) {
      this.sy.tone(this.sfxBus, now + 0.05, midi(69), 0.3, 0.05, { type: 'sine', attack: 0.01, send: 0.3 });
      this.sy.tone(this.sfxBus, now + 0.16, midi(65), 0.4, 0.05, { type: 'sine', attack: 0.01, send: 0.3 });
    }
  }

  /** A wrong Enter ended the streak: a page torn in two. */
  streakLost(): void {
    if (!this.ready) return;
    const now = this.t;
    this.sy.noiseHit(this.sfxBus, now, 0.35, 0.2, { type: 'bandpass', freq: 2400, to: 700, q: 1.4 }, { attack: 0.01, curve: 'lin' });
    this.sy.tone(this.sfxBus, now + 0.1, midi(57), 0.6, 0.07, { type: 'sine', attack: 0.02, glideTo: midi(50), send: 0.4 });
  }

  /** A miss shattered a streak: the illuminated chord falls apart. */
  streakBroken(previous: number): void {
    if (!this.ready || previous < 5) return;
    const sy = this.sy, out = this.sfxBus, now = this.t + 0.15;
    [81, 77, 74, 69, 62].forEach((n, k) => sy.tone(out, now + k * 0.07, midi(n) * (1 - k * 0.012), 0.6, 0.05, { type: 'sine', attack: 0.005, send: 0.5 }));
    sy.noiseHit(out, now, 0.6, 0.12, { type: 'lowpass', freq: 1600, to: 200 }, { send: 0.5 });
  }

  // ───────────────────────── harm ─────────────────────────

  /** A scroll broke through the ward: a heavy stone thud, a crumble, the ward groaning. */
  miss(): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    sy.tone(out, now, 64, 0.8, 0.5, { glideTo: 34, attack: 0.005, filter: { type: 'lowpass', freq: 200 }, send: 0.3 });
    sy.noiseHit(out, now, 0.25, 0.28, { type: 'lowpass', freq: 1200, to: 300 });
    for (let k = 0; k < 5; k++) sy.noiseHit(out, now + 0.06 + k * 0.05, 0.05, 0.1, { type: 'bandpass', freq: 600 + Math.random() * 700, q: 1.5 });
    sy.tone(out, now + 0.05, midi(39), 1.2, 0.07, { type: 'triangle', attack: 0.15, filter: { type: 'lowpass', freq: 500 }, send: 0.4 });
  }

  /** A miss stopped by the barrier: a deep, ringing shield. */
  blocked(): void {
    if (!this.ready) return;
    const now = this.t;
    this.sy.noiseHit(this.sfxBus, now, 0.1, 0.18, { type: 'lowpass', freq: 1500 });
    this.sy.bell(this.sfxBus, now, midi(62), 0.1, 0.5, 2.4);
    this.sy.tone(this.sfxBus, now, 90, 0.5, 0.2, { glideTo: 60, filter: { type: 'lowpass', freq: 300 } });
  }

  /** A spell scroll captured: parchment unrolling and a rising, rounded shimmer. */
  pickup(): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    sy.noiseHit(out, now, 0.28, 0.08, { type: 'bandpass', freq: 900, to: 2400, q: 1.2 }, { attack: 0.03 });
    [0, 2, 4, 5].forEach((st, k) => sy.tone(out, now + 0.05 + k * 0.06, midi(PENTA[st + 4]!), 0.5, 0.06, { type: 'sine', attack: 0.01, send: 0.5 }));
  }

  // ───────────────────────── spells ─────────────────────────

  /**
   * The weight under every cast (D-045): the score ducks, a deep sub-bass
   * drop lands, and air rushes in. The element plays on top.
   */
  private castImpact(now: number, size = 1): void {
    const sy = this.sy, out = this.sfxBus;
    this.music.duck(now, 0.65, 1.3 * size);
    sy.noiseHit(out, now - 0.0, 0.25, 0.14 * size, { type: 'lowpass', freq: 300, to: 2000, q: 0.7 }, { attack: 0.2, curve: 'lin' });   // the inhale
    sy.tone(out, now + 0.2, 82, 1.1 * size, 0.55 * size, { glideTo: 32, attack: 0.004, filter: { type: 'lowpass', freq: 160 }, send: 0.25 });   // the drop
    sy.noiseHit(out, now + 0.2, 0.6 * size, 0.22 * size, { type: 'lowpass', freq: 900, to: 120 }, { send: 0.4 });
  }

  /** Casting: each spell sounds like its element, with real weight under it. */
  cast(spell: SpellId): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    const big = spell === 'fire' || spell === 'harvest' || spell === 'wind' ? 1.25 : 1;
    this.castImpact(now, big);
    const t = now + 0.2; // the element lands with the drop
    switch (spell) {
      case 'fire': {
        sy.noiseHit(out, t, 0.7, 0.4, { type: 'bandpass', freq: 200, to: 1600, q: 0.7 }, { attack: 0.04 });                // ignition whoosh
        sy.noiseHit(out, t + 0.1, 2.4, 0.34, { type: 'lowpass', freq: 520, to: 140 }, { attack: 0.25, curve: 'lin', send: 0.35 }); // roar
        for (let k = 0; k < 34; k++)
          sy.noiseHit(out, t + 0.1 + Math.random() * 2, 0.012 + Math.random() * 0.02, 0.1 + Math.random() * 0.12, { type: 'bandpass', freq: 900 + Math.random() * 1800, q: 1.2 }); // crackle
        sy.tone(out, t, 70, 1.6, 0.22, { type: 'sawtooth', glideTo: 46, filter: { type: 'lowpass', freq: 220 }, drive: 2 });
        break;
      }
      case 'ice': {
        for (let k = 0; k < 16; k++) sy.noiseHit(out, t + k * 0.03 + Math.random() * 0.02, 0.03, 0.14, { type: 'bandpass', freq: 1800 + Math.random() * 1400, q: 2 }); // freezing crunch
        sy.noiseHit(out, t, 1.6, 0.16, { type: 'bandpass', freq: 700, to: 1800, q: 1.5 }, { attack: 0.3, curve: 'lin', send: 0.5 }); // cold wind
        [81, 86, 89, 93].forEach((n, k) => sy.bell(out, t + 0.2 + k * 0.09, midi(n), 0.05, 0.7, 2.6));                       // glass chimes
        sy.tone(out, t + 0.3, 300, 1.2, 0.05, { type: 'triangle', glideTo: 200, filter: { type: 'bandpass', freq: 600, q: 6 } }); // creak
        break;
      }
      case 'shock': {
        sy.noiseHit(out, t, 1.8, 0.4, { type: 'lowpass', freq: 1400, to: 140 }, { send: 0.5 });                               // thunder
        sy.tone(out, t, 55, 0.9, 0.2, { type: 'sawtooth', drive: 3, filter: { type: 'lowpass', freq: 700 } });                // electric buzz
        for (let k = 0; k < 6; k++) {
          const tt = t + k * 0.08 + Math.random() * 0.04;
          sy.tone(out, tt, 1400 + Math.random() * 600, 0.08, 0.06, { type: 'triangle', glideTo: 200, drive: 2, filter: { type: 'lowpass', freq: 2600 } });
        }
        break;
      }
      case 'slow': {
        sy.tone(out, t, midi(62), 1.8, 0.14, { type: 'sawtooth', glideTo: midi(38), filter: { type: 'lowpass', freq: 1800, to: 300 }, send: 0.45 }); // tape stop
        sy.tone(out, t, midi(57), 1.8, 0.1, { type: 'sawtooth', glideTo: midi(33), filter: { type: 'lowpass', freq: 1400, to: 250 }, send: 0.45 });
        [0, 0.5, 1.15, 1.95].forEach((dt, k) => {                                                                              // a great clock, slowing
          sy.tone(out, t + dt, k % 2 ? 180 : 140, 0.18, 0.2 - k * 0.03, { type: 'triangle', glideTo: 110, filter: { type: 'lowpass', freq: 700 }, send: 0.4 });
        });
        break;
      }
      case 'barrier': {
        sy.tone(out, t, midi(38), 1.6, 0.16, { type: 'sawtooth', attack: 0.3, filter: { type: 'lowpass', freq: 300, to: 900 } }); // rising hum
        sy.bell(out, t + 0.3, midi(38), 0.2, 0.6, 4);                                                                               // a great gong
        sy.noiseHit(out, t + 0.3, 1.2, 0.08, { type: 'bandpass', freq: 1200, q: 0.8 }, { attack: 0.05, send: 0.6 });                // shimmer
        break;
      }
      case 'alter': {
        sy.noiseHit(out, t - 0.15, 0.6, 0.18, { type: 'bandpass', freq: 500, to: 2600, q: 1.5 }, { attack: 0.5, curve: 'lin' }); // reversed swell
        sy.tone(out, t, midi(62), 0.9, 0.09, { type: 'sine', attack: 0.4, glideTo: midi(74), send: 0.6 });
        sy.tone(out, t, midi(69), 0.9, 0.06, { type: 'sine', attack: 0.4, glideTo: midi(81), send: 0.6 });
        for (let k = 0; k < 6; k++) sy.noiseHit(out, t + 0.45 + k * 0.05, 0.05, 0.09, { type: 'bandpass', freq: 1600 + k * 120, q: 1.3 }); // pages riffle
        break;
      }
      case 'wind': {
        sy.noiseHit(out, t, 2.4, 0.38, { type: 'bandpass', freq: 180, to: 1000, q: 2.5 }, { attack: 0.4, curve: 'lin', send: 0.5 }); // gust
        sy.noiseHit(out, t + 0.4, 1.8, 0.22, { type: 'bandpass', freq: 1000, to: 350, q: 3 }, { attack: 0.3, curve: 'lin' });
        for (const n of [62, 69, 74]) sy.choir(out, t + 0.5, midi(n), 1.8, 0.03, 0.7);                                            // the ward breathes again
        break;
      }
      case 'harvest': {
        sy.noiseHit(out, t, 0.6, 0.3, { type: 'bandpass', freq: 400, to: 2000, q: 1 }, { attack: 0.05, curve: 'lin' });           // the sweep
        [0, 2, 4, 5, 7, 9].forEach((st, k) => sy.tone(out, t + 0.15 + k * 0.08, midi(PENTA[st]!), 0.9, 0.08, { type: 'sine', attack: 0.01, send: 0.55 }));
        for (const n of [62, 66, 69, 74]) sy.choir(out, t + 0.3, midi(n), 2, 0.03, 0.7);
        break;
      }
    }
  }

  /** A scroll claimed with a full spell pool: a dull, muffled clunk and a hiss (it fizzles). */
  overflow(): void {
    if (!this.ready) return;
    const sy = this.sy, out = this.sfxBus, now = this.t;
    sy.tone(out, now, 110, 0.18, 0.2, { type: 'square', glideTo: 70, filter: { type: 'lowpass', freq: 420 } });
    sy.noiseHit(out, now + 0.02, 0.09, 0.12, { type: 'lowpass', freq: 700 });
    sy.noiseHit(out, now + 0.08, 0.45, 0.06, { type: 'bandpass', freq: 3000, to: 900, q: 0.7 }, { attack: 0.03, curve: 'lin' });
  }

  /** The score counter's wheels turning: a tiny tick, pitched up by how far the roll has come. */
  counterTick(progress: number): void {
    if (!this.ready) return;
    const now = this.t;
    const n = PENTA[Math.min(PENTA.length - 1, 6 + Math.floor(progress * 6))]! + 12;
    this.sy.tone(this.sfxBus, now, midi(n), 0.06, 0.03, { type: 'triangle', attack: 0.003, filter: { type: 'lowpass', freq: 1800 } });
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
    this.sy.noiseHit(this.sfxBus, now, 0.03, 0.1, { type: 'bandpass', freq: 1200, q: 1.2 });
    this.sy.tone(this.sfxBus, now, midi(62), 0.15, 0.05, { type: 'sine', attack: 0.005 });
  }
}

export const audio = new AudioEngine();
