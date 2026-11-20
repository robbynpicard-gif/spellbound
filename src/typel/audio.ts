/**
 * Typel audio (prototype, D-085). Everything is synthesized live with Web
 * Audio; no recorded or older-build sound is used. Character: warm wood and
 * brass mechanics, magical resonance, music with a sense of wonder that
 * layers up with pressure. All timbres and mixes are EXPLORATORY.
 */
import type { SpellId } from '../gameplay/SpellManager';

type Channel = 'music' | 'sfx' | 'voice';
export interface AudioSettings {
  music: { on: boolean; volume: number };
  sfx: { on: boolean; volume: number };
  voice: { on: boolean; volume: number };
}
const KEY = 'typel.audio.v1';
const DEFAULTS: AudioSettings = { music: { on: true, volume: 0.6 }, sfx: { on: true, volume: 0.8 }, voice: { on: true, volume: 0.8 } };

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AudioSettings> | null;
    if (!raw) return structuredClone(DEFAULTS);
    const ch = (c: Channel) => ({
      on: typeof raw[c]?.on === 'boolean' ? raw[c]!.on : DEFAULTS[c].on,
      volume: typeof raw[c]?.volume === 'number' ? Math.min(1, Math.max(0, raw[c]!.volume)) : DEFAULTS[c].volume,
    });
    return { music: ch('music'), sfx: ch('sfx'), voice: ch('voice') };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

// D dorian (gameplay) and F lydian (menu), as MIDI note numbers.
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const degree = (root: number, scale: number[], d: number) => root + scale[((d % 7) + 7) % 7]! + 12 * Math.floor(d / 7);

type Mood = 'silent' | 'menu' | 'play' | 'boss';

class Music {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private bpm = 72;
  private mood: Mood = 'silent';
  intensity = 0;
  danger = 0;
  surge = 0;
  private layers: Record<string, GainNode> = {};

  constructor(private readonly a: TypelAudio) {}

