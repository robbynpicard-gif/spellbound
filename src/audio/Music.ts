import { midi, type Synth } from './synth';

/**
 * The dynamic score (decisions.md D-041).
 *
 * One continuous piece in D minor, played by a sample-accurate scheduler, so
 * nothing ever restarts or cuts: every change happens on the beat or the bar.
 *
 * - Vertical layers fade in and out at bar boundaries (over most of a bar):
 *     bed (drone + pad) · arpeggio · heartbeat · clock ticks · dissonance ·
 *     wind · bells · choir · fever sparkle · boss ostinato and drums.
 * - Stress (the ward's instability, 0–3) darkens the music: a heartbeat, then a
 *   ticking clock that starts to lose its rhythm, a dissonant drone, and an
 *   arpeggio that "forgets" notes. Recovering removes them again, bar by bar.
 * - Heat (the combo multiplier tier, 0–4) brightens it: the pad opens up, bells
 *   ring on the downbeat, a choir joins, and at ×10 a fever sparkle.
 * - Moods (menu, level, boss) change tempo and ensemble at the next bar.
 * - Stingers: a swell that lands exactly on the next bar when the ward gets
 *   worse; a soft release chime when it recovers.
 */
export type Mood = 'menu' | 'calm' | 'boss';

type Chord = { root: number; tones: number[] };
const C = (root: number, ...tones: number[]): Chord => ({ root, tones });
/** Eight bars: i – VI – III – VII – iv – i – VI – V (D minor). */
const CALM: Chord[] = [C(38, 50, 53, 57), C(34, 46, 50, 53), C(41, 53, 57, 60), C(36, 48, 52, 55), C(43, 55, 58, 62), C(38, 50, 53, 57), C(34, 46, 50, 53), C(33, 45, 49, 52)];
/** The boss loop: i – VI – iv – V, twice as urgent. */
const BOSS: Chord[] = [C(38, 50, 53, 57), C(34, 46, 50, 53), C(43, 55, 58, 62), C(33, 45, 49, 52)];
/** The menu's own theme (D-054): a warm, unhurried F major loop, apart from the stage music. */
const MENU: Chord[] = [C(41, 53, 57, 60), C(45, 57, 60, 64), C(46, 58, 62, 65), C(48, 55, 60, 64), C(38, 50, 53, 57), C(46, 58, 62, 65), C(43, 55, 58, 62), C(48, 52, 55, 60)];
const TEMPO: Record<Mood, number> = { menu: 58, calm: 74, boss: 96 };

type Layer = 'bed' | 'arp' | 'heart' | 'tick' | 'dissonance' | 'wind' | 'bells' | 'choir' | 'fever' | 'ostinato' | 'drums';
const LAYERS: Layer[] = ['bed', 'arp', 'heart', 'tick', 'dissonance', 'wind', 'bells', 'choir', 'fever', 'ostinato', 'drums'];

export interface MusicState {
  mood: Mood;
  stress: number;
  heat: number;
  /** How far into the stage (and the level) we are, 0–1 (D-054): faster and busier. */
  drive?: number;
}

/** How loud each layer should be in a given state (0–1). */
export function layerTargets(s: MusicState): Record<Layer, number> {
  const st = Math.max(0, Math.min(3, s.stress));
  const ht = Math.max(0, Math.min(4, s.heat));
  const play = s.mood !== 'menu';
  const boss = s.mood === 'boss';
  const dr = play ? Math.max(0, Math.min(1, s.drive ?? 0)) : 0;
  return {
    bed: 1,
    arp: s.mood === 'menu' ? 0.6 : 1,
    heart: play && st >= 1 ? [0, 0.55, 0.8, 1][st]! : 0,
    tick: play && st >= 2 ? (st === 2 ? 0.6 : 1) : dr >= 0.45 ? 0.35 + 0.4 * dr : 0,
    dissonance: play && st >= 2 ? (st === 2 ? 0.45 : 1) : 0,
    wind: s.mood === 'menu' ? 0.35 : [0.15, 0.3, 0.55, 0.9][st]!,
    bells: ht >= 1 ? Math.min(1, 0.45 + ht * 0.18) : s.mood === 'menu' ? 0.5 : 0,
    choir: ht >= 3 ? (ht === 3 ? 0.7 : 1) : 0,
    fever: ht >= 4 ? 1 : 0,
    ostinato: boss ? 1 : dr >= 0.55 ? Math.min(1, (dr - 0.4) * 1.6) : 0,
    drums: boss ? (st >= 1 ? 1 : 0.6) : dr >= 0.75 ? 0.35 + (dr - 0.75) * 2 : 0,
  };
}

export class Music {
  private readonly layers = {} as Record<Layer, GainNode>;
  private readonly level = {} as Record<Layer, number>;
  private readonly out: GainNode;
  private state: MusicState = { mood: 'menu', stress: 0, heat: 0 };
  private applied: MusicState = { ...this.state };
  private beat = 0;
  private nextBeat = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pendingSwell = false;
  private pendingRelease = false;

