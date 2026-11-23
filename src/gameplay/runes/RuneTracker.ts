/**
 * Observes the engine's own events and awards Runes (prototype, D-085).
 * Runs inside the deterministic simulation, so replays award the same Runes.
 * Spell Runes use per-cast opportunity windows ("rune sequences").
 */
import type { EventBus } from '../../core/EventBus';
import type { GameEvents } from '../../core/GameEvents';
import { classifyWord } from '../WordClasses';
import type { SpellId } from '../SpellManager';
import { RUNE_BY_ID, type RuneDef } from './RuneCatalogue';

export interface RuneContext {
  tick(): number;
  fieldHeight: number;
  volley(): number;
  allIn(): number;
  wordsOnField(): number;
  combo(): number;
}

interface SpellWindow {
  spell: SpellId;
  start: number;
  /** Fixed end tick, or null while it waits for an end event. */
  end: number | null;
  perfect: number;
  points: number;
  done: Set<string>;
  /** Fire: ids of words alive just after the cast. */
  survivors?: Set<number>;
  survivorCaptures?: number;
}

const TICKS = (s: number) => Math.round(s * 60);
const TIMED: Partial<Record<SpellId, number>> = { slow: TICKS(8), alter: TICKS(8), fire: TICKS(4), wind: TICKS(5), barrier: TICKS(7) };

export class RuneTracker {
  private perfectRun = 0;
  /** Flawless: no typo, no wrong Enter, no scroll reaching the Ward this level. */
  private clean = true;
  private nouns = 0;
  private letterRun: string[] = [];
  private alphaRun: string[] = [];
  private recentCaptures: number[] = [];
  private windows: SpellWindow[] = [];
  /** Wind: ids of scrolls the last gust pushed back. */
  private gusted = new Set<number>();
  private gustCaptures = 0;
  private barrierBlocks = 0;

  constructor(
    events: EventBus<GameEvents>,
    private readonly ctx: RuneContext,
    private readonly award: (rune: RuneDef) => void,
    private readonly fieldWords: () => readonly { id: number }[],
  ) {
    events.on('wordCompleted', (e) => {
      this.onCapture(e.word.id, e.word.text, e.word.y, e.perfect === true, e.points, e.word.originalLength !== undefined);
      if (e.word.plunge) this.give(e.word.plunge === 3 ? 'daring-rescue' : 'saving-grace');
    });
    events.on('typingError', () => this.onSlip());
    events.on('submitMissed', () => this.onSlip());
    events.on('wordMissed', () => this.onSlip());
    events.on('wordBlocked', () => {
      this.clean = false;
      if (++this.barrierBlocks === 2) this.give('unbroken');
    });
    events.on('barrierChanged', ({ remaining }) => {
      if (remaining === 0) this.barrierBlocks = 0;
    });
    events.on('spellCast', ({ spell }) => this.open(spell));
    events.on('spellEnded', ({ spell }) => this.close(spell));
    events.on('wordsShocked', ({ words }) => {
      if (words.length >= 8) this.give('chain-8');
      else if (words.length >= 5) this.give('chain-5');
      this.addWindowPoints(0);
    });
    events.on('wordsBurned', (e) => {
      const deepest = Math.max(0, ...(e.depths ?? [0]));
      if (deepest >= 2) this.give('pyre');
      const w = this.latest('fire');
      if (w) w.survivors = new Set(this.fieldWords().map((x) => x.id));
    });
    events.on('wordsHarvested', ({ volley }) => {
      if ((volley ?? 1) >= 3) this.give('reap');
    });
    events.on('windCast', ({ moved }) => {
      if (moved.length >= 6) this.give('thrice-scarred');
      this.gusted = new Set(moved.map((m) => m.id));
      this.gustCaptures = 0;
    });
  }

  private give(id: string): void {
    const def = RUNE_BY_ID.get(id);
    if (def) this.award(def);
  }

  private latest(spell: SpellId): SpellWindow | undefined {
    for (let i = this.windows.length - 1; i >= 0; i--) if (this.windows[i]!.spell === spell) return this.windows[i];
    return undefined;
  }

  private open(spell: SpellId): void {
    const now = this.ctx.tick();
    const span = TIMED[spell];
    this.windows.push({ spell, start: now, end: span !== undefined ? now + span : null, perfect: 0, points: 0, done: new Set() });
    if (this.windows.length > 24) this.windows.shift();
  }

