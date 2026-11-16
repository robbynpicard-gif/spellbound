import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { InstabilityStage } from '../gameplay/InstabilityManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import { SPELL_IDS, SPELL_POOL_SIZE, totalCharges, type SpellCharges, type SpellId } from '../gameplay/SpellManager';
import { ART, ART_SCALE, hex, LAYOUT, SPELL_COLORS } from '../render/layout';
import { TypingConsole } from './TypingConsole';

const INSTABILITY_COLORS: Record<InstabilityStage, number> = {
  0: PALETTE.arcane,
  1: PALETTE.gold,
  2: PALETTE.fire,
  3: PALETTE.crimson,
  4: PALETTE.crimson,
};

/** HUD readouts: dim amber terminal text. */
const readout = (color: number = PALETTE.gold, size = 18): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONTS.heading,
  fontSize: `${size}px`,
  fontStyle: '600',
  color: hex(color),
});

const PX = ART_SCALE;
const GRIME = 0x0e0c0a;
const ROW1 = 18;
const ROW2 = 46;
const SLOT_W = 60;
const SLOT_H = 56;
const SLOT_GAP = 4;
const ICON_SCALE = 3;

/**
 * A segmented gauge set into the iron plate, like an old dial readout.
 * The caption sits to its right.
 */
class Gauge {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private shown = 0;
  private readonly tweenTarget = { value: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly width: number,
    private readonly caption: (value: number) => string,
    private color: number,
  ) {
    this.bar = scene.add.graphics().setDepth(30);
    this.text = scene.add
      .text(x + width + 10, y + PX, '', readout(PALETTE.parchment, 16))
      .setOrigin(0, 0.5)
      .setDepth(31);
    this.draw(0);
  }

  /** value is 0–100. */
  set(value: number, color = this.color): void {
    this.color = color;
    this.scene.tweens.killTweensOf(this.tweenTarget);
    this.tweenTarget.value = this.shown;
    this.scene.tweens.add({
      targets: this.tweenTarget,
      value,
      duration: 350,
      ease: 'Cubic.Out',
      onUpdate: () => this.draw(this.tweenTarget.value),
    });
  }

  /** Redraw the caption without changing the bar. */
  refresh(): void {
    this.draw(this.shown);
  }

  setCaptionColor(color: number): void {
    this.text.setColor(hex(color));
  }

  private draw(value: number): void {
    this.shown = value;
    const g = this.bar;
    const { x, y, width } = this;
    g.clear();
    g.fillStyle(GRIME, 1);
    g.fillRect(x - PX, y - PX, width + 2 * PX, 4 * PX);
    g.fillStyle(PALETTE.midnight, 1);
    g.fillRect(x, y, width, 2 * PX);
    // Lit segments, one art pixel wide with a dark gap every fourth.
    const lit = Math.round((width / PX) * Math.min(100, Math.max(0, value)) / 100);
    g.fillStyle(this.color, 1);
    for (let i = 0; i < lit; i++) if (i % 4 !== 3) g.fillRect(x + i * PX, y, PX, 2 * PX);
    g.fillStyle(PALETTE.iron, 1);
    g.fillRect(x - PX, y + 2 * PX, width + 2 * PX, PX);
    this.text.setText(this.caption(value));
  }
}

/** One spell slot: the spell's pixel icon, its cast word, and how many charges are held. */
class SpellSlot {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly word: Phaser.GameObjects.Text;
  private readonly count: Phaser.GameObjects.Text;
  private readonly container: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly spell: SpellId,
    x: number,
    y: number,
  ) {
    this.frame = scene.add.graphics();
    this.icon = scene.add
      .image(0, -8, ART.icons, SPELL_IDS.indexOf(spell))
      .setScale(ICON_SCALE)
      .setOrigin(0.5);
    this.word = scene.add
      .text(0, SLOT_H / 2 - 9, spell, readout(SPELL_COLORS[spell], 12))
      .setOrigin(0.5);
    this.count = scene.add
      .text(SLOT_W / 2 - 4, -SLOT_H / 2 + 2, '', readout(PALETTE.parchment, 15))
      .setOrigin(1, 0);
    this.container = scene.add
      .container(x + SLOT_W / 2, y + SLOT_H / 2, [this.frame, this.icon, this.word, this.count])
      .setDepth(31);
    this.set(0);
  }

  set(charges: number): void {
    const active = charges > 0;
    const g = this.frame;
    g.clear();
    g.fillStyle(GRIME, 1);
    g.fillRect(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H);
    g.fillStyle(PALETTE.midnight, 1);
    g.fillRect(-SLOT_W / 2 + PX, -SLOT_H / 2 + PX, SLOT_W - 2 * PX, SLOT_H - 2 * PX);
    g.fillStyle(active ? SPELL_COLORS[this.spell] : PALETTE.iron, active ? 0.9 : 1);
    g.fillRect(-SLOT_W / 2, SLOT_H / 2 - PX, SLOT_W, PX);
    this.icon.setAlpha(active ? 1 : 0.35);
    this.word.setAlpha(active ? 1 : 0.45);
    this.count.setText(active ? `×${charges}` : '');
  }

  /** Bright pulse when cast or collected. */
  pulse(): void {
    this.scene.tweens.add({ targets: this.container, scale: { from: 1.15, to: 1 }, duration: 260, ease: 'Back.Out' });
  }

  /** Red shake when the player tries to cast with no charges. */
  deny(): void {
    const x = this.container.x;
    this.scene.tweens.add({
      targets: this.container,
      x: { from: x - 5, to: x + 5 },
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.container.setX(x),
    });
    this.frame.fillStyle(PALETTE.crimson, 1);
    this.frame.fillRect(-SLOT_W / 2, SLOT_H / 2 - PX, SLOT_W, PX);
  }
}

