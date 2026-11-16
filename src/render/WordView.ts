import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { WordState } from '../gameplay/Word';
import { hex, LAYOUT, SPELL_COLORS } from './layout';

const FONT_SIZE = 28;
const STROKE = 5;

const BASE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONTS.gameplay,
  fontSize: `${FONT_SIZE}px`,
  fontStyle: '600',
  stroke: hex(PALETTE.midnight),
  strokeThickness: STROKE,
};

/**
 * Draws one falling word: typed letters in gold, the rest in parchment (or
 * the tome's spell colour), a glowing plate behind the current target, a
 * small book marker on spell tomes and a frost rim while frozen. Reads
 * WordState; never changes it.
 */
export class WordView extends Phaser.GameObjects.Container {
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly typedText: Phaser.GameObjects.Text;
  private readonly restText: Phaser.GameObjects.Text;
  private readonly restColor: string;
  private readonly shake = { offset: 0 };
  private drawnTyped = -1;
  private drawnTarget: boolean | null = null;
  private frozen = false;
  private halfWidth = 0;

  constructor(
    scene: Phaser.Scene,
    readonly word: WordState,
  ) {
    super(scene, 0, 0);
    this.restColor = hex(word.spell ? SPELL_COLORS[word.spell] : PALETTE.parchment);
    this.plate = scene.add.graphics();
    this.typedText = scene.add.text(0, 0, '', { ...BASE_STYLE, color: hex(PALETTE.gold) });
    this.restText = scene.add.text(0, 0, '', { ...BASE_STYLE, color: this.restColor });
    this.typedText.setOrigin(0, 0.5);
    this.restText.setOrigin(0, 0.5);
    this.add([this.plate, this.typedText, this.restText]);
    scene.add.existing(this);

    this.setAlpha(0).setScale(0.8);
    scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' });
    this.sync(1);
  }

  /** Screen position for the current interpolation factor (0–1 between ticks). */
  sync(alpha: number): void {
    const w = this.word;
    const y = LAYOUT.spawnY + Phaser.Math.Linear(w.prevY, w.y, alpha);
    this.setPosition(w.x + this.shake.offset, y);
    if (w.typed !== this.drawnTyped || w.isTarget !== this.drawnTarget) this.redraw();
  }

  /** Approximate on-screen bounds, for mouse clicks. */
  hitTest(x: number, y: number): boolean {
    return Math.abs(x - this.x) <= this.halfWidth + 12 && Math.abs(y - this.y) <= FONT_SIZE;
  }

  setFrozen(frozen: boolean): void {
    if (this.frozen === frozen) return;
    this.frozen = frozen;
    this.redraw();
  }

  flashError(): void {
    this.restText.setColor(hex(PALETTE.crimson));
    this.scene.time.delayedCall(160, () => {
      if (this.active) this.restText.setColor(this.restColor);
    });
    this.scene.tweens.killTweensOf(this.shake);
    this.scene.tweens.add({
      targets: this.shake,
      offset: { from: -6, to: 6 },
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => (this.shake.offset = 0),
    });
  }

  private redraw(): void {
    const w = this.word;
    this.drawnTyped = w.typed;
    this.drawnTarget = w.isTarget;

    this.typedText.setText(w.text.slice(0, w.typed));
    this.restText.setText(w.text.slice(w.typed));
    // Text width includes the outline; overlap by that much so the two halves read as one word.
    const typedWidth = w.typed > 0 ? this.typedText.width - STROKE : 0;
    const total = typedWidth + this.restText.width;
    this.halfWidth = total / 2;
    this.typedText.x = -total / 2;
    this.restText.x = -total / 2 + typedWidth;

    const padX = 12;
    const h = FONT_SIZE + 18;
    const left = -total / 2 - padX;
    const g = this.plate;
    g.clear();
    if (w.isTarget) {
      g.fillStyle(PALETTE.arcane, 0.28);
      g.fillRoundedRect(left, -h / 2, total + padX * 2, h, 10);
      g.lineStyle(2, PALETTE.gold, 0.9);
      g.strokeRoundedRect(left, -h / 2, total + padX * 2, h, 10);
    } else if (this.frozen) {
      g.fillStyle(PALETTE.ice, 0.12);
      g.fillRoundedRect(left, -h / 2, total + padX * 2, h, 10);
      g.lineStyle(2, PALETTE.ice, 0.8);
      g.strokeRoundedRect(left, -h / 2, total + padX * 2, h, 10);
    }
    if (w.spell) this.drawTomeMarker(g, left - 6, SPELL_COLORS[w.spell]);
    this.setDepth(w.isTarget ? 10 : 1);
  }

  /** A small closed book to the left of the word. */
  private drawTomeMarker(g: Phaser.GameObjects.Graphics, right: number, color: number): void {
    const bw = 16;
    const bh = 20;
    const x = right - bw;
    g.fillStyle(color, 0.95);
    g.fillRoundedRect(x, -bh / 2, bw, bh, 3);
    g.fillStyle(PALETTE.midnight, 0.8);
    g.fillRect(x + 3, -bh / 2 + 2, 2, bh - 4);
    g.lineStyle(1, 0xffffff, 0.7);
    g.strokeRoundedRect(x, -bh / 2, bw, bh, 3);
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens.killTweensOf(this.shake);
    super.destroy(fromScene);
  }
}
