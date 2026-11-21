/**
 * The Grand Wizard's voice (D-090 prototype).
 *
 * D-052 rejected robotic browser text-to-speech, so this placeholder is a
 * synthesized "babble" (in the tradition of Banjo-Kazooie / Animal Crossing):
 * a gravelly old voice muttering vowel-formant syllables that follow the
 * rhythm and punctuation of the line, while the real words appear as text.
 * When the owner records lines, list their IDs in src/data/voice-manifest.json
 * and put the files in public/assets/voice/<id>.mp3; recorded lines then play
 * instead of the babble.
 *
 * Queue rules (prototype): Rune-only during play; one line at a time; 2.5 s
 * cooldown after each line; a waiting line is replaced by a more important
 * one; lines no more important than the one speaking are dropped (the Rune
 * tray still shows every award).
 */
import manifest from '../data/voice-manifest.json';
import { sound } from './audio';
import type { VoiceLine } from './voiceLines';

const RECORDED = new Set<string>(manifest as string[]);
const COOLDOWN = 2.5;

// vowel formants (F1, F2) for a deep, older voice
const VOWELS: [number, number][] = [[730, 1090], [530, 1840], [300, 2200], [570, 840], [440, 1020], [660, 1700]];

interface Pending {
  lines: VoiceLine[];
  priority: number;
  energy: number;
}

class GrandWizardVoice {
  private busyUntil = 0;
  private currentPriority = 0;
  private pending: Pending | null = null;
  private timer: number | null = null;
  private cache = new Map<string, AudioBuffer>();

  /** Ask him to say something. `priority`: 1 minor … 4 rare. `energy` scales pitch and loudness (family escalation). */
  say(line: VoiceLine | VoiceLine[], priority: number, energy = 1): void {
    const ctx = sound.ctx;
    if (!ctx || !sound.settings.voice.on) return;
    const lines = Array.isArray(line) ? line : [line];
    const now = ctx.currentTime;
    if (now >= this.busyUntil) return this.speak({ lines, priority, energy });
    if (priority <= this.currentPriority && priority < 4) return;
    if (!this.pending || priority > this.pending.priority) this.pending = { lines, priority, energy };
    this.schedule();
  }

  private schedule(): void {
    if (this.timer !== null || !sound.ctx) return;
    const wait = Math.max(0, this.busyUntil - sound.ctx.currentTime) * 1000 + 30;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      const p = this.pending;
      this.pending = null;
      if (p) this.speak(p);
    }, wait);
  }

  private speak(p: Pending): void {
    const ctx = sound.ctx!;
    this.currentPriority = p.priority;
    // a callout and its remark play back to back as one utterance
    let at = 0;
    for (const line of p.lines) at += (RECORDED.has(line.id) ? this.playRecording(line.id, at) : this.babble(line.text, p.energy, at)) + 0.25;
    this.busyUntil = ctx.currentTime + at + COOLDOWN;
  }

  private playRecording(id: string, delay: number): number {
    const ctx = sound.ctx!;
    const when = ctx.currentTime + delay;
    const play = (buf: AudioBuffer) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(sound.bus('voice'));
      src.start(Math.max(ctx.currentTime, when));
    };
    const hit = this.cache.get(id);
    if (hit) {
      play(hit);
      return hit.duration;
    }
    fetch(`assets/voice/${id}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .then((buf) => (this.cache.set(id, buf), play(buf)))
      .catch(() => undefined);
    return 1.5;
  }

  /** Returns the length in seconds. */
  private babble(text: string, energy: number, delay = 0): number {
    const ctx = sound.ctx!;
    const out = sound.bus('voice');
    let t = ctx.currentTime + 0.03 + delay;
    const start = t;
    const base = 92 * (0.95 + energy * 0.12) * (0.97 + Math.random() * 0.06);
    const words = text.split(/\s+/).filter(Boolean).slice(0, 9);
    words.forEach((word, wi) => {
      const letters = word.replace(/[^a-z]/gi, '');
      const syl = Math.max(1, Math.min(4, Math.round(letters.length / 2.6)));
      const shout = /!$/.test(word);
      const ask = /\?$/.test(word);
      const last = wi === words.length - 1;
      for (let s = 0; s < syl; s++) {
        const code = letters.charCodeAt(s * 2 % Math.max(1, letters.length)) || 97;
        const [f1, f2] = VOWELS[code % VOWELS.length]!;
        const d = (shout ? 0.13 : 0.09) + Math.random() * 0.04;
        // pitch contour: a gentle fall through a statement, a rise for questions, a bark for exclamations
        let f0 = base * (1.06 - 0.12 * ((wi + s / syl) / Math.max(1, words.length)));
        if (ask && last) f0 *= 1 + 0.25 * ((s + 1) / syl);
        if (shout) f0 *= 1.35 + (s === 0 ? 0.15 : 0);
        this.syllable(t, d, f0, f1, f2, (shout ? 0.42 : 0.26) * Math.min(1.4, 0.8 + energy * 0.25), out);
        t += d + 0.018;
      }
      t += /[.,;:…]$/.test(word) ? 0.2 : 0.07;
    });
    return t - start;
  }

  private syllable(t: number, d: number, f0: number, f1: number, f2: number, peak: number, out: AudioNode): void {
    const ctx = sound.ctx!;
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0, t);
    src.frequency.linearRampToValueAtTime(f0 * (0.94 + Math.random() * 0.1), t + d);
    // a little old-man wobble
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.value = f0 * 0.025;
    vib.connect(vg).connect(src.frequency);
    const mix = ctx.createGain();
    mix.gain.setValueAtTime(0.0001, t);
    mix.gain.exponentialRampToValueAtTime(peak, t + 0.018);
    mix.gain.setValueAtTime(peak, t + d * 0.6);
    mix.gain.exponentialRampToValueAtTime(0.0001, t + d);
    for (const [f, q, g] of [[f1, 5, 1], [f2, 9, 0.55], [2600, 4, 0.12]] as const) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const fg = ctx.createGain();
      fg.gain.value = g * 3;
      src.connect(bp).connect(fg).connect(mix);
    }
    mix.connect(out);
    src.start(t);
    vib.start(t);
    src.stop(t + d + 0.05);
    vib.stop(t + d + 0.05);
    // a breathy consonant at the start of the syllable
    sound.noiseHit(t, 0.025, 'highpass', 2500 + Math.random() * 2500, 0.8, peak * 0.25, out);
  }
}

export const voice = new GrandWizardVoice();