/**
 * Heads-up display, set into the pixel-art backdrop (decisions.md D-028).
 * Iron plate (top): level + progress gauge · score, combo, ward gauge, spell
 * pool · spell slots (type the word shown to cast). The typing console is the
 * paper in the alchemic typewriter; accuracy and WPM are on the desk plaque.
 */
export class GameHUD {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly accuracyText: Phaser.GameObjects.Text;
  private readonly shieldText: Phaser.GameObjects.Text;
  private readonly poolText: Phaser.GameObjects.Text;
  private readonly progress: Gauge;
  private readonly instability: Gauge;
  private readonly slots: Partial<Record<SpellId, SpellSlot>> = {};
  private readonly levelText: Phaser.GameObjects.Text;
  readonly console: TypingConsole;
  private lastCharges: SpellCharges | null = null;
  /** Words completed (shown in place of the progress bar in endless Practice). */
  private completed = 0;
  /** Boss level: total survival time, shown on the progress gauge. */
  private survivalMs: number | null = null;
  private survivalLeftMs = 0;
  /** Wizard Duel: the rival's live score/instability replaces the progress gauge. */
  private rival: { name: string; score: number; instability: number; alive: boolean } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    levelName: string,
    private readonly quota: number | null,
    /** Run score from earlier levels, added to this level's score. */
    private readonly scoreOffset = 0,
    rivalName?: string,
    /** Spells to show slots for (those this run has unlocked), in power order. */
    knownSpells: readonly SpellId[] = SPELL_IDS,
  ) {
    if (rivalName) this.rival = { name: rivalName, score: 0, instability: 0, alive: true };

    // Left: level and progress.
    this.levelText = scene.add.text(16, ROW1, levelName, readout(PALETTE.gold, 22)).setOrigin(0, 0.5).setDepth(31);
    this.progress = new Gauge(
      scene,
      20,
      ROW2 - PX,
      240,
      (v) => {
        const r = this.rival;
        if (r) {
          const name = r.name.toUpperCase().slice(0, 8);
          return r.alive ? `${name} ${r.score.toLocaleString()} ${Math.round(r.instability)}%` : `${name} FELL`;
        }
        if (this.survivalMs !== null) {
          const s = Math.ceil(this.survivalLeftMs / 1000);
          return `SURVIVE ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        }
        return this.quota === null
          ? `${this.completed} WORDS`
          : `${Math.round((v / 100) * this.quota)}/${this.quota}`;
      },
      rivalName ? PALETTE.crimson : PALETTE.gold,
    );

    // Middle: score, combo, ward gauge, spell pool.
    const mx = 470;
    this.scoreText = scene.add.text(mx, ROW1, '', readout(PALETTE.parchment, 15)).setOrigin(0, 0.5).setDepth(31);
    this.comboText = scene.add.text(mx + 150, ROW1, '', readout(PALETTE.parchment, 15)).setOrigin(0, 0.5).setDepth(31);
    this.instability = new Gauge(scene, mx + 4, ROW2 - PX, 100, (v) => `WARD ${Math.round(v)}%`, INSTABILITY_COLORS[0]);

    // Right: spell slots. Only spells this run has unlocked get a slot; all share one pool.
    const shown = SPELL_IDS.filter((id) => knownSpells.includes(id));
    const slotsWidth = shown.length * SLOT_W + Math.max(0, shown.length - 1) * SLOT_GAP;
    const slotX = LAYOUT.width - 8 - slotsWidth;
    shown.forEach((id, i) => {
      this.slots[id] = new SpellSlot(scene, id, slotX + i * (SLOT_W + SLOT_GAP), (LAYOUT.hudHeight - SLOT_H) / 2);
    });
    this.poolText = scene.add
      .text(Math.min(slotX - 10, 756), ROW2, '', readout(PALETTE.parchment, 16))
      .setOrigin(1, 0.5)
      .setAlpha(shown.length > 0 ? 0.9 : 0)
      .setDepth(31);

    // The typewriter's paper is the typing console.
    const paper = LAYOUT.paper;
    this.console = new TypingConsole(scene, paper.x + paper.width / 2, paper.y + paper.height / 2, paper.width);

    // Desk plaque: accuracy and WPM, and Arcane Shield blocks under it.
    this.accuracyText = scene.add
      .text(LAYOUT.plaque.x, LAYOUT.plaque.y, '', readout(PALETTE.parchment, 16))
      .setOrigin(0.5)
      .setAlpha(0.85)
      .setDepth(31);
    this.shieldText = scene.add
      .text(LAYOUT.plaque.x, LAYOUT.plaque.y + 24, '', readout(PALETTE.shield, 16))
      .setOrigin(0.5)
      .setDepth(31);

    this.updateStats(null);
  }

  updateStats(stats: GameStats | null, combo = 0): void {
    const s = stats;
    this.scoreText.setText(`SCORE ${(this.scoreOffset + (s?.score ?? 0)).toLocaleString()}`);
    this.comboText.setText(`COMBO ×${combo}`).setColor(hex(combo >= 5 ? PALETTE.gold : PALETTE.parchment));
    const acc = s ? Math.round(s.accuracy * 100) : 100;
    const wpm = s ? Math.round(s.wpm) : 0;
    this.accuracyText.setText(`${acc}% · ${wpm} WPM`);
  }

  pulseCombo(): void {
    this.scene.tweens.add({ targets: this.comboText, scale: { from: 1.25, to: 1 }, duration: 200 });
  }

  /** Replace the top-left title (e.g. the duel timer). */
  setTitle(text: string): void {
    if (this.levelText.text !== text) this.levelText.setText(text);
  }

  /** Wizard Duel: show the rival's live state on the progress gauge. */
  setRival(score: number, instability: number, alive: boolean): void {
    if (!this.rival) return;
    Object.assign(this.rival, { score, instability, alive });
    this.progress.set(alive ? instability : 100);
  }

  setProgress(completed: number): void {
    this.completed = completed;
    if (this.rival || this.survivalMs !== null) return;
    if (this.quota === null) return this.progress.refresh();
    this.progress.set(Math.min(100, (completed / this.quota) * 100));
  }

  /** Boss level: show the survival timer on the progress gauge (fills as time passes). */
  setSurvival(totalMs: number, leftMs: number): void {
    const first = this.survivalMs === null;
    const shownSecond = Math.ceil(this.survivalLeftMs / 1000);
    this.survivalMs = totalMs;
    this.survivalLeftMs = leftMs;
    if (first || Math.ceil(leftMs / 1000) !== shownSecond) {
      this.progress.set(Math.min(100, ((totalMs - leftMs) / totalMs) * 100));
    }
  }

  /** Arcane Shield blocks left (0 hides the label). */
  setShield(remaining: number): void {
    this.shieldText.setText(remaining > 0 ? `SHIELD ×${remaining}` : '');
  }

  setInstability(value: number, stage: InstabilityStage): void {
    this.instability.set(value, INSTABILITY_COLORS[stage]);
    this.instability.setCaptionColor(stage >= 3 ? PALETTE.crimson : PALETTE.parchment);
  }

  setSpells(charges: SpellCharges, pulse?: SpellId): void {
    for (const id of SPELL_IDS) {
      if (!this.lastCharges || this.lastCharges[id] !== charges[id]) this.slots[id]?.set(charges[id]);
    }
    this.lastCharges = { ...charges };
    const total = totalCharges(charges);
    this.poolText
      .setText(`POOL ${total}/${SPELL_POOL_SIZE}`)
      .setColor(hex(total >= SPELL_POOL_SIZE ? PALETTE.gold : PALETTE.parchment));
    if (pulse) this.slots[pulse]?.pulse();
  }

  denySpell(spell: SpellId): void {
    const slot = this.slots[spell];
    if (!slot) return;
    slot.deny();
    this.scene.time.delayedCall(260, () => slot.set(this.lastCharges?.[spell] ?? 0));
  }
}
