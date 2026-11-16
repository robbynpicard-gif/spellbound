import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { InstabilityStage } from '../gameplay/InstabilityManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import { MAX_SPELL_CHARGES, SPELL_IDS, type SpellCharges, type SpellId } from '../gameplay/SpellManager';
import { hex, LAYOUT, SPELL_COLORS } from '../render/layout';
import { SPELLS } from '../spells/SpellRegistry';
import { TypingConsole } from './TypingConsole';

const INSTABILITY_COLORS: Record<InstabilityStage, number> = {
  0: PALETTE.arcane,
  1: PALETTE.gold,
  2: PALETTE.fire,
  3: PALETTE.crimson,
  4: PALETTE.crimson,
};

const label = (color: number = PALETTE.parchment): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONTS.gameplay,
  fontSize: '20px',
  color: hex(color),
});

const BAR_WIDTH = 360;
const BAR_HEIGHT = 14;
const SLOT_W = 70;
const SLOT_H = 42;
const SLOT_GAP = 8;

/** A labelled horizontal meter that animates to new values. */
class Meter {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private shown = 0;
  private readonly tweenTarget = { value: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly caption: (value: number) => string,
    private color: number,
  ) {
    this.bar = scene.add.graphics().setDepth(30);
    this.text = scene.add
      .text(x + BAR_WIDTH / 2, y - 16, '', { ...label(), fontSize: '14px', fontStyle: '600' })
      .setOrigin(0.5)
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

  private draw(value: number): void {
    this.shown = value;
    const { x, y } = this;
    const g = this.bar;
    g.clear();
    g.fillStyle(PALETTE.midnight, 0.9);
    g.fillRoundedRect(x - 2, y - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4, 8);
    if (value > 0) {
      g.fillStyle(this.color, 0.95);
      g.fillRoundedRect(x, y, Math.max(BAR_HEIGHT, (BAR_WIDTH * Math.min(value, 100)) / 100), BAR_HEIGHT, 6);
    }
    g.lineStyle(1, PALETTE.gold, 0.5);
    g.strokeRoundedRect(x - 2, y - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4, 8);
    this.text.setText(this.caption(value));
  }
}

/** One spell inventory slot: the word to type (e.g. "fire") and charge pips. */
class SpellSlot {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly container: Phaser.GameObjects.Container;
  private readonly color: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly spell: SpellId,
    x: number,
    y: number,
  ) {
    this.color = SPELL_COLORS[spell];
    const def = SPELLS[spell];
    this.frame = scene.add.graphics();
    this.pips = scene.add.graphics();
    const name = scene.add
      .text(0, -7, def.id, { ...label(this.color), fontSize: '16px', fontStyle: '700' })
      .setOrigin(0.5);
    this.container = scene.add
      .container(x + SLOT_W / 2, y + SLOT_H / 2, [this.frame, this.pips, name])
      .setDepth(31);
    this.set(0);
  }

  set(charges: number): void {
    const active = charges > 0;
    this.frame.clear();
    this.frame.fillStyle(active ? this.color : PALETTE.charcoal, active ? 0.18 : 0.6);
    this.frame.fillRoundedRect(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H, 10);
    this.frame.lineStyle(active ? 2 : 1, active ? this.color : PALETTE.parchment, active ? 0.95 : 0.25);
    this.frame.strokeRoundedRect(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H, 10);
    this.container.setAlpha(active ? 1 : 0.55);

    this.pips.clear();
    for (let i = 0; i < MAX_SPELL_CHARGES; i++) {
      const px = (i - (MAX_SPELL_CHARGES - 1) / 2) * 14;
      if (i < charges) {
        this.pips.fillStyle(this.color, 1);
        this.pips.fillCircle(px, 11, 4);
      } else {
        this.pips.lineStyle(1, PALETTE.parchment, 0.5);
        this.pips.strokeCircle(px, 11, 3.5);
      }
    }
  }

  /** Bright pulse when cast or collected. */
  pulse(): void {
    this.scene.tweens.add({ targets: this.container, scale: { from: 1.18, to: 1 }, duration: 260, ease: 'Back.Out' });
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
    this.frame.lineStyle(2, PALETTE.crimson, 1);
    this.frame.strokeRoundedRect(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H, 10);
  }
}

/**
 * Heads-up display.
 * Top bar: level, run score, combo, spell slots (type the word shown to cast).
 * Bottom panel: level progress meter · typing console (+ accuracy/WPM) · ward instability meter.
 */
