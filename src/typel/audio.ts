/**
 * TypeL audio (prototype, D-085). Everything is synthesized live with Web
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

// Scales (semitones) and helpers.
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const degree = (root: number, scale: number[], d: number) => root + scale[((d % 7) + 7) % 7]! + 12 * Math.floor(d / 7);
const mod12 = (n: number) => ((n % 12) + 12) % 12;

type Mood = 'silent' | 'menu' | 'play' | 'boss';
/** [step in the bar (16ths), semitones from the tonic, length in 16ths] */
type Note = [step: number, semis: number, length: number];

/*
 * D-092 music: a relaxed Renaissance world that only gets fast when the
 * situation demands it. Lute, recorder, viols and a bass viol, drenched in
 * a stereo echo and a stone hall. Play and boss are a lilting 6/8 dance;
 * the menu is a slow 3/4 air. All original composition.
 */

/** Gameplay dance in D Dorian, 6/8 (12 sixteenths a bar), 16 bars. */
const PLAY_TUNE: Note[][] = [
  [[0, 7, 4], [4, 5, 2], [6, 3, 4], [10, 2, 2]],
  [[0, 5, 6], [6, 2, 4], [10, -2, 2]],
  [[0, 0, 4], [4, 2, 2], [6, 3, 4], [10, 5, 2]],
  [[0, 9, 6], [6, 7, 4], [10, 5, 2]],
  [[0, 7, 4], [4, 10, 2], [6, 7, 4], [10, 3, 2]],
  [[0, 5, 4], [4, 2, 2], [6, 5, 4], [10, 10, 2]],
  [[0, 12, 4], [4, 10, 2], [6, 7, 4], [10, 3, 2]],
  [[0, 2, 6], [6, -1, 6]],
  [[0, 15, 6], [6, 14, 4], [10, 12, 2]],
  [[0, 10, 4], [4, 12, 2], [6, 14, 4], [10, 10, 2]],
  [[0, 9, 4], [4, 10, 2], [6, 12, 4], [10, 9, 2]],
  [[0, 7, 6], [6, 3, 4], [10, 7, 2]],
  [[0, 10, 4], [4, 7, 2], [6, 3, 4], [10, 7, 2]],
  [[0, 5, 4], [4, 7, 2], [6, 10, 4], [10, 7, 2]],
  [[0, 14, 4], [4, 12, 2], [6, 11, 6]],
  [[0, 12, 10]],
];
// Chords as semitones from the tonic, root first.
const Dm = [0, 3, 7], C = [-2, 2, 5], G = [5, 9, 12], F = [3, 7, 10], A = [7, 11, 14], Gm = [5, 8, 12], Bb = [-4, 0, 3];
const PLAY_CHORDS = [Dm, C, Dm, G, F, C, Dm, A, F, C, G, Dm, F, C, A, Dm];
const BOSS_CHORDS = [Dm, Bb, Dm, A, Bb, F, Gm, A, Dm, Bb, C, A, Gm, Bb, A, Dm];
/** Menu air in G Mixolydian, 3/4 (12 sixteenths a bar), 8 bars. */
const MENU_TUNE: Note[][] = [
  [[0, 7, 8], [8, 4, 4]],
  [[0, 5, 8], [8, 9, 4]],
  [[0, 7, 4], [4, 9, 2], [6, 7, 2], [8, 4, 4]],
  [[0, 2, 8], [8, -1, 4]],
  [[0, 4, 4], [4, 7, 4], [8, 12, 4]],
  [[0, 9, 8], [8, 7, 4]],
  [[0, 10, 6], [6, 9, 2], [8, 5, 4]],
  [[0, 2, 4], [4, 0, 8]],
];
const MENU_CHORDS = [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14], [-3, 0, 4], [5, 9, 12], [-2, 2, 5], [0, 4, 7]];

class Music {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  /** Beats per minute: dotted quarters in the 6/8 dance, quarters in the menu air. */
  private beat = 50;
  mood: Mood = 'silent';
  /** How much the situation demands urgency, 0–1 (set by the play scene). */
  intensity = 0;
  danger = 0;
  surge = 0;
  /** Smoothed stress: rises within a couple of seconds, relaxes slowly. */
  private stress = 0;
  private lastTick = 0;
  private layers: Record<string, GainNode> = {};
  private input: GainNode | null = null;
  private echoSend!: GainNode;
  private delays: DelayNode[] = [];

