import type { Bonus, BonusId } from '../gameplay/ScoringSystem';

/**
 * The announcer (D-051): calls out per-word bonuses in a deep, showy,
 * slightly sarcastic arena-announcer voice (tone inspired by Halo /
 * Knightsquad, no lines copied). Uses the browser's built-in speech voice,
 * pitched down and drawn out. One call at a time; a new bonus never cuts in
 * mid-call, and calls are spaced out so it never chatters.
 */
const CALLS: Partial<Record<BonusId, string>> = {
  perfect: 'Perfect!',
  quick: 'Quick!',
  clutch: 'Clutch...!',
  arcane: 'Arcane!',
  long: 'Long word!',
  name: 'Name-caller!',
  volley: 'Volley!',
  alliteration: 'Alliteration!',
  librarian: 'Librarian!',
  metronome: 'Metronome...',
  sweep: 'Clean... Sweep!',
};

/** Rarest and most exciting first: only the best bonus on a word is called. */
const PRIORITY: BonusId[] = ['sweep', 'clutch', 'librarian', 'alliteration', 'arcane', 'metronome', 'name', 'long', 'volley', 'quick', 'perfect'];
/** Common bonuses are only called now and then, so rarer ones stay special. */
const CHANCE: Partial<Record<BonusId, number>> = { perfect: 0.12, quick: 0.3, volley: 0.5 };
const GAP_MS = 1400;

class Announcer {
  enabled = true;
  private voice: SpeechSynthesisVoice | null = null;
  private lastAt = 0;

  private pickVoice(): SpeechSynthesisVoice | null {
    if (this.voice) return this.voice;
    const all = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
    const en = all.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const male = /male|daniel|david|george|arthur|fred|alex|guy|james|ryan|google uk english male/i;
    this.voice = en.find((v) => male.test(v.name) && !/female/i.test(v.name)) ?? en[0] ?? null;
    return this.voice;
  }

  /** Called with the bonuses earned on a captured word. */
  bonuses(bonuses: readonly Bonus[]): void {
    if (!this.enabled || typeof speechSynthesis === 'undefined' || bonuses.length === 0) return;
    const now = performance.now();
    if (now - this.lastAt < GAP_MS || speechSynthesis.speaking) return;
    const ids = new Set(bonuses.map((b) => b.id));
    const id = PRIORITY.find((p) => ids.has(p));
    if (!id || Math.random() > (CHANCE[id] ?? 1)) return;
    const chain = bonuses.find((b) => b.id === id)?.count ?? 1;
    let line = CALLS[id]!;
    if (chain >= 4 && (id === 'volley' || id === 'alliteration' || id === 'librarian')) line = `${line.replace('!', '')}... ×${chain}!`;
    this.say(line);
    this.lastAt = now;
  }

  private say(text: string): void {
    const u = new SpeechSynthesisUtterance(text);
    const v = this.pickVoice();
    if (v) u.voice = v;
    u.pitch = 0.35; // deep
    u.rate = 0.82; // drawn out, theatrical
    u.volume = 0.9;
    speechSynthesis.speak(u);
  }
}

export const announcer = new Announcer();