export class GameHUD {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly accuracyText: Phaser.GameObjects.Text;
  private readonly progress: Meter;
  private readonly instability: Meter;
  private readonly slots: Record<SpellId, SpellSlot>;
  readonly console: TypingConsole;
  private lastCharges: SpellCharges | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    levelName: string,
    private readonly quota: number | null,
    /** Run score from earlier levels, added to this level's score. */
    private readonly scoreOffset = 0,
  ) {
    // Top bar
    const bar = scene.add.graphics().setDepth(30);
    bar.fillStyle(PALETTE.midnight, 0.85);
    bar.fillRect(0, 0, LAYOUT.width, LAYOUT.hudHeight);
    bar.lineStyle(1, PALETTE.gold, 0.35);
    bar.lineBetween(0, LAYOUT.hudHeight, LAYOUT.width, LAYOUT.hudHeight);

    const y = LAYOUT.hudHeight / 2;
    const levelText = scene.add
      .text(20, y, levelName, { ...label(PALETTE.gold), fontFamily: FONTS.heading, fontSize: '22px' })
      .setOrigin(0, 0.5)
      .setDepth(31);
    // Fixed columns after the level name, so values changing width don't make the bar jitter.
    const x0 = Math.max(240, levelText.x + levelText.width + 36);
    this.scoreText = scene.add.text(x0, y, '', label()).setOrigin(0, 0.5).setDepth(31);
    this.comboText = scene.add.text(x0 + 190, y, '', label()).setOrigin(0, 0.5).setDepth(31);

    // Spell slots, top right. Each shows the word to type to cast it.
    const slotsWidth = SPELL_IDS.length * SLOT_W + (SPELL_IDS.length - 1) * SLOT_GAP;
    const slotX = LAYOUT.width - 20 - slotsWidth;
    this.slots = {} as Record<SpellId, SpellSlot>;
    SPELL_IDS.forEach((id, i) => {
      this.slots[id] = new SpellSlot(scene, id, slotX + i * (SLOT_W + SLOT_GAP), (LAYOUT.hudHeight - SLOT_H) / 2);
    });

    // Bottom panel
    const panelY = LAYOUT.panelY;
    const panel = scene.add.graphics().setDepth(29);
    panel.fillStyle(PALETTE.midnight, 0.85);
    panel.fillRect(0, panelY - 4, LAYOUT.width, LAYOUT.height - panelY + 4);

    const meterY = panelY + 34;
    this.progress = new Meter(
      scene,
      40,
      meterY,
      (v) =>
        this.quota === null
          ? 'ENDLESS'
          : `LEVEL PROGRESS  ${Math.round((v / 100) * this.quota)} / ${this.quota}`,
      PALETTE.gold,
    );
    this.instability = new Meter(
      scene,
      LAYOUT.width - 40 - BAR_WIDTH,
      meterY,
      (v) => `WARD INSTABILITY  ${Math.round(v)}%`,
      INSTABILITY_COLORS[0],
    );

    this.console = new TypingConsole(scene, LAYOUT.width / 2, panelY + 26);
    this.accuracyText = scene.add
      .text(LAYOUT.width / 2, panelY + 61, '', { ...label(), fontSize: '13px' })
      .setOrigin(0.5)
      .setAlpha(0.7)
      .setDepth(31);

    this.updateStats(null);
  }

  updateStats(stats: GameStats | null, combo = 0): void {
    const s = stats;
    this.scoreText.setText(`Score  ${(this.scoreOffset + (s?.score ?? 0)).toLocaleString()}`);
    this.comboText
      .setText(`Combo  ×${combo}`)
      .setColor(hex(combo >= 5 ? PALETTE.gold : PALETTE.parchment));
    const acc = s ? Math.round(s.accuracy * 100) : 100;
    const wpm = s ? Math.round(s.wpm) : 0;
    this.accuracyText.setText(`Accuracy ${acc}%  ·  ${wpm} WPM`);
  }

  pulseCombo(): void {
    this.scene.tweens.add({ targets: this.comboText, scale: { from: 1.25, to: 1 }, duration: 200 });
  }

  setProgress(completed: number): void {
    if (this.quota === null) return;
    this.progress.set(Math.min(100, (completed / this.quota) * 100));
  }

  setInstability(value: number, stage: InstabilityStage): void {
    this.instability.set(value, INSTABILITY_COLORS[stage]);
  }

  setSpells(charges: SpellCharges, pulse?: SpellId): void {
    for (const id of SPELL_IDS) {
      if (!this.lastCharges || this.lastCharges[id] !== charges[id]) this.slots[id].set(charges[id]);
    }
    this.lastCharges = { ...charges };
    if (pulse) this.slots[pulse].pulse();
  }

  denySpell(spell: SpellId): void {
    this.slots[spell].deny();
    this.scene.time.delayedCall(260, () => this.slots[spell].set(this.lastCharges?.[spell] ?? 0));
  }
}