  constructor(private readonly a: TypeLAudio) {}

  /** The music's own echo and hall, so it rings like the typewriter does. */
  private fx(): GainNode {
    if (this.input) return this.input;
    const ctx = this.a.ctx!;
    const out = this.a.bus('music');
    const input = ctx.createGain();
    input.connect(out);
    // Ping-pong echo: left, right, left… each repeat a little darker.
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0.32;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 260;
    const dl = ctx.createDelay(3);
    const dr = ctx.createDelay(3);
    dl.delayTime.value = dr.delayTime.value = 0.6;
    const fbL = ctx.createGain();
    const fbR = ctx.createGain();
    fbL.gain.value = fbR.gain.value = 0.55;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 2400;
    const merge = ctx.createChannelMerger(2);
    input.connect(this.echoSend).connect(hp).connect(dl);
    dl.connect(merge, 0, 0);
    dl.connect(fbL).connect(dr);
    dr.connect(merge, 0, 1);
    dr.connect(fbR).connect(dark).connect(dl);
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.8;
    merge.connect(echoOut).connect(out);
    this.delays = [dl, dr];
    // A big stone hall, longer and softer than the study room the effects use.
    const hall = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 4.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    const pre = Math.floor(ctx.sampleRate * 0.03);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = pre; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    hall.buffer = ir;
    const hallSend = ctx.createGain();
    hallSend.gain.value = 0.34;
    const hallTone = ctx.createBiquadFilter();
    hallTone.type = 'lowpass';
    hallTone.frequency.value = 3000;
    input.connect(hallSend).connect(hall).connect(hallTone).connect(out);
    this.input = input;
    return input;
  }

  private layer(name: string, pan = 0): GainNode {
    let g = this.layers[name];
    if (!g) {
      const ctx = this.a.ctx!;
      g = ctx.createGain();
      g.gain.value = 0;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.fx());
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
    this.lastTick = this.a.ctx.currentTime;
    if (this.mood === 'menu') this.stress = 0;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const t = this.a.ctx?.currentTime ?? 0;
    for (const g of Object.values(this.layers)) g.gain.setTargetAtTime(0, t, 0.3);
  }

  private targets(): Record<string, number> {
    if (this.mood === 'menu') return { lute: 0.6, bass: 0.45, melody: 0.5, viol: 0.3, shimmer: 0, drums: 0, reed: 0, tremolo: 0 };
    const st = this.stress;
    const s = this.surge;
    return {
      lute: 0.6,
      bass: 0.5,
      melody: 0.5,
      viol: 0.26 + st * 0.2,
      shimmer: s > 0 ? 0.35 + s * 0.35 : 0,
      drums: st < 0.22 ? 0 : Math.min(0.65, (st - 0.22) * 1.3),
      reed: st < 0.5 ? 0 : Math.min(0.5, (st - 0.5) * 1.5),
      tremolo: Math.max(0, this.danger - 0.4) * 1.1 + (st > 0.82 ? 0.25 : 0),
    };
  }

  private s16(): number {
    return 60 / this.beat / (this.mood === 'menu' ? 4 : 6);
  }

