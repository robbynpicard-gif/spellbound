import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { WordState } from '../gameplay/Word';
import { hex, LAYOUT } from './layout';

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
 * Draws one falling word: typed letters in gold, the rest in parchment,
 * and a glowing plate behind the current target. Reads WordState; never
 * changes it.
 */
export class WordView extends Phaser.GameObjects.Container {
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly typedText: Phaser.GameObjects.Text;
  private readonly restText: Phaser.GameObjects.Text;
  private readonly shake = { offset: 0 };
  private drawnTyped = -1;
  private drawnTarget: boolean | null = null;
  private halfWidth = 0;

  constructor(
    scene: Phaser.Scene,
    readonly word: WordState,
  ) {
    super(scene, 0, 0);
    this.plate = scene.add.graphics();
    this.typedText = scene.add.text(0, 0, '', { ...BASE_STYLE, color: hex(PALETTE.gold) });
    this.restText = scene.add.text(0, 0, '', { ...BASE_STYLE, color: hex(PALETTE.parchment) });
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

  flashError(): void {
    this.restText.setColor(hex(PALETTE.crimson));
    this.scene.time.delayedCall(160, () => {
      if (this.active) this.restText.setColor(hex(PALETTE.parchment));
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

    this.plate.clear();
    if (w.isTarget) {
      const padX = 12;
      const h = FONT_SIZE + 18;
      this.plate.fillStyle(PALETTE.arcane, 0.28);
      this.plate.fillRoundedRect(-total / 2 - padX, -h / 2, total + padX * 2, h, 10);
      this.plate.lineStyle(2, PALETTE.gold, 0.9);
      this.plate.strokeRoundedRect(-total / 2 - padX, -h / 2, total + padX * 2, h, 10);
    }
    this.setDepth(w.isTarget ? 10 : 1);
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens.killTweensOf(this.shake);
    super.destroy(fromScene);
  }
}
