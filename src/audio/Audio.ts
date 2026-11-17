import type { SpellId } from '../gameplay/SpellManager';

/**
 * Music and sound effects, synthesised with the Web Audio API (no audio files;
 * decisions.md D-038). Two buses, music and sfx, each switched on/off on its
 * own. Browsers only allow sound after a click or key press, so the context is
 * created by `unlock()` on the first user gesture.
 */
export type Mood = 'menu' | 'calm' | 'boss';

/** D natural minor, around D3–D5 (Hz). */
const SCALE = [146.83, 164.81, 174.61, 196.0, 220.0, 233.08, 261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 466.16, 523.25, 587.33];
/** Chord roots for the slow progression: Dm · B♭ · Gm · A (low octave). */
const PROGRESSION = [
  [73.42, 110.0, 146.83, 174.61],
  [58.27, 87.31, 116.54, 146.83],
  [49.0, 73.42, 98.0, 116.54],
  [55.0, 82.41, 110.0, 138.59],
];
const BAR_SECONDS = 6;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private musicOn = true;
  private sfxOn = true;
  private mood: Mood = 'menu';
  private timer: number | null = null;
  private nextBar = 0;
  private bar = 0;
  private lastKey = 0;

  /** Call from any user gesture; safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.55 : 0;
    this.sfxBus.gain.value = this.sfxOn ? 0.7 : 0;
    this.musicBus.connect(master);
    this.sfxBus.connect(master);
    // A long, dark stone-room reverb from decaying noise.
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.3);
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.05);
  }

  /** Menu: sparse; calm: a level; boss: faster arpeggio, brighter. */
  setMood(mood: Mood): void {
    this.mood = mood;
  }

  // ───────────────────────── music ─────────────────────────

  private startMusic(): void {
    if (!this.ctx || this.timer !== null) return;
    this.nextBar = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 250);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextBar < ctx.currentTime + 1.5) {
      this.playBar(this.nextBar, PROGRESSION[this.bar % PROGRESSION.length]!);
      this.nextBar += BAR_SECONDS;
      this.bar++;
    }
  }

  private playBar(t: number, chord: number[]): void {
    const ctx = this.ctx!;
    // Pad: detuned saws through a slow low-pass, swelling in and out.
    const padOut = ctx.createGain();
    padOut.gain.setValueAtTime(0, t);
    padOut.gain.linearRampToValueAtTime(0.07, t + 2);
    padOut.gain.linearRampToValueAtTime(0.06, t + BAR_SECONDS - 1);
    padOut.gain.linearRampToValueAtTime(0, t + BAR_SECONDS + 0.8);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(this.mood === 'boss' ? 900 : 500, t);
    lp.frequency.linearRampToValueAtTime(this.mood === 'boss' ? 1400 : 750, t + BAR_SECONDS / 2);
    lp.frequency.linearRampToValueAtTime(this.mood === 'boss' ? 900 : 500, t + BAR_SECONDS);
    padOut.connect(lp);
    lp.connect(this.musicBus);
    lp.connect(this.reverb);
    for (const f of chord) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = detune;
        o.connect(padOut);
        o.start(t);
        o.stop(t + BAR_SECONDS + 1);
      }
    }
    // Drone: the low root, a sine an octave below.
    const drone = ctx.createOscillator();
    const dg = ctx.createGain();
    drone.type = 'sine';
    drone.frequency.value = chord[0]! / 2;
    dg.gain.setValueAtTime(0, t);
    dg.gain.linearRampToValueAtTime(0.12, t + 1);
    dg.gain.linearRampToValueAtTime(0, t + BAR_SECONDS + 0.5);
    drone.connect(dg).connect(this.musicBus);
    drone.start(t);
    drone.stop(t + BAR_SECONDS + 0.6);
    // Plucked arpeggio from the scale, denser in a boss fight.
    const steps = this.mood === 'boss' ? 16 : this.mood === 'calm' ? 8 : 4;
    for (let i = 0; i < steps; i++) {
      if (Math.random() < (this.mood === 'menu' ? 0.45 : 0.25)) continue;
      const note = SCALE[Math.floor(Math.random() * SCALE.length)]!;
      this.pluck(t + (i * BAR_SECONDS) / steps, note, this.mood === 'boss' ? 0.05 : 0.07);
    }
    // A low bell at the start of every other bar.
    if (this.bar % 2 === 0) this.bell(t, chord[1]! * 2, 0.06);
  }

  private pluck(t: number, f: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g);
    g.connect(this.musicBus);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + 1.5);
  }

  private bell(t: number, f: number, vol: number, bus: GainNode = this.musicBus): void {
    const ctx = this.ctx!;
    for (const [mult, v] of [[1, 1], [2.76, 0.4], [5.4, 0.2]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5 / mult);
      o.connect(g);
      g.connect(bus);
      g.connect(this.reverb);
      o.start(t);
      o.stop(t + 2.6);
    }
  }

  // ───────────────────────── sound effects ─────────────────────────

  private get ready(): boolean {
    return this.ctx !== null && this.sfxOn;
  }

  private tone(f: number, dur: number, vol: number, type: OscillatorType = 'sine', glideTo?: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(dur: number, vol: number, from: number, to: number, type: BiquadFilterType = 'bandpass', delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    g.connect(this.sfxBus);
    g.connect(this.reverb);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** A typewriter key: a short filtered tick (rate-limited). */
  key(): void {
    if (!this.ready) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastKey < 0.03) return;
    this.lastKey = now;
    this.hiss(0.035, 0.25, 3200 + Math.random() * 800, 1800, 'bandpass');
    this.tone(180 + Math.random() * 30, 0.03, 0.08, 'square');
  }

  /** A scroll captured: a bright chime that climbs with the combo. */
  capture(combo: number): void {
    if (!this.ready) return;
    const i = Math.min(SCALE.length - 3, 6 + Math.min(combo, 8));
    this.tone(SCALE[i]! * 2, 0.5, 0.16, 'triangle');
    this.tone(SCALE[i + 2]! * 2, 0.6, 0.12, 'sine', undefined, 0.06);
    this.hiss(0.25, 0.08, 6000, 9000, 'highpass');
  }

  /** A wrong key or an Enter that matched nothing. */
  error(): void {
    if (!this.ready) return;
    this.tone(110, 0.16, 0.14, 'sawtooth', 80);
  }

  /** A scroll broke through the ward: a dull thud and a crack. */
  miss(): void {
    if (!this.ready) return;
    this.tone(70, 0.5, 0.35, 'sine', 40);
    this.hiss(0.35, 0.25, 900, 200, 'lowpass');
  }

  /** A miss stopped by the barrier: a metallic ring. */
  blocked(): void {
    if (!this.ready) return;
    this.bell(this.ctx!.currentTime, 520, 0.12, this.sfxBus);
  }

  /** A spell scroll captured: a rising sparkle. */
  pickup(): void {
    if (!this.ready) return;
    [0, 2, 4, 7].forEach((step, k) => this.tone(SCALE[7 + step]! * 2, 0.35, 0.1, 'triangle', undefined, k * 0.05));
  }

  /** Casting: a whoosh plus a voice for each spell. */
  cast(spell: SpellId): void {
    if (!this.ready) return;
    this.hiss(0.6, 0.18, 400, 4000, 'bandpass');
    switch (spell) {
      case 'fire':
        this.hiss(1.0, 0.35, 300, 2500, 'lowpass');
        this.tone(90, 0.8, 0.2, 'sawtooth', 60);
        break;
      case 'ice':
        [0, 4, 7, 11].forEach((s, k) => this.tone(SCALE[Math.min(14, 7 + s)]! * 2, 1.2, 0.08, 'sine', undefined, k * 0.04));
        break;
      case 'slow':
        this.tone(440, 1.2, 0.14, 'triangle', 180);
        break;
      case 'barrier':
        this.bell(this.ctx!.currentTime, 260, 0.16, this.sfxBus);
        break;
      case 'shock':
        this.hiss(0.3, 0.3, 5000, 1500, 'highpass');
        this.tone(1200, 0.25, 0.08, 'square', 300);
        break;
      case 'alter':
        this.tone(330, 0.6, 0.12, 'sine', 660);
        this.tone(495, 0.6, 0.08, 'sine', 247, 0.1);
        break;
      case 'wind':
        this.hiss(1.4, 0.3, 300, 1200, 'bandpass');
        break;
      case 'harvest':
        [0, 2, 4, 5, 7].forEach((s, k) => this.tone(SCALE[s + 5]! * 2, 0.6, 0.1, 'triangle', undefined, k * 0.07));
        break;
    }
  }

  /** Level cleared or the run won: a short rising phrase. */
  fanfare(): void {
    if (!this.ready) return;
    [0, 2, 4, 7].forEach((s, k) => this.tone(SCALE[s + 4]!, 0.7, 0.14, 'triangle', undefined, k * 0.14));
    this.bell(this.ctx!.currentTime + 0.56, SCALE[11]!, 0.1, this.sfxBus);
  }

  /** Run lost: a slow falling phrase. */
  defeat(): void {
    if (!this.ready) return;
    [7, 5, 4, 0].forEach((s, k) => this.tone(SCALE[s]!, 0.9, 0.14, 'sawtooth', undefined, k * 0.25));
    this.tone(55, 2, 0.2, 'sine', 35, 0.9);
  }

  /** A menu button. */
  click(): void {
    if (!this.ready) return;
    this.tone(660, 0.06, 0.06, 'triangle');
  }
}

export const audio = new AudioEngine();