  constructor(private readonly sy: Synth, dest: AudioNode) {
    const ctx = sy.ctx;
    this.out = ctx.createGain();
    this.out.connect(dest);
    for (const l of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.out);
      this.layers[l] = g;
      this.level[l] = 0;
    }
  }

  /** Begins playing at `at` (seconds). With `realtime`, a timer keeps scheduling ahead. */
  start(at: number, realtime = true): void {
    this.nextBeat = at;
    this.beat = 0;
    this.applyTargets(at, 0.05);
    if (realtime && this.timer === null) {
      this.timer = setInterval(() => this.scheduleUntil(this.sy.ctx.currentTime + 1.6), 120);
    }
  }

  set(change: Partial<MusicState>): void {
    const before = this.state;
    this.state = { ...this.state, ...change };
    if (this.state.stress > before.stress) this.pendingSwell = true;
    if (this.state.stress < before.stress) this.pendingRelease = true;
  }

  get current(): Readonly<MusicState> {
    return this.state;
  }

  /** Briefly lower the music under a big moment (the finale). */
  duck(at: number, depth: number, seconds: number): void {
    const g = this.out.gain;
    g.cancelScheduledValues(at);
    g.setTargetAtTime(1 - depth, at, 0.08);
    g.setTargetAtTime(1, at + seconds, 0.6);
  }

  private get chords(): Chord[] {
    return this.applied.mood === 'boss' ? BOSS : this.applied.mood === 'menu' ? MENU : CALM;
  }

  private get beatLen(): number {
    // Drive (D-054): up to 28% faster as the stage and the level press on.
    return 60 / (TEMPO[this.applied.mood] * (1 + 0.28 * (this.state.drive ?? 0)));
  }

  /** Schedules every beat that starts before `until`. */
  scheduleUntil(until: number): void {
    while (this.nextBeat < until) {
      const t = this.nextBeat;
      const inBar = this.beat % 4;
      if (inBar === 0) this.barStart(t);
      this.playBeat(t, inBar);
      this.nextBeat += this.beatLen;
      this.beat++;
    }
  }

  private barStart(t: number): void {
    // New state takes effect on the bar line; layers glide over most of the bar.
    const moodChanged = this.state.mood !== this.applied.mood;
    this.applied = { ...this.state };
    if (moodChanged) this.beat = 0;
    this.applyTargets(t, this.beatLen * 1.2);
    if (this.pendingRelease) {
      this.pendingRelease = false;
      this.sy.bell(this.layers.bed, t, midi(81), 0.05, 0.6, 3);
      this.sy.bell(this.layers.bed, t + this.beatLen / 2, midi(86), 0.035, 0.6, 3);
    }
  }

  private applyTargets(t: number, glide: number): void {
    const targets = layerTargets(this.applied);
    for (const l of LAYERS) {
      const g = this.layers[l].gain;
      g.setTargetAtTime(targets[l], t, glide / 3);
      this.level[l] = targets[l];
    }
  }

  private on(l: Layer): boolean {
    return this.level[l] > 0.001;
  }

  private playBeat(t: number, inBar: number): void {
    const sy = this.sy;
    const b = this.beatLen;
    const barIndex = Math.floor(this.beat / 4) % this.chords.length;
    const chord = this.chords[barIndex]!;
    const next = this.chords[(barIndex + 1) % this.chords.length]!;
    const st = this.applied.stress;
    const ht = this.applied.heat;
    const boss = this.applied.mood === 'boss';

    // ── bed: a drone and a slow pad, once per bar ──
    if (inBar === 0) {
      const len = b * 4;
      sy.tone(this.layers.bed, t, midi(chord.root - 12 + 12), len * 1.05, 0.11, { attack: 0.6, hold: len * 0.5, filter: { type: 'lowpass', freq: 320 } });
      const open = 520 + ht * 260 - st * 90;
      for (const n of chord.tones) {
        for (const det of [-7, 7]) {
          sy.tone(this.layers.bed, t, midi(n), len * 0.55, 0.026, {
            type: 'sawtooth', attack: len * 0.35, hold: len * 0.35, detune: det,
            filter: { type: 'lowpass', freq: Math.max(260, open) }, send: 0.35,
          });
        }
      }
    }

    // ── arpeggio: chord tones over two octaves; it forgets notes under stress ──
    if (this.on('arp')) {
      const per = this.applied.mood === 'menu' ? 1 : boss ? 4 : 2;
      const pool = [...chord.tones, ...chord.tones.map((n) => n + 12)];
      const forget = [0.12, 0.2, 0.32, 0.5][st]!;
      for (let k = 0; k < per; k++) {
        const step = (this.beat * per + k) % pool.length;
        const up = Math.floor((this.beat * per + k) / pool.length) % 2 === 0;
        const n = up ? pool[step]! : pool[pool.length - 1 - step]!;
        if (Math.random() < forget) continue;
        const detune = st >= 3 ? (Math.random() - 0.5) * 50 : 0;
        sy.tone(this.layers.arp, t + (k * b) / per, midi(n + 12), b * 1.6, boss ? 0.045 : 0.06, { type: 'triangle', detune, send: 0.4 });
      }
      // a passing note leading into the next chord, on the last beat
      if (inBar === 3 && Math.random() < 0.5) sy.tone(this.layers.arp, t + b / 2, midi(next.tones[0]! + 23), b, 0.04, { type: 'triangle', send: 0.4 });
    }

    // ── heartbeat: lub-dub, faster as the ward weakens ──
    if (this.on('heart') && (st >= 3 || inBar % 2 === 0)) {
      for (const [dt, v] of [[0, 0.5], [0.17, 0.32]] as const) {
        sy.tone(this.layers.heart, t + dt, 62, 0.28, v, { glideTo: 38, filter: { type: 'lowpass', freq: 180 } });
      }
    }

    // ── clock ticks: the rhythm begins to slip at the critical stage ──
    if (this.on('tick')) {
      const per = st >= 3 ? 2 : 1;
      for (let k = 0; k < per; k++) {
        const jitter = st >= 3 ? (Math.random() - 0.5) * 0.06 : 0;
        const tt = t + (k * b) / per + jitter;
        sy.noiseHit(this.layers.tick, tt, 0.03, 0.16, { type: 'highpass', freq: 3500 });
        sy.tone(this.layers.tick, tt, (this.beat + k) % 2 ? 1760 : 1320, 0.03, 0.05, { type: 'square', filter: { type: 'bandpass', freq: 1800, q: 4 } });
      }
    }

    // ── dissonance: a minor second (then a tritone) grinding under everything ──
    if (this.on('dissonance') && inBar === 0) {
      const len = b * 4;
      sy.tone(this.layers.dissonance, t, midi(chord.root + 13), len, 0.05, { type: 'sawtooth', attack: len * 0.4, hold: len * 0.3, filter: { type: 'lowpass', freq: 600 }, send: 0.5 });
      if (st >= 3) sy.tone(this.layers.dissonance, t, midi(chord.root + 18), len, 0.04, { type: 'sawtooth', attack: len * 0.5, hold: len * 0.2, filter: { type: 'lowpass', freq: 800 }, send: 0.5 });
    }

    // ── wind through the tower, louder under stress ──
    if (this.on('wind') && inBar === 0) {
      sy.noiseHit(this.layers.wind, t, b * 4.4, 0.12, { type: 'bandpass', freq: 300 + Math.random() * 300, to: 600 + Math.random() * 500, q: 2.5 }, { attack: b * 1.5, curve: 'lin', send: 0.3 });
    }

    // ── bells: the downbeat rings as the multiplier climbs ──
    if (this.on('bells') && (inBar === 0 || (ht >= 2 && inBar === 2))) {
      sy.bell(this.layers.bells, t, midi(chord.tones[inBar === 0 ? 1 : 2]! + 24), 0.06, 0.5, 2.6);
    }

    // ── choir: sustained "aah" on the chord at ×5 and above ──
    if (this.on('choir') && inBar === 0) {
      for (const n of chord.tones) sy.choir(this.layers.choir, t, midi(n + 12), b * 4.1, 0.03, 0.5);
    }

    // ── fever: a glittering high arpeggio at ×10 ──
    if (this.on('fever')) {
      for (let k = 0; k < 4; k++) {
        const n = chord.tones[(this.beat * 4 + k) % chord.tones.length]! + 36;
        sy.tone(this.layers.fever, t + (k * b) / 4, midi(n), 0.25, 0.025, { type: 'sine', send: 0.5 });
      }
    }

    // ── boss: a driving low ostinato and war drums ──
    if (this.on('ostinato')) {
      for (let k = 0; k < 2; k++) {
        const n = chord.root + (k === 1 && inBar % 2 === 1 ? 12 : 0) + 12;
        sy.tone(this.layers.ostinato, t + (k * b) / 2, midi(n), b * 0.45, 0.09, { type: 'sawtooth', filter: { type: 'lowpass', freq: 500, to: 260 }, drive: 1.6 });
      }
    }
    if (this.on('drums')) {
      sy.tone(this.layers.drums, t, inBar === 0 ? 70 : 92, 0.4, inBar === 0 ? 0.5 : 0.28, { glideTo: 42, filter: { type: 'lowpass', freq: 240 }, send: 0.3 });
      if (inBar === 3) sy.tone(this.layers.drums, t + b / 2, 110, 0.25, 0.22, { glideTo: 60, send: 0.3 });
    }

    // ── stinger: a reverse swell that lands exactly on the next bar line ──
    if (this.pendingSwell && inBar === 3) {
      this.pendingSwell = false;
      sy.noiseHit(this.layers.bed, t, b * 0.98, 0.18, { type: 'bandpass', freq: 200, to: 2400, q: 1.2 }, { attack: b * 0.95, curve: 'lin', send: 0.4 });
      sy.tone(this.layers.bed, t + b, midi(chord.root - 12 + 12), 1.4, 0.3, { glideTo: midi(chord.root - 24 + 12), filter: { type: 'lowpass', freq: 300 } });
    }
  }
}