  private schedule(): void {
    const ctx = this.a.ctx;
    if (!ctx || this.mood === 'silent') return;
    const now = ctx.currentTime;
    const dt = Math.max(0, now - this.lastTick);
    this.lastTick = now;
    const want = this.mood === 'menu' ? 0 : this.mood === 'boss' ? Math.max(0.3, this.intensity) : this.intensity;
    const tau = want > this.stress ? 1.4 : 6;
    this.stress += (want - this.stress) * (1 - Math.exp(-dt / tau));
    const targets = this.targets();
    for (const [k, v] of Object.entries(targets)) this.layer(k).gain.setTargetAtTime(v, now, 0.6);
    // Relaxed while things go well; faster only as the danger climbs.
    const goal = this.mood === 'menu' ? 62 : this.mood === 'boss' ? 56 + this.stress * 38 : 50 + this.stress * 40 + this.surge * 3;
    while (this.nextTime < now + 0.15) {
      if (this.step % 12 === 0) {
        this.beat += (goal - this.beat) * 0.5;
        // Echo repeats land in time: a dotted eighth (or an eighth in the menu air).
        const d = this.s16() * (this.mood === 'menu' ? 2 : 3);
        for (const dl of this.delays) dl.delayTime.setTargetAtTime(d, this.nextTime, 0.4);
        this.echoSend.gain.setTargetAtTime(0.34 - this.stress * 0.16 + this.surge * 0.14, this.nextTime, 0.8);
      }
      this.bar(this.step, this.nextTime, targets);
      this.nextTime += this.s16();
      this.step++;
    }
  }

  private bar(n: number, t: number, on: Record<string, number>): void {
    const a = this.a;
    const menu = this.mood === 'menu';
    const boss = this.mood === 'boss';
    const st = this.stress;
    const s16 = this.s16();
    const pos = n % 12;
    const tune = menu ? MENU_TUNE : PLAY_TUNE;
    const b = Math.floor(n / 12) % tune.length;
    const tonic = menu ? 67 : 62;
    // Danger (and the boss) flattens the bright Dorian B into a darker B♭.
    const darken = !menu && (boss || this.danger > 0.6);
    const fix = (x: number) => (darken && mod12(x) === 9 ? x - 1 : x);
    const chord = (menu ? MENU_CHORDS : boss ? BOSS_CHORDS : PLAY_CHORDS)[b]!.map(fix);
    const tones = chord.map((x) => tonic - 12 + mod12(x)).sort((x, y) => x - y);
    let bass = tonic - 24 + mod12(chord[0]!);
    if (bass > tonic - 24 + 7) bass -= 12;

    // Bass viol on the strong beats; it starts driving the off-beats under pressure.
    if (pos === 0) a.bassViol(midi(bass), t, s16 * (menu ? 11 : 5.5), 0.17, this.layer('bass'));
    if (!menu && pos === 6) a.bassViol(midi(bass + 7), t, s16 * 5, 0.12, this.layer('bass'));
    if (!menu && (st > 0.55 || boss) && (pos === 3 || pos === 9)) a.bassViol(midi(bass), t, s16 * 1.6, 0.09, this.layer('bass'));

    // Lute: a fingerpicked arpeggio on the eighths, in sixteenths when things get hairy.
    const arp = [tones[0]!, tones[1]!, tones[2]!, tones[0]! + 12, tones[2]!, tones[1]!];
    const busy = !menu && st > 0.68;
    if (busy || pos % 2 === 0) {
      const note = busy ? arp[pos % 6]! : arp[pos / 2]!;
      a.lute(midi(note), t, pos === 0 ? 0.11 : 0.08, this.layer('lute', -0.3), busy ? 0.7 : 1.4);
    }

    // Viols: a soft sustained chord under each bar.
    if (pos === 0) a.viol(tones.map((m) => midi(m + 12)), t, s16 * 12, 0.028, this.layer('viol'));

    // The tune: a recorder, doubled by a nasal crumhorn an octave down when it's tense.
    for (const [step, semis, len] of tune[b]!) {
      if (step !== pos) continue;
      const m = tonic + fix(semis);
      a.recorder(midi(m), t, s16 * len * 0.92, 0.075, this.layer('melody', 0.25));
      if (on.reed! > 0.01) a.crumhorn(midi(m - 12), t, s16 * len * 0.8, 0.05, this.layer('reed', -0.15));
    }

    // Arcane Rush: a shimmering harp climbing through the chord.
    if (on.shimmer! > 0.01) {
      const climb = tones[pos % 3]! + 24 + 12 * Math.floor((pos % 6) / 3);
      a.harp(midi(climb), t, 0.03, this.layer('shimmer'));
      if (pos === 0) a.glock(midi(tones[0]! + 36), t, 0.035, this.layer('shimmer'));
    }

    // Hand drum and tambourine: absent while calm, building with the danger.
    if (on.drums! > 0.01) {
      if (pos === 0) a.frameDrum(t, 0.22, this.layer('drums', 0.1));
      if (pos === 6) a.frameDrum(t, 0.14, this.layer('drums', 0.1), 1.2);
      if (st > 0.5 && pos % 2 === 0 && pos !== 0) a.shaker(t, 0.05, this.layer('drums', 0.1));
      if (st > 0.8 && (pos === 3 || pos === 9)) a.frameDrum(t, 0.12, this.layer('drums', 0.1), 1.4);
    }

    // Trembling viols when the Ward is in real trouble.
    if (on.tremolo! > 0.01) a.strings([midi(bass + 12)], t, s16 * 0.9, 0.04, this.layer('tremolo'));
  }
}

