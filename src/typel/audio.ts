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

// Scales (semitones) and helpers. D-086: orchestral, whimsical, a little satirical.
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const degree = (root: number, scale: number[], d: number) => root + scale[((d % 7) + 7) % 7]! + 12 * Math.floor(d / 7);

type Mood = 'silent' | 'menu' | 'play' | 'boss';
type Note = [step: number, degree: number, length: number];

/** Gameplay scherzo: 8 bars of a bouncy, slightly cheeky staccato tune. */
const SCHERZO: Note[][] = [
  [[0, 0, 2], [2, 2, 2], [4, 4, 2], [6, 2, 2], [8, 7, 3], [12, 4, 3]],
  [[0, 6, 2], [2, 5, 2], [4, 4, 2], [6, 3, 2], [8, 4, 3], [12, 1, 3]],
  [[0, 5, 2], [2, 4, 2], [4, 5, 2], [6, 7, 2], [8, 9, 3], [12, 7, 3]],
  [[0, 8, 2], [2, 7, 2], [4, 6, 2], [6, 5, 2], [8, 3, 6]],
  [[0, 4, 2], [2, 4, 1], [3, 5, 1], [4, 6, 2], [6, 7, 2], [8, 11, 3], [12, 9, 3]],
  [[0, 8, 2], [2, 7, 2], [4, 6, 2], [6, 4, 2], [8, 6, 2], [10, 5, 2], [12, 4, 4]],
  [[0, 2, 2], [2, 4, 2], [4, 7, 4], [8, 9, 2], [10, 7, 2], [12, 4, 4]],
  [[0, 6, 2], [2, 5, 2], [4, 4, 2], [6, 3, 2], [8, 1, 2], [10, -1, 2], [12, 0, 4]],
];
const SCHERZO_CHORDS = [0, 4, 1, 3, 0, 4, 0, 4];
const GALOP_CHORDS = [0, 4, 0, 4, 5, 3, 4, 0];
/** Menu waltz in G (3/4): three beats per bar, null = rest. */
const WALTZ: (number | null)[][] = [[4, 7, 9], [11, 9, 7], [8, 7, 5], [6, null, 4], [4, 7, 11], [14, 12, 11], [10, 9, 8], [7, null, null]];
const WALTZ_CHORDS = [0, 5, 3, 4, 0, 5, 1, 0];