  private layer(name: string): GainNode {
    let g = this.layers[name];
    if (!g) {
      g = this.a.ctx!.createGain();
      g.gain.value = 0;
      g.connect(this.a.bus('music'));
      this.layers[name] = g;
    }
    return g;
  }

  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    if (!this.a.ctx) return;
    if (mood === 'silent') return this.stop();
    this.step = 0;
    this.nextTime = this.a.ctx.currentTime + 0.1;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const t = this.a.ctx?.currentTime ?? 0;
    for (const g of Object.values(this.layers)) g.gain.setTargetAtTime(0, t, 0.3);
  }

  private targets(): Record<string, number> {
    const i = this.intensity;
    if (this.mood === 'menu') return { pad: 0.5, harp: 0.55, bass: 0.25, bell: 0.35, lead: 0.3, drum: 0, tick: 0, drone: 0, horn: 0 };
    const boss = this.mood === 'boss';
    return {
      pad: 0.45,
      harp: 0.25 + 0.35 * Math.min(1, i * 2),
      bass: i > 0.2 || boss ? 0.5 : 0.15,
      drum: i > 0.38 || boss ? 0.55 + (boss ? 0.15 : 0) : 0,
      tick: i > 0.62 || boss ? 0.35 : 0,
      bell: 0.25 + this.surge * 0.3,
      lead: this.surge > 0 ? 0.45 : 0,
      drone: Math.max(0, this.danger - 0.3) * 0.9,
      horn: boss ? 0.4 : 0,
    };
  }

  private schedule(): void {
    const ctx = this.a.ctx;
    if (!ctx || this.mood === 'silent') return;
    const targets = this.targets();
    for (const [k, v] of Object.entries(targets)) this.layer(k).gain.setTargetAtTime(v, ctx.currentTime, 0.6);
    const goal = this.mood === 'menu' ? 72 : this.mood === 'boss' ? 118 + this.intensity * 14 : 92 + this.intensity * 30;
    while (this.nextTime < ctx.currentTime + 0.15) {
      if (this.step % 16 === 0) this.bpm += (goal - this.bpm) * 0.35;
      this.play16th(this.step, this.nextTime, targets);
      this.nextTime += 60 / this.bpm / 4;
      this.step++;
    }
  }

  private play16th(n: number, t: number, on: Record<string, number>): void {
    const a = this.a;
    const s16 = 60 / this.bpm / 4;
    const bar = Math.floor(n / 16) % 8;
    const pos = n % 16;
    if (this.mood === 'menu') {
      // F lydian: Fmaj9 · G/F · Am7 · Em7 (twice), harp arpeggios and a flute motif.
      const roots = [0, 2, 4, -1, 0, 2, 4, 2];
      const r = roots[bar]!;
      const chord = [r, r + 2, r + 4, r + 6].map((d) => degree(53, LYDIAN, d));
      if (pos === 0) a.pad(chord.map(midi), t, s16 * 16, 0.05, this.layer('pad'));
      if (pos % 2 === 0) {
        const idx = [0, 1, 2, 3, 4, 3, 2, 1][(pos / 2) % 8]!;
        a.pluck(midi(degree(65, LYDIAN, r + idx * 2 - (idx > 3 ? 7 : 0))), t, 0.09, this.layer('harp'));
      }
      if (pos === 0) a.pluck(midi(degree(41, LYDIAN, r)), t, 0.14, this.layer('bass'), 2.4);
      const motif: Record<number, number[]> = { 0: [9, 8, 7], 2: [11, 9], 4: [7, 6, 4], 6: [6, 7, 9, 8] };
      const m = motif[bar];
      if (m && pos % 4 === 0 && pos / 4 < m.length) a.flute(midi(degree(65, LYDIAN, m[pos / 4]!)), t, s16 * 3.6, 0.06, this.layer('lead'));
      if (pos === 10 && bar % 2 === 1) a.bell(midi(degree(77, LYDIAN, r + 4)), t, 0.03, this.layer('bell'));
      return;
    }
    // Gameplay / boss: D dorian. Boss borrows a darker progression.
    const boss = this.mood === 'boss';
    const roots = boss ? [0, 5, 3, 4, 0, 5, 3, 4] : [0, 0, 2, 6, 0, 5, 4, 6];
    const r = roots[bar]!;
    const chord = [r, r + 2, r + 4, r + 6].map((d) => degree(50, DORIAN, d));
    if (pos === 0) a.pad(chord.map(midi), t, s16 * 16, 0.045, this.layer('pad'));
    if (on.harp! > 0.01 && pos % 2 === 0) {
      const pattern = [0, 2, 4, 7, 4, 2, 4, 6];
      a.pluck(midi(degree(62, DORIAN, r + pattern[(pos / 2) % 8]!)), t, 0.07, this.layer('harp'));
    }
    if (on.bass! > 0.01 && (pos === 0 || pos === 6 || pos === 8 || pos === 14)) {
      const d = pos === 6 || pos === 14 ? r + 4 : r;
      a.pluck(midi(degree(38, DORIAN, d)), t, 0.16, this.layer('bass'), 1.2);
    }
    if (on.drum! > 0.01) {
      if (pos === 0 || pos === 8 || (pos === 11 && boss)) a.frameDrum(t, 0.4, this.layer('drum'));
      if (pos === 4 || pos === 12) a.frameDrum(t, 0.22, this.layer('drum'), 1.6);
      if (pos % 2 === 1) a.shaker(t, 0.05 + (pos % 4 === 3 ? 0.03 : 0), this.layer('drum'));
    }
    if (on.tick! > 0.01) a.tick(t, pos % 4 === 0 ? 0.09 : 0.045, this.layer('tick'));
    if (on.lead! > 0.01 && pos % 4 === 0) {
      const line = [7, 9, 10, 9, 7, 11, 9, 7, 6, 7, 9, 11, 12, 11, 9, 8];
      a.flute(midi(degree(74, DORIAN, line[(bar * 4 + pos / 4) % 16]!)), t, s16 * 3.4, 0.06, this.layer('lead'));
    }
    if (on.bell! > 0.01 && pos === 14 && bar % 2 === 0) a.bell(midi(degree(86, DORIAN, r + 4)), t, 0.025, this.layer('bell'));
    if (on.drone! > 0.01 && pos === 0 && bar % 2 === 0) a.drone(midi(26), t, s16 * 32, this.layer('drone'));
    if (on.horn! > 0.01 && pos === 0 && bar % 4 === 0) a.horn([midi(degree(50, DORIAN, r)), midi(degree(50, DORIAN, r + 4))], t, s16 * 8, this.layer('horn'));
  }
}