  /** Untimed windows (Ice) close when their effect ends. */
  private close(spell: SpellId): void {
    for (const w of this.windows) if (w.spell === spell && w.end === null) w.end = this.ctx.tick();
  }

  private active(): SpellWindow[] {
    const now = this.ctx.tick();
    this.windows = this.windows.filter((w) => w.end === null || w.end >= now - 1);
    return this.windows.filter((w) => w.end === null || now <= w.end);
  }

  private addWindowPoints(points: number): void {
    for (const w of this.active()) w.points += points;
  }


  private onSlip(): void {
    this.clean = false;
    // Participation Runes: zero points, tiered by the streak just ruined.
    if (this.perfectRun >= 50) this.give('fumble-50');
    else if (this.perfectRun >= 25) this.give('fumble-25');
    else if (this.perfectRun >= 10) this.give('fumble-10');
    this.perfectRun = 0;
  }

  private onCapture(id: number, text: string, y: number, perfect: boolean, points: number, altered: boolean): void {
    const lower = text.toLowerCase();
    const share = y / this.ctx.fieldHeight;
    const now = this.ctx.tick();
    if (this.gusted.has(id) && this.active().some((w) => w.spell === 'wind')) {
      this.gusted.delete(id);
      if (++this.gustCaptures === 3) this.give('final-wager');
    }

    // Typing mastery
    if (perfect) {
      this.perfectRun++;
      if (this.perfectRun === 10) this.give('quill-10');
      if (this.perfectRun === 25) this.give('quill-25');
      if (this.perfectRun === 50) this.give('quill-50');
      if (share >= 0.95) this.give('by-a-thread');
      if (text.length >= 10) this.give('tome-reader');
    }
    if (share <= 0.1) this.give('first-light');
    this.recentCaptures = [...this.recentCaptures.filter((t) => now - t <= TICKS(5)), now];
    if (this.recentCaptures.length >= 5 && this.ctx.wordsOnField() === 0) {
      this.give('clean-desk');
      this.recentCaptures = [];
    }

    // Wordplay (from real captures)
    this.nouns = classifyWord(lower) === 'noun' ? this.nouns + 1 : 0;
    if (this.nouns === 2) this.give('noun-2');
    if (this.nouns === 3) this.give('noun-3');
    if (this.nouns === 5) this.give('noun-5');
    this.letterRun = this.letterRun.length && this.letterRun[0]![0] === lower[0] ? [...this.letterRun, lower] : [lower];
    if (this.letterRun.length === 3) this.give('alliterator');
    const prev = this.alphaRun.at(-1);
    this.alphaRun = prev !== undefined && prev < lower ? [...this.alphaRun, lower] : [lower];
    if (this.alphaRun.length === 4) this.give('alphabetist');

    // Spell rune sequences
    for (const w of this.active()) {
      w.points += points;
      if (perfect) w.perfect++;
      if (w.spell === 'ice' && perfect) {
        for (const [n, id] of [[3, 'frost-3'], [5, 'frost-5'], [8, 'frost-8']] as const)
          if (w.perfect === n && !w.done.has(id)) (w.done.add(id), this.give(id));
      }
      if (w.spell === 'slow' && this.ctx.volley() >= 2 && !w.done.has('borrowed-time')) {
        w.done.add('borrowed-time');
        this.give('borrowed-time');
      }
      if (w.spell === 'fire' && w.survivors?.has(id)) {
        w.survivorCaptures = (w.survivorCaptures ?? 0) + 1;
        if (w.survivorCaptures === 3 && !w.done.has('phoenix-ash')) (w.done.add('phoenix-ash'), this.give('phoenix-ash'));
      }
      if (w.spell === 'alter' && perfect && altered) {
        w.survivorCaptures = (w.survivorCaptures ?? 0) + 1;
        if (w.survivorCaptures === 4 && !w.done.has('adaptation')) (w.done.add('adaptation'), this.give('adaptation'));
      }
    }
  }

  /** Called by the engine when a level is won, before its stats are taken. */
  levelWon(): void {
    if (this.clean) this.give('flawless');
  }

  /** D-102: an internal checkpoint of a continuous run counts as a level for Flawless, then starts a fresh one. */
  checkpointReached(): void {
    this.levelWon();
    this.clean = true;
  }
}