class Music {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private bpm = 96;
  mood: Mood = 'silent';
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
    if (mood === this.mood && this.timer !== null) return;
    this.mood = mood;
    this.ensure();
  }

  /** Start (or restart after the audio unlocks) the scheduler. */
  ensure(): void {
    if (!this.a.ctx) return;
    if (this.mood === 'silent') return this.stop();
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
    const boss = this.mood === 'boss';
    if (this.mood === 'menu') return { bass: 0.5, melody: 0.55, strings: 0.4, glock: 0.4, drums: 0, brass: 0, flute: 0.25, tremolo: 0 };
    const s = this.surge;
    return {
      bass: 0.6,
      melody: i > 0.12 || boss ? 0.55 : 0.3,
      strings: i > 0.32 || boss || s > 0 ? 0.42 : 0.15,
      glock: 0.22 + s * 0.35,
      drums: i > 0.5 || boss || s > 0 ? 0.5 : 0,
      brass: s > 0 || boss ? 0.45 + s * 0.2 : 0,
      flute: s > 0 ? 0.5 : 0,
      tremolo: Math.max(0, this.danger - 0.35) * 1.1,
    };
  }

  private schedule(): void {
    const ctx = this.a.ctx;
    if (!ctx || this.mood === 'silent') return;
    const targets = this.targets();
    for (const [k, v] of Object.entries(targets)) this.layer(k).gain.setTargetAtTime(v, ctx.currentTime, 0.5);
    const goal = this.mood === 'menu' ? 104 : this.mood === 'boss' ? 148 + this.intensity * 12 : 108 + this.intensity * 26 + this.surge * 10;
    const perBar = this.mood === 'menu' ? 12 : 16;
    while (this.nextTime < ctx.currentTime + 0.15) {
      if (this.step % perBar === 0) this.bpm += (goal - this.bpm) * 0.4;
      if (this.mood === 'menu') this.waltz(this.step, this.nextTime);
      else this.scherzo(this.step, this.nextTime, targets);
      this.nextTime += 60 / this.bpm / 4;
      this.step++;
    }
  }

  private waltz(n: number, t: number): void {
    const a = this.a;
    const s16 = 60 / this.bpm / 4;
    const bar = Math.floor(n / 12) % 8;
    const pos = n % 12;
    const root = 55; // G
    const r = WALTZ_CHORDS[bar]!;
    const chord = [r, r + 2, r + 4].map((d) => midi(degree(root, MAJOR, d)));
    if (pos === 0) {
      a.pizz(midi(degree(43, MAJOR, r)), t, 0.22, this.layer('bass'));
      a.strings(chord, t, s16 * 12, 0.035, this.layer('strings'));
    }
    if (pos === 4 || pos === 8) for (const f of chord) a.pizz(f, t, 0.07, this.layer('bass'));
    if (pos % 4 === 0) {
      const d = WALTZ[bar]![pos / 4];
      if (d !== null && d !== undefined) a.glock(midi(degree(79, MAJOR, d)), t, 0.07, this.layer('melody'));
    }
    if (pos === 6 && bar % 2 === 1) a.clarinet(midi(degree(67, MAJOR, r + 4)), t, s16 * 5, 0.05, this.layer('flute'));
  }

  private scherzo(n: number, t: number, on: Record<string, number>): void {
    const a = this.a;
    const s16 = 60 / this.bpm / 4;
    const bar = Math.floor(n / 16) % 8;
    const pos = n % 16;
    const boss = this.mood === 'boss';
    const root = boss ? 62 : 65; // D minor galop or F major scherzo
    const scale = boss ? HARMONIC_MINOR : this.danger > 0.65 ? DORIAN : MAJOR;
    const r = (boss ? GALOP_CHORDS : SCHERZO_CHORDS)[bar]!;
    const chord = [r, r + 2, r + 4].map((d) => degree(root - 12, scale, d));
    // oom-pah: tuba on the beat, pizzicato chord on the off-beat
    if (pos === 0 || pos === 8) a.tuba(midi(degree(root - 24, scale, pos === 0 ? r : r + 4)), t, s16 * 2.4, 0.2, this.layer('bass'));
    if (pos === 4 || pos === 12) for (const m of chord) a.pizz(midi(m), t, 0.06, this.layer('bass'));
    // the tune: bassoon, doubled by clarinet as things heat up
    for (const [step, d, len] of SCHERZO[bar]!) {
      if (step !== pos) continue;
      const m = degree(boss ? root - 12 : root - 12, scale, d);
      a.bassoon(midi(m), t, s16 * len * 0.8, 0.07, this.layer('melody'));
      if (on.strings! > 0.3 || boss) a.clarinet(midi(m + 12), t, s16 * len * 0.75, 0.045, this.layer('melody'));
      if (on.flute! > 0.01) a.flute(midi(m + 24), t, s16 * len * 0.7, 0.04, this.layer('flute'));
    }
    if (pos === 0 && on.strings! > 0.01) a.strings(chord.map((m) => midi(m + 12)), t, s16 * 16, 0.03, this.layer('strings'));
    if ((pos === 0 || pos === 6 || pos === 10) && on.glock! > 0.01) a.glock(midi(degree(root + 12, scale, r + (pos === 0 ? 4 : pos === 6 ? 2 : 7))), t, 0.05, this.layer('glock'));
    if (on.drums! > 0.01) {
      if (pos === 4 || pos === 12) a.snare(t, 0.12, this.layer('drums'));
      if (pos % 4 === 2) a.triangle(t, 0.03, this.layer('drums'));
      if ((bar === 0 || bar === 4) && pos === 0) a.timpani(midi(degree(root - 24, scale, 0)), t, 0.35, this.layer('drums'));
    }
    if (on.brass! > 0.01 && (pos === 0 || (boss && pos === 8))) a.horn(chord.map((m) => midi(m)), t, s16 * 3, this.layer('brass'));
    if (on.flute! > 0.01 && pos % 2 === 1 && bar % 2 === 1) a.glock(midi(degree(root + 24, scale, (pos + bar) % 8)), t, 0.03, this.layer('flute'));
    if (on.tremolo! > 0.01 && pos % 2 === 0) a.strings([midi(degree(root - 24, scale, r))], t, s16 * 1.6, 0.05, this.layer('tremolo'));
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
      this.music.ensure();
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
    [1, 2.76, 5.4, 8.93].forEach((r, i) => f * r < 18000 && this.osc('sine', f * r, t, 1.6 / (i + 1), peak / (i + 1), dest));
  }

  frameDrum(t: number, peak: number, dest: AudioNode, pitch = 1): void {
    this.osc('sine', 110 * pitch, t, 0.28, peak, dest, 48 * pitch);
    this.noiseHit(t, 0.06, 'lowpass', 900, 0.7, peak * 0.4, dest);
  }

  shaker(t: number, peak: number, dest: AudioNode): void {
    this.noiseHit(t, 0.05, 'highpass', 6000, 0.6, peak, dest, undefined, 0.01);
  }

  clockTick(t: number, peak: number, dest: AudioNode): void {
    this.noiseHit(t, 0.015, 'bandpass', 3200, 6, peak, dest);
    this.osc('sine', 2400, t, 0.02, peak * 0.4, dest);
  }

  // ── orchestral voices (synthesized stand-ins for a real orchestra) ──

  pizz(f: number, t: number, peak: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 5, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.15);
    lp.connect(dest);
    this.osc('sawtooth', f, t, 0.2, peak, lp, undefined, 0.002);
    this.osc('triangle', f, t, 0.25, peak * 0.8, lp, undefined, 0.002);
  }

  tuba(f: number, t: number, dur: number, peak: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260, t);
    lp.frequency.linearRampToValueAtTime(520, t + 0.05);
    lp.frequency.linearRampToValueAtTime(300, t + dur);
    lp.connect(dest);
    this.osc('sawtooth', f, t, dur, peak, lp, undefined, 0.025);
  }

  private reed(type: OscillatorType, f: number, t: number, dur: number, peak: number, dest: AudioNode, band: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.value = f * 0.004;
    vib.connect(vg).connect(o.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = band;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.03);
    g.gain.setValueAtTime(peak * 0.8, t + Math.max(0.04, dur - 0.04));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(g).connect(dest);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  bassoon(f: number, t: number, dur: number, peak: number, dest: AudioNode): void {
    this.reed('sawtooth', f, t, dur, peak, dest, 900);
  }

  clarinet(f: number, t: number, dur: number, peak: number, dest: AudioNode): void {
    this.reed('square', f, t, dur, peak, dest, 2200);
  }

  strings(freqs: number[], t: number, dur: number, peak: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.connect(dest);
    for (const f of freqs)
      for (const det of [-9, 0, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak / freqs.length, t + Math.min(0.18, dur * 0.3));
        g.gain.setValueAtTime(peak / freqs.length, t + dur * 0.8);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
  }

  glock(f: number, t: number, peak: number, dest: AudioNode): void {
    [1, 2.76, 5.4].forEach((r, i) => this.osc('sine', f * r, t, 0.9 / (i + 1), peak / (i + 1.5), dest, undefined, 0.001));
  }

  snare(t: number, peak: number, dest: AudioNode): void {
    this.noiseHit(t, 0.1, 'bandpass', 1900, 0.9, peak, dest);
    this.osc('triangle', 210, t, 0.05, peak * 0.6, dest, 160);
  }

  triangle(t: number, peak: number, dest: AudioNode): void {
    this.osc('sine', 4200, t, 0.5, peak, dest, undefined, 0.001);
    this.osc('sine', 6100, t, 0.3, peak * 0.5, dest, undefined, 0.001);
  }

  timpani(f: number, t: number, peak: number, dest: AudioNode): void {
    this.osc('sine', f * 1.05, t, 0.9, peak, dest, f, 0.003);
    this.noiseHit(t, 0.12, 'lowpass', 400, 0.7, peak * 0.4, dest);
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
    const note = degree(74, MAJOR, step % 14);
    this.osc('sine', 700, t, 0.05, 0.12, out, 1500);
    this.glock(midi(note), t + 0.02, perfect ? 0.12 : 0.07, out);
    if (volley > 1) {
      const sparks = Math.min(5, Math.round((volley - 1) * 3));
      for (let i = 0; i < sparks; i++) this.osc('sine', midi(note + 12 + MAJOR[i % 7]!), t + 0.05 + i * 0.035, 0.18, 0.03, out);
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
        for (let i = 0; i < 6; i++) this.clockTick(t + 0.1 + i * (0.12 + i * 0.06), 0.12, out);
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
        [0, 2, 4, 7, 9, 11, 14].forEach((d, i) => this.glock(midi(degree(74, MAJOR, d)), t + 0.08 + i * 0.05, 0.08, out));
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

  /** Backspace (D-086): a crisp reverse "schwip" and the carriage ratcheting back. */
  erase(length: number): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    const lift = 1 + Math.min(10, length) * 0.03;
    this.noiseHit(t, 0.07, 'bandpass', 3600 * lift, 2.5, 0.22, out, 900, 0.004);
    this.osc('sine', 520 * lift, t, 0.06, 0.08, out, 260);
    for (let i = 0; i < 2; i++) this.noiseHit(t + 0.03 + i * 0.025, 0.008, 'highpass', 4200, 1, 0.07, out);
  }

  /** Catch loop: a cartoon slide whistle, falling faster at higher urgency. */
  plunge(tier: number): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    const dur = 0.7 - tier * 0.14;
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1500 + tier * 300, t);
    o.frequency.exponentialRampToValueAtTime(260, t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = 9;
    const vg = ctx.createGain();
    vg.gain.value = 30;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.03);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  /** Ice melting early on a cleared board: drips and a soft chime. */
  thaw(): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    for (let i = 0; i < 6; i++) this.osc('sine', 900 + Math.random() * 900, t + i * 0.13 + Math.random() * 0.05, 0.12, 0.06, out, 1600);
    this.bell(midi(84), t + 0.2, 0.04, out);
  }

  /** Combo multiplier up: a short, proud brass fanfare. */
  comboUp(mult: number): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    const base = 65 + Math.min(7, mult - 2) * 2;
    [0, 4, 7, 12].forEach((s, i) => this.horn([midi(base + s)], t + i * 0.07, 0.22 + (i === 3 ? 0.4 : 0), out));
    this.noiseHit(t + 0.21, 0.5, 'highpass', 6000, 0.5, 0.08, out);
    this.glock(midi(base + 24), t + 0.21, 0.08, out);
  }

  /** A claimed spell scroll swishing across to the rack. */
  swish(): void {
    if (!this.ok) return;
    const t = this.now;
    this.noiseHit(t, 0.4, 'bandpass', 700, 1.4, 0.18, this.bus('sfx'), 3200, 0.12);
  }

  /** ...and knocking into its wooden shelf. */
  thunk(): void {
    if (!this.ok) return;
    const t = this.now;
    const out = this.bus('sfx');
    this.osc('sine', 180, t, 0.12, 0.5, out, 80);
    this.noiseHit(t, 0.06, 'bandpass', 500, 1.6, 0.35, out);
    this.glock(midi(88), t + 0.04, 0.05, out);
  }

  /** Score tally chips landing one by one. */
  tick(i: number): void {
    if (!this.ok) return;
    const t = this.now;
    this.osc('square', 880 * Math.pow(1.122, i), t, 0.04, 0.035, this.bus('sfx'));
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