export class TypeLAudio {
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

  // ── Renaissance consort (D-092; synthesized stand-ins) ──

  /** Lute: a double-strung pluck that blooms and darkens. */
  lute(f: number, t: number, peak: number, dest: AudioNode, decay = 1.4): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 7, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + decay * 0.5);
    lp.Q.value = 0.7;
    lp.connect(dest);
    this.osc('triangle', f, t, decay, peak, lp, undefined, 0.002);
    this.osc('sawtooth', f * 1.003, t, decay * 0.7, peak * 0.3, lp, undefined, 0.002);
    this.noiseHit(t, 0.012, 'bandpass', Math.min(8000, f * 4), 2, peak * 0.3, dest);
  }

  /** Recorder: a soft, breathy wooden flute with a gentle late vibrato. */
  recorder(f: number, t: number, dur: number, peak: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.05);
    g.gain.setValueAtTime(peak * 0.9, t + Math.max(0.06, dur - 0.08));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.12);
    g.connect(dest);
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.8;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.005, t + Math.min(dur, 0.6));
    vib.connect(vg);
    for (const [r, amp] of [[1, 1], [2, 0.08], [3, 0.03]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * r;
      vg.connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.2);
    }
    vib.start(t);
    vib.stop(t + dur + 0.2);
    this.noiseHit(t, 0.05, 'bandpass', Math.min(9000, f * 3), 3, peak * 0.3, dest);
  }

  /** Harp: a bright pluck with a long ring. */
  harp(f: number, t: number, peak: number, dest: AudioNode): void {
    this.osc('sine', f, t, 2.2, peak, dest, undefined, 0.002);
    this.osc('sine', f * 2, t, 1.1, peak * 0.25, dest, undefined, 0.002);
    this.osc('triangle', f, t, 0.25, peak * 0.3, dest, undefined, 0.002);
  }

  /** Viol consort: a soft bowed chord that swells in. */
  viol(freqs: number[], t: number, dur: number, peak: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    lp.connect(dest);
    for (const f of freqs)
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak / freqs.length, t + Math.min(0.5, dur * 0.35));
        g.gain.setValueAtTime(peak / freqs.length, t + dur * 0.75);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
  }

  /** Bass viol: a warm bowed low note. */
  bassViol(f: number, t: number, dur: number, peak: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.Q.value = 0.8;
    lp.connect(dest);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.04);
    g.gain.linearRampToValueAtTime(peak * 0.6, t + Math.min(dur * 0.5, 0.4));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    g.connect(lp);
    for (const type of ['sawtooth', 'triangle'] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  /** Crumhorn: the nasal Renaissance reed, for urgency. */
  crumhorn(f: number, t: number, dur: number, peak: number, dest: AudioNode): void {
    this.reed('square', f, t, dur, peak, dest, 1300);
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

  /**
   * A Rush that ran out: a soft, falling wind-down (two sines sliding down a
   * little further the higher the Rush was), not a bright ding. Wistful, not
   * punishing.
   */
  rushFade(peak: number): void {
    if (!this.ok) return;
    const t = this.now;
    const drop = Math.min(9, 4 + Math.round(peak));
    this.osc('sine', midi(67), t, 0.6, 0.035, this.bus('sfx'), midi(67 - drop), 0.03);
    this.osc('sine', midi(60), t + 0.08, 0.7, 0.025, this.bus('sfx'), midi(60 - drop), 0.04);
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

export const sound = new TypeLAudio();
