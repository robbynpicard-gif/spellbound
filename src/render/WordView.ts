import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { WordState } from '../gameplay/Word';
import { ART_SCALE, hex, screenY, SPELL_COLORS } from './layout';

const FONT_SIZE = 24;
/** One art pixel, in screen pixels. */
const PX = ART_SCALE;
/** Paper height in art pixels (the text sits in the middle). */
const PAPER_H = 9;

/** Parchment shades and grime, matching tools/pixelart/pixelart.py. */
const PARCH = 0xc4b082;
const PARCH2 = 0xa0885e;
const PARCH3 = 0x705a3a;
const GRIME = 0x0e0c0a;
const ROLL = 0x30211a;

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONTS.gameplay,
  fontSize: `${FONT_SIZE}px`,
  fontStyle: '600',
};

/** Small deterministic random source, so each scroll keeps the same stains. */
function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const darken = (color: number, f: number): number =>
  (Math.round(((color >> 16) & 255) * f) << 16) | (Math.round(((color >> 8) & 255) * f) << 8) | Math.round((color & 255) * f);

/**
 * Draws one falling word as a stained parchment scroll in pixel art
 * (decisions.md D-028): ink letters, typed letters in rust, a rust frame
 * around the current target, a coloured ribbon and wax seal on spell
 * scrolls, and a frosted frame while frozen. Reads WordState; never changes it.
 */
export class WordView extends Phaser.GameObjects.Container {
  private readonly paper: Phaser.GameObjects.Graphics;
  private readonly typedText: Phaser.GameObjects.Text;
  private readonly restText: Phaser.GameObjects.Text;
  private readonly restColor: string = hex(PALETTE.ink);
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
    this.paper = scene.add.graphics();
    this.typedText = scene.add.text(0, 0, '', { ...TEXT_STYLE, color: hex(PALETTE.rust) }).setOrigin(0, 0.5);
    this.restText = scene.add.text(0, 0, '', { ...TEXT_STYLE, color: this.restColor }).setOrigin(0, 0.5);
    this.add([this.paper, this.typedText, this.restText]);
    scene.add.existing(this);

    this.setAlpha(0).setScale(0.8);
    scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' });
    this.sync(1);
  }

  /** Screen position for the current interpolation factor (0–1 between ticks). */
  sync(alpha: number): void {
    const w = this.word;
    // Snap to the art grid so the scroll moves in whole art pixels, like the backdrop.
    const y = Math.round(screenY(Phaser.Math.Linear(w.prevY, w.y, alpha)) / 2) * 2;
    this.setPosition(w.x + this.shake.offset, y);
    if (w.typed !== this.drawnTyped || w.isTarget !== this.drawnTarget) this.redraw();
  }

  /** Approximate on-screen bounds, for mouse clicks. */
  hitTest(x: number, y: number): boolean {
    return Math.abs(x - this.x) <= this.halfWidth + 8 && Math.abs(y - this.y) <= (PAPER_H * PX) / 2 + 8;
  }

  /** Redraw after the word's text changed (Transmutation), with a little pop. */
  refreshText(): void {
    this.drawnTyped = -1;
    this.redraw();
    this.scene.tweens.add({ targets: this, scale: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.Out' });
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
    const typedWidth = w.typed > 0 ? this.typedText.width : 0;
    const textWidth = typedWidth + this.restText.width;
    const ribbon = w.spell ? 3 : 0;

    // Paper size in art pixels; the text is centred on the paper (past the ribbon).
    const cols = Math.max(14, Math.ceil(textWidth / PX) + 6 + ribbon);
    const x0 = -Math.floor(cols / 2);
    const x1 = x0 + cols;
    const y0 = -Math.floor(PAPER_H / 2);
    const y1 = y0 + PAPER_H - 1;
    this.halfWidth = ((cols + 4) * PX) / 2;

    const textLeft = (x0 + ribbon) * PX + ((cols - ribbon) * PX - textWidth) / 2;
    this.typedText.x = Math.round(textLeft);
    this.restText.x = Math.round(textLeft + typedWidth);
    this.typedText.y = this.restText.y = 1;

    this.drawScroll(x0, x1, y0, y1);
    this.setDepth(w.isTarget ? 10 : 1);
  }

  /** The scroll, in art pixels (each `px` call fills one PX×PX block). */
  private drawScroll(x0: number, x1: number, y0: number, y1: number): void {
    const g = this.paper;
    const w = this.word;
    const rand = rng(w.id * 7919 + w.text.length);
    const px = (x: number, y: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillRect(x * PX, y * PX, PX, PX);
    };
    const rect = (ax: number, ay: number, bx: number, by: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillRect(ax * PX, ay * PX, (bx - ax + 1) * PX, (by - ay + 1) * PX);
    };
    g.clear();

    // Frame: rust around the word being typed, frost while frozen.
    if (w.isTarget || this.frozen) {
      const frame = w.isTarget ? PALETTE.rust : PALETTE.ice;
      rect(x0 - 4, y0 - 2, x1 + 4, y1 + 2, frame, 0.95);
      rect(x0 - 3, y0 - 1, x1 + 3, y1 + 1, GRIME, 0.9);
    }

    // Paper, with grime, stains, torn edges and a singed corner.
    rect(x0, y0, x1, y1, PARCH);
    for (let y = y0 + 1; y < y1; y++) {
      for (let x = x0 + 1; x < x1; x++) if (rand() < 0.06) px(x, y, PARCH2, 0.8);
    }
    for (let i = 0; i < 2; i++) {
      const sx = x0 + 2 + Math.floor(rand() * (x1 - x0 - 4));
      const sy = y0 + 1 + Math.floor(rand() * (y1 - y0 - 1));
      rect(sx - 2, sy, sx + 2, sy, PARCH2, 0.5);
    }
    for (let x = x0; x <= x1; x++) {
      if (rand() < 0.18) px(x, y0, GRIME);
      if (rand() < 0.18) px(x, y1, PARCH3);
    }
    rect(x0, y1, x1, y1, PARCH2, 0.7);
    px(x1 - 1, y0, GRIME);
    px(x1 - 2, y0, PARCH3);
    px(x1 - 1, y0 + 1, PARCH3);

    // Rolled ends.
    for (const e of [x0 - 2, x1 + 1]) {
      rect(e, y0 - 1, e + 1, y1 + 1, PARCH3);
      rect(e, y0 - 1, e, y1 + 1, ROLL);
      px(e, y0 - 2, ROLL);
      px(e + 1, y1 + 2, ROLL);
    }

    // Spell scroll: ribbon down the left edge and a wax seal.
    if (w.spell) {
      const color = SPELL_COLORS[w.spell];
      rect(x0 + 1, y0, x0 + 2, y1, color);
      const seal = darken(color, 0.75);
      rect(x0 + 1, y1, x0 + 3, y1 + 2, seal);
      px(x0, y1 + 1, seal);
      px(x0 + 4, y1 + 1, seal);
      px(x0 + 2, y1 + 1, color);
      px(x0 + 1, y1 + 4, color);
      px(x0 + 3, y1 + 4, color);
    }
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens.killTweensOf(this.shake);
    super.destroy(fromScene);
  }
}
