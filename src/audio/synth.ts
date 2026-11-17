/**
 * Small synthesis toolkit shared by the music and the sound effects (D-041).
 * Everything is built from oscillators, filtered noise and envelopes, so the
 * game ships no audio files. Every voice schedules itself at an exact time.
 */

export const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export class Synth {
  readonly noise: AudioBuffer;
  readonly reverb: ConvolverNode;
  private readonly curves = new Map<number, Float32Array<ArrayBuffer>>();

  constructor(readonly ctx: BaseAudioContext, reverbOut: AudioNode) {
    // One second of white noise, looped by every noise voice.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    // A long, dark stone-room reverb.
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 3.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    this.reverb.connect(reverbOut);
  }

  /** A soft-clipping curve (for buzz, grit and growl). */
  curve(amount: number): Float32Array<ArrayBuffer> {
    const cached = this.curves.get(amount);
    if (cached) return cached;
    const c = new Float32Array(1024);
    for (let i = 0; i < c.length; i++) {
      const x = (i / (c.length - 1)) * 2 - 1;
      c[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    this.curves.set(amount, c);
    return c;
  }

  /** A pitched voice: attack, then exponential decay. Optional glide, filter, drive and reverb send. */
  tone(
    out: AudioNode,
    t: number,
    freq: number,
    dur: number,
    vol: number,
    opts: {
      type?: OscillatorType;
      glideTo?: number;
      attack?: number;
      detune?: number;
      filter?: { type: BiquadFilterType; freq: number; q?: number; to?: number };
      drive?: number;
      send?: number;
      hold?: number;
    } = {},
  ): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.glideTo), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    const a = opts.attack ?? 0.006;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (opts.hold) g.gain.setValueAtTime(vol, t + a + opts.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + (opts.hold ?? 0) + dur);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter.type;
      f.frequency.setValueAtTime(opts.filter.freq, t);
      if (opts.filter.to) f.frequency.exponentialRampToValueAtTime(opts.filter.to, t + dur);
      f.Q.value = opts.filter.q ?? 0.8;
      node.connect(f);
      node = f;
    }
    if (opts.drive) {
      const w = ctx.createWaveShaper();
      w.curve = this.curve(opts.drive);
      node.connect(w);
      node = w;
    }
    node.connect(g);
    g.connect(out);
    if (opts.send) {
      const s = ctx.createGain();
      s.gain.value = opts.send;
      g.connect(s).connect(this.reverb);
    }
    o.start(t);
    o.stop(t + a + (opts.hold ?? 0) + dur + 0.05);
  }

  /** Filtered noise with an envelope and a moving filter. */
  noiseHit(
    out: AudioNode,
    t: number,
    dur: number,
    vol: number,
    filter: { type: BiquadFilterType; freq: number; to?: number; q?: number },
    opts: { attack?: number; send?: number; curve?: 'exp' | 'lin' } = {},
  ): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.Q.value = filter.q ?? 1;
    f.frequency.setValueAtTime(filter.freq, t);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + dur);
    const g = ctx.createGain();
    const a = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (opts.curve === 'lin') g.gain.linearRampToValueAtTime(0, t + a + dur);
    else g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    src.connect(f).connect(g);
    g.connect(out);
    if (opts.send) {
      const s = ctx.createGain();
      s.gain.value = opts.send;
      g.connect(s).connect(this.reverb);
    }
    src.start(t, Math.random() * 0.5);
    src.stop(t + a + dur + 0.05);
  }

  /** A struck metal bell: inharmonic partials. */
  bell(out: AudioNode, t: number, freq: number, vol: number, send = 0.4, length = 2.4): void {
    for (const [mult, v] of [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]] as const) {
      this.tone(out, t, freq * mult, length / Math.sqrt(mult), vol * v, { attack: 0.002, send });
    }
  }

  /** A short brass strike (a typebar on the platen): inharmonic partials, quick decay, a little body. */
  brass(out: AudioNode, t: number, freq: number, dur: number, vol: number): void {
    for (const [mult, v, d] of [[1, 1, 1], [1.52, 0.6, 0.8], [2.37, 0.38, 0.6], [3.14, 0.18, 0.45]] as const) {
      this.tone(out, t, freq * mult, dur * d, vol * v * 0.45, { attack: 0.002, filter: { type: 'lowpass', freq: 3200 }, send: 0.06 });
    }
    this.tone(out, t, freq * 0.75, dur * 0.6, vol * 0.12, { type: 'triangle', attack: 0.003, filter: { type: 'lowpass', freq: 1200 } });
  }

  /** Sung "aah": detuned saws through two vowel formants. */
  choir(out: AudioNode, t: number, freq: number, dur: number, vol: number, send = 0.5): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.25, dur / 3));
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(out);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.reverb);
    }
    for (const det of [-11, 0, 12]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 4.6 + Math.random();
      lg.gain.value = 6;
      lfo.connect(lg).connect(o.detune);
      for (const [f, q] of [[760, 7], [1180, 9]] as const) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = q;
        o.connect(bp).connect(g);
      }
      o.start(t);
      lfo.start(t);
      o.stop(t + dur + 0.1);
      lfo.stop(t + dur + 0.1);
    }
  }
}