export class TypelAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses: Partial<Record<Channel, GainNode>> = {};
  private reverbIn!: GainNode;
  private noise!: AudioBuffer;
  settings: AudioSettings = loadAudioSettings();
  readonly music = new Music(this);
  private lastKey = 0;

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);
      // Room: a warm stone-and-wood study.
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 2.4);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      conv.buffer = ir;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3800;
      this.reverbIn = ctx.createGain();
      this.reverbIn.gain.value = 0.28;
      this.reverbIn.connect(conv).connect(lp).connect(this.master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = this.noise.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      for (const c of ['music', 'sfx', 'voice'] as const) {
        const g = ctx.createGain();
        g.connect(this.master);
        g.connect(this.reverbIn);
        this.buses[c] = g;
      }
      this.apply();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  bus(c: Channel): GainNode {
    return this.buses[c]!;
  }

  apply(settings: AudioSettings = this.settings): void {
    this.settings = settings;
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* not persisted */
    }
    if (!this.ctx) return;
    for (const c of ['music', 'sfx', 'voice'] as const) {
      const v = settings[c].on ? settings[c].volume : 0;
      this.buses[c]!.gain.setTargetAtTime(c === 'music' ? v * 0.55 : v, this.ctx.currentTime, 0.05);
    }
  }

  private get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private get ok(): boolean {
    return !!this.ctx && this.settings.sfx.on;
  }

  // ───────────── voices ─────────────

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  osc(type: OscillatorType, f0: number, t: number, dur: number, peak: number, dest: AudioNode, f1?: number, attack = 0.004): OscillatorNode {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g, t, peak, attack, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  noiseHit(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, dest: AudioNode, freqEnd?: number, attack = 0.002): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, attack, dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + attack + dur + 0.05);
  }

  pluck(f: number, t: number, peak: number, dest: AudioNode, decay = 0.9): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + decay * 0.6);
    lp.connect(dest);
    this.osc('triangle', f, t, decay, peak, lp);
    this.osc('sine', f * 2, t, decay * 0.5, peak * 0.3, lp);
  }

  pad(freqs: number[], t: number, dur: number, peak: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(dest);
    for (const f of freqs)
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak / freqs.length, t + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + dur * 1.1);
      }
  }

  flute(f: number, t: number, dur: number, peak: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.value = f * 0.006;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.08);
    g.gain.setValueAtTime(peak, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
    this.noiseHit(t, 0.12, 'bandpass', f * 2, 2, peak * 0.25, dest);
  }

  bell(f: number, t: number, peak: number, dest: AudioNode): void {
    [1, 2.76, 5.4, 8.93].forEach((r, i) => this.osc('sine', f * r, t, 1.6 / (i + 1), peak / (i + 1), dest));
  }

  frameDrum(t: number, peak: number, dest: AudioNode, pitch = 1): void {
    this.osc('sine', 110 * pitch, t, 0.28, peak, dest, 48 * pitch);
    this.noiseHit(t, 0.06, 'lowpass', 900, 0.7, peak * 0.4, dest);
  }

  shaker(t: number, peak: number, dest: AudioNode): void {
    this.noiseHit(t, 0.05, 'highpass', 6000, 0.6, peak, dest, undefined, 0.01);
  }

  tick(t: number, peak: number, dest: AudioNode): void {
    this.noiseHit(t, 0.015, 'bandpass', 3200, 6, peak, dest);
    this.osc('sine', 2400, t, 0.02, peak * 0.4, dest);
  }

  drone(f: number, t: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const trem = ctx.createOscillator();
    trem.frequency.value = 6;
    const tg = ctx.createGain();
    tg.gain.value = 0.25;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    trem.connect(tg).connect(g.gain);
    o.connect(lp).connect(g).connect(dest);
    o.start(t);
    trem.start(t);
    o.stop(t + dur + 0.1);
    trem.stop(t + dur + 0.1);
  }

  horn(freqs: number[], t: number, dur: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(1400, t + 0.15);
    lp.frequency.linearRampToValueAtTime(700, t + dur);
    lp.connect(dest);
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.12);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  // ───────────── typing ─────────────

  /** One keystroke: wooden thunk, typebar strike, a little brass ring. */
  key(char: string): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    const v = 1 + ((char.charCodeAt(0) % 7) - 3) * 0.018 + (Math.random() - 0.5) * 0.02;
    // A quick double strike sounds thinner, like a real machine.
    const quick = t - this.lastKey < 0.07 ? 0.85 : 1;
    this.lastKey = t;
    this.osc('sine', 150 * v, t, 0.07, 0.42 * quick, out, 62);
    this.noiseHit(t, 0.035, 'bandpass', 620 * v, 1.3, 0.32 * quick, out);
    this.noiseHit(t + 0.004, 0.008, 'highpass', 2600, 0.8, 0.12, out);
    [1, 2.32, 3.81].forEach((r, i) => this.osc('sine', 1480 * v * r, t + 0.006, 0.16 / (i + 1), 0.022 / (i + 1), out));
  }

  backspace(): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    this.noiseHit(t, 0.04, 'bandpass', 420, 1.5, 0.22, out);
    this.osc('sine', 90, t, 0.05, 0.2, out, 120);
  }

  /** A wrong letter: a dull, jammed key and a small sour brass note. */
  typo(): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    this.osc('sine', 110, t, 0.09, 0.4, out, 70);
    this.noiseHit(t, 0.05, 'lowpass', 320, 1, 0.3, out);
    this.osc('sine', 233, t + 0.01, 0.14, 0.06, out);
    this.osc('sine', 247, t + 0.01, 0.14, 0.06, out);
  }

  /** Word captured: carriage ka-chunk, then a bell that climbs with the Combo. */
  capture(step: number, volley: number, perfect: boolean): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    this.osc('sine', 120, t, 0.09, 0.5, out, 55);
    this.noiseHit(t, 0.05, 'bandpass', 900, 1.1, 0.3, out);
    for (let i = 0; i < 3; i++) this.noiseHit(t + 0.03 + i * 0.016, 0.01, 'highpass', 3000, 1, 0.08, out);
    const note = degree(74, DORIAN, step % 14);
    this.bell(midi(note), t + 0.02, perfect ? 0.07 : 0.04, out);
    if (volley > 1) {
      const sparks = Math.min(5, Math.round((volley - 1) * 3));
      for (let i = 0; i < sparks; i++) this.osc('sine', midi(note + 12 + DORIAN[i % 7]!), t + 0.05 + i * 0.035, 0.18, 0.025, out);
    }
  }

  /** Enter on a wrong word: a crumpled sheet. */
  wrongEntry(): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    for (let i = 0; i < 5; i++) this.noiseHit(t + i * 0.025 + Math.random() * 0.01, 0.04, 'bandpass', 1400 + Math.random() * 1500, 1.2, 0.12, out);
    this.osc('sine', 80, t, 0.18, 0.35, out, 45);
  }

  /** A word broke through the Ward: cracking glass and a low blow. */
  breach(): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    for (let i = 0; i < 7; i++) this.noiseHit(t + Math.random() * 0.09, 0.03, 'highpass', 3500 + Math.random() * 3000, 2, 0.16, out);
    this.osc('sine', 62, t, 0.55, 0.6, out, 34);
    this.osc('triangle', 196, t, 0.3, 0.05, out, 150);
  }

  collect(): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    this.noiseHit(t, 0.12, 'bandpass', 1800, 2, 0.12, out, 4200);
    this.bell(midi(86), t + 0.04, 0.04, out);
  }

  overflow(): void {
    if (!this.ok) return;
    const t = this.now;
    this.noiseHit(t, 0.25, 'bandpass', 2400, 1, 0.1, this.bus('sfx'), 500);
  }

  fizzle(): void {
    if (!this.ok) return;
    const t = this.now;
    this.noiseHit(t, 0.2, 'lowpass', 1200, 1, 0.15, this.bus('sfx'), 200);
  }

  // ───────────── spells ─────────────

  spell(id: SpellId): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    switch (id) {
      case 'slow': {
        // Time thickening: a chord slides down and the ticking slows.
        for (const n of [62, 65, 69]) this.osc('sawtooth', midi(n), t, 1.2, 0.04, out, midi(n - 12));
        for (let i = 0; i < 6; i++) this.tick(t + 0.1 + i * (0.12 + i * 0.06), 0.12, out);
        break;
      }
      case 'ice': {
        // Crystal stasis: glassy partials climbing, and a cold hiss.
        [84, 88, 91, 96, 100].forEach((n, i) => this.bell(midi(n), t + i * 0.05, 0.035, out));
        this.noiseHit(t, 0.9, 'highpass', 5000, 0.7, 0.1, out, 9000, 0.05);
        break;
      }
      case 'fire': {
        this.noiseHit(t, 0.9, 'lowpass', 300, 0.8, 0.35, out, 2600, 0.08);
        for (let i = 0; i < 14; i++) this.noiseHit(t + 0.1 + Math.random() * 1.1, 0.012, 'highpass', 2000, 1, 0.1 + Math.random() * 0.1, out);
        this.osc('sine', 70, t, 0.8, 0.3, out, 40);
        break;
      }
      case 'shock': {
        for (let i = 0; i < 4; i++) this.osc('square', 1800, t + i * 0.05, 0.05, 0.05, out, 120);
        this.noiseHit(t, 0.25, 'bandpass', 3000, 3, 0.25, out, 800);
        this.osc('sine', 55, t + 0.02, 0.5, 0.4, out, 35);
        break;
      }
      case 'wind':
        this.gust(1);
        break;
      case 'barrier': {
        // A singing bowl, beating slightly.
        for (const [f, p] of [[220, 0.12], [596, 0.06], [1133, 0.035]] as const) {
          this.osc('sine', f, t, 2.6, p, out);
          this.osc('sine', f + 1.6, t, 2.6, p * 0.7, out);
        }
        break;
      }
      case 'alter': {
        // Ink rewriting itself: bubbling blips and a pour.
        for (let i = 0; i < 9; i++) this.osc('sine', 300 + i * 60, t + i * 0.045, 0.07, 0.07, out, 700 + i * 90);
        this.noiseHit(t, 0.6, 'bandpass', 700, 2, 0.1, out, 1800, 0.1);
        break;
      }
      case 'harvest': {
        this.noiseHit(t, 0.5, 'bandpass', 500, 1.2, 0.2, out, 4000, 0.05);
        [0, 2, 4, 7, 9, 11, 14].forEach((d, i) => this.bell(midi(degree(74, DORIAN, d)), t + 0.08 + i * 0.05, 0.05, out));
        this.osc('sine', 73, t, 0.6, 0.3, out);
        break;
      }
    }
  }

  gust(strength: number): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    this.noiseHit(t, 1.8 * strength, 'bandpass', 380, 0.8, 0.3 * strength, out, 1300, 0.3);
    this.noiseHit(t + 0.3, 1.2, 'bandpass', 900, 1.5, 0.1, out, 400, 0.2);
  }

  /** Wind All-In: the Ward is drained into power. Heartbeat, crack, riser. */
  wager(): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    this.gust(1.3);
    for (const d of [0, 0.22]) this.osc('sine', 58, t + d, 0.25, 0.55, out, 40);
    for (let i = 0; i < 6; i++) this.noiseHit(t + 0.45 + Math.random() * 0.08, 0.03, 'highpass', 4000, 2, 0.14, out);
    this.noiseHit(t + 0.5, 1.2, 'bandpass', 300, 2, 0.2, out, 3500, 0.6);
    this.pad([midi(50), midi(57), midi(62), midi(69)], t + 0.6, 1.4, 0.12, out);
  }

  heal(): void {
    if (!this.ok) return;
    const t = this.now;
    [62, 66, 69, 74].forEach((n, i) => this.bell(midi(n), t + i * 0.06, 0.04, this.bus('sfx')));
  }

  shockArc(depth: number): void {
    if (!this.ok) return;
    const t = this.now;
    this.osc('square', 2200 - depth * 150, t, 0.06, 0.04, this.bus('sfx'), 300);
  }

  // ───────────── momentum and rewards ─────────────

  volleyStep(multiplier: number): void {
    if (!this.ok) return;
    const t = this.now;
    const n = 74 + Math.min(24, Math.round((multiplier - 1) * 5));
    this.osc('triangle', midi(n), t + 0.04, 0.12, 0.035, this.bus('sfx'));
  }

  /** Volley ignites: a rising rush, a boom and a bright chord. */
  ignite(): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    this.noiseHit(t, 0.45, 'bandpass', 400, 1.2, 0.25, out, 6000, 0.35);
    this.osc('sine', 50, t + 0.42, 0.7, 0.6, out, 32);
    [62, 69, 74, 78, 81].forEach((n, i) => this.bell(midi(n), t + 0.42 + i * 0.03, 0.06, out));
    this.pad([midi(50), midi(57), midi(64), midi(69)], t + 0.42, 1.2, 0.14, out);
  }

  volleyBreak(): void {
    if (!this.ok) return;
    const t = this.now;
    this.osc('triangle', midi(74), t, 0.3, 0.05, this.bus('sfx'), midi(62));
  }

  focus(gain: number): void {
    if (!this.ok) return;
    const t = this.now;
    this.bell(midi(91 + Math.min(12, gain)), t + 0.03, 0.05, this.bus('sfx'));
  }

  /** Rune: the carousel clacks round, then a chord by tier. */
  rune(tier: number): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    for (let i = 0; i < 5; i++) this.noiseHit(t + i * (0.07 - i * 0.008), 0.012, 'bandpass', 2600, 4, 0.1, out);
    const chord = tier >= 3 ? [62, 66, 69, 74, 78] : tier === 2 ? [64, 67, 71, 76] : [67, 71, 74];
    chord.forEach((n, i) => this.bell(midi(n), t + 0.3 + i * 0.04, 0.05, out));
  }

  levelClear(): void {
    if (!this.ok) return;
    const t = this.now;
    [50, 57, 62, 66, 69, 74].forEach((n, i) => this.pluck(midi(n), t + i * 0.07, 0.12, this.bus('sfx'), 1.6));
    this.bell(midi(86), t + 0.45, 0.05, this.bus('sfx'));
  }

  bossStart(): void {
    if (!this.ok) return;
    this.horn([midi(38), midi(45), midi(50)], this.now, 2.2, this.bus('sfx'));
  }

  victory(): void {
    if (!this.ok) return;
    const t = this.now;
    this.horn([midi(50), midi(54), midi(57), midi(62)], t, 2.6, this.bus('sfx'));
    [74, 78, 81, 86].forEach((n, i) => this.bell(midi(n), t + 0.2 + i * 0.12, 0.06, this.bus('sfx')));
  }

  defeat(): void {
    if (!this.ok) return;
    const t = this.now;
    [62, 58, 55, 50].forEach((n, i) => this.pluck(midi(n), t + i * 0.22, 0.14, this.bus('sfx'), 1.8));
    this.osc('sine', 45, t, 1.6, 0.4, this.bus('sfx'), 30);
  }

  click(): void {
    if (!this.ok) return;
    const t = this.now;
    this.noiseHit(t, 0.03, 'bandpass', 900, 1.5, 0.18, this.bus('sfx'));
    this.osc('sine', 700, t, 0.04, 0.03, this.bus('sfx'));
  }

  // ───────────── music control ─────────────

  setMood(mood: Mood): void {
    this.music.setMood(mood);
  }
  setPressure(intensity: number, danger: number, surge: number): void {
    this.music.intensity = Math.min(1, Math.max(0, intensity));
    this.music.danger = Math.min(1, Math.max(0, danger));
    this.music.surge = surge;
  }
}

export const sound = new TypelAudio();
