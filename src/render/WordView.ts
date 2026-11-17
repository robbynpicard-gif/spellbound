import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import { SPELL_IDS } from '../gameplay/SpellManager';
import type { WordState } from '../gameplay/Word';
import { ART, ART_SCALE, hex, screenX, screenY, SPELL_COLORS } from './layout';
import { SIGIL_GLYPHS } from './sigilGlyphs';

const FONT_SIZE = 25;
/** One art pixel, in screen pixels. */
const PX = ART_SCALE;
/** Plaque height in art pixels. */
const PLAQUE_H = 20;

const PAPER = 0xd6ba8c;
const PAPER_DARK = 0xb4966a;
const PAPER_LIGHT = 0xead2a6;
const BORDER = 0x2a1a10;
const STUD = 0xc8963c;
const STUD_LIGHT = 0xf0c878;

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: FONTS.gameplay,
  fontSize: `${FONT_SIZE}px`,
  fontStyle: '700',
};

/** Small deterministic random source, so each plaque keeps the same wear. */
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

const shade = (color: number, f: number): number => {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c((color >> 16) & 255) << 16) | (c((color >> 8) & 255) << 8) | c(color & 255);
};

/**
 * One falling word as a parchment plaque in pixel art (decisions.md D-031):
 * dark ink on aged parchment with brass corner studs; typed letters in
 * magenta; a magenta glow around the current target; a teal frame while
 * frozen. Spell scrolls are coloured all over in the spell's colour, with
 * its icon. Reads WordState; never changes it.
 */
export class WordView extends Phaser.GameObjects.Container {
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly plaque: Phaser.GameObjects.Graphics;
  private readonly typedText: Phaser.GameObjects.Text;
  private readonly restText: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image | null = null;
  private readonly restColor: string;
  private readonly shake = { offset: 0 };
  private drawnTyped = -1;
  private drawnTarget: boolean | null = null;
  private frozen = false;
  private halfWidth = 0;

  constructor(
    scene: Phaser.Scene,
    readonly word: WordState,
    /** Sigil scrolls glow in the wizard's colour (D-042). */
    private readonly sigilColor: number = PALETTE.gold,
    /** Cosmetics (D-043): the sigil rune and the colour of typed letters ('' = default). */
    private readonly style: { sigil: string; ink: string } = { sigil: 'diamond', ink: '' },
  ) {
    super(scene, 0, 0);
    const onColour = word.spell !== null || word.sigil === true;
    this.restColor = hex(onColour ? 0xf6ecd8 : PALETTE.ink);
    this.glow = scene.add.graphics();
    this.plaque = scene.add.graphics();
    this.typedText = scene.add
      .text(0, 0, '', { ...TEXT_STYLE, color: onColour ? hex(0xffe0f4) : style.ink || hex(PALETTE.rust) })
      .setOrigin(0, 0.5);
    this.restText = scene.add.text(0, 0, '', { ...TEXT_STYLE, color: this.restColor }).setOrigin(0, 0.5);
    if (word.spell !== null) {
      for (const t of [this.typedText, this.restText]) t.setShadow(2, 2, '#1a1214', 0, false, true);
      this.icon = scene.add.image(0, 0, ART.icons, SPELL_IDS.indexOf(word.spell!)).setScale(3).setOrigin(0.5);
      scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.35 }, duration: 650, yoyo: true, repeat: -1 });
    }
    if (word.sigil) {
      for (const t of [this.typedText, this.restText]) t.setShadow(2, 2, '#1a1214', 0, false, true);
      scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.2 }, duration: 380, yoyo: true, repeat: -1 });
    }
    this.add([this.glow, this.plaque, this.typedText, this.restText]);
    if (this.icon) this.add(this.icon);
    scene.add.existing(this);

    this.setAlpha(0).setScale(0.8);
    scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' });
    this.sync(1);
  }

  /** Screen position for the current interpolation factor (0–1 between ticks). */
  sync(alpha: number): void {
    const w = this.word;
    // Snap to the art grid so plaques move in whole art pixels, like the backdrop.
    const y = Math.round(screenY(Phaser.Math.Linear(w.prevY, w.y, alpha)) / PX) * PX;
    this.setPosition(Math.round(screenX(w.x)) + this.shake.offset, y);
    if (w.typed !== this.drawnTyped || w.isTarget !== this.drawnTarget) this.redraw();
  }

  /** Approximate on-screen bounds, for mouse clicks. */
  hitTest(x: number, y: number): boolean {
    return Math.abs(x - this.x) <= this.halfWidth + 8 && Math.abs(y - this.y) <= (PLAQUE_H * PX) / 2 + 8;
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
    const iconCols = this.icon || w.sigil ? 20 : 0;

    // Plaque size in art pixels; the text sits centred (right of the icon on spell scrolls).
    const cols = Math.max(30, Math.ceil(textWidth / PX) + 16 + iconCols);
    const x0 = -Math.floor(cols / 2);
    const x1 = x0 + cols - 1;
    const y0 = -Math.floor(PLAQUE_H / 2);
    const y1 = y0 + PLAQUE_H - 1;
    this.halfWidth = (cols * PX) / 2;

    const textLeft = (x0 + iconCols) * PX + ((cols - iconCols) * PX - textWidth) / 2;
    this.typedText.x = Math.round(textLeft);
    this.restText.x = Math.round(textLeft + typedWidth);
    this.typedText.y = this.restText.y = 0;
    this.icon?.setPosition((x0 + 11) * PX, 0);

    this.draw(x0, x1, y0, y1);
    this.setDepth(w.isTarget ? 10 : 1);
  }

  /** The plaque, in art pixels. */
  private draw(x0: number, x1: number, y0: number, y1: number): void {
    const w = this.word;
    const g = this.plaque;
    const rect = (ax: number, ay: number, bx: number, by: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillRect(ax * PX, ay * PX, (bx - ax + 1) * PX, (by - ay + 1) * PX);
    };
    g.clear();
    const gl = this.glow;
    gl.clear();

    const spell = w.spell;
    const sigil = w.sigil === true;
    const body = spell ? SPELL_COLORS[spell] : sigil ? shade(this.sigilColor, 0.5) : PAPER;
    const light = spell || sigil ? shade(body, 1.3) : PAPER_LIGHT;
    const dark = spell || sigil ? shade(body, 0.62) : PAPER_DARK;

    // Glow behind: magenta for the target, the spell's colour (pulsing) for spell scrolls.
    if (w.isTarget || spell || sigil) {
      const c = w.isTarget ? PALETTE.magentaGlow : sigil ? this.sigilColor : body;
      if (sigil && !w.isTarget) {
        gl.fillStyle(c, 0.22);
        gl.fillRect((x0 - 12) * PX, (y0 - 9) * PX, (x1 - x0 + 25) * PX, (y1 - y0 + 19) * PX);
      }
      gl.fillStyle(c, w.isTarget ? 0.35 : 0.3);
      gl.fillRect((x0 - 5) * PX, (y0 - 4) * PX, (x1 - x0 + 11) * PX, (y1 - y0 + 9) * PX);
      gl.fillStyle(c, w.isTarget ? 0.2 : 0.15);
      gl.fillRect((x0 - 8) * PX, (y0 - 6) * PX, (x1 - x0 + 17) * PX, (y1 - y0 + 13) * PX);
    }
    // Frame: magenta when targeted, teal when frozen, dark otherwise.
    const frame = w.isTarget ? PALETTE.magentaGlow : this.frozen ? PALETTE.teal : BORDER;
    const fw = w.isTarget || this.frozen ? 2 : 1;
    rect(x0 - fw, y0 - fw, x1 + fw, y1 + fw, frame);

    rect(x0, y0, x1, y1, body);
    rect(x0, y0, x1, y0, light);
    rect(x0, y1 - 1, x1, y1, dark);
    // Wear: a few darker specks, always the same for this word.
    const rand = rng(w.id * 7919 + w.text.length);
    for (let i = 0; i < Math.floor((x1 - x0) / 5); i++) {
      const sx = x0 + 1 + Math.floor(rand() * (x1 - x0 - 1));
      const sy = y0 + 1 + Math.floor(rand() * (y1 - y0 - 2));
      rect(sx, sy, sx, sy, dark, 0.6);
    }
    // Brass studs in the corners.
    for (const [cx, cy] of [
      [x0 + 1, y0 + 1],
      [x1 - 2, y0 + 1],
      [x0 + 1, y1 - 3],
      [x1 - 2, y1 - 3],
    ] as const) {
      rect(cx, cy, cx + 1, cy + 1, STUD);
      rect(cx, cy, cx, cy, STUD_LIGHT);
    }
    // Spell scrolls: a darker panel behind the icon.
    if (spell) rect(x0 + 4, y0 + 3, x0 + 18, y1 - 3, shade(body, 0.45), 0.9);
    // Sigil scrolls: a glowing rune in the wizard's colour.
    if (sigil) {
      rect(x0 + 4, y0 + 3, x0 + 18, y1 - 3, shade(body, 0.45), 0.9);
      const glyph = SIGIL_GLYPHS[this.style.sigil] ?? SIGIL_GLYPHS.diamond!;
      const gx = x0 + 6;
      const gy = Math.round((y0 + y1) / 2) - 5;
      glyph.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === '#') rect(gx + rx, gy + ry, gx + rx, gy + ry, this.sigilColor);
          else if (ch === 'o' || ch === 'O') rect(gx + rx, gy + ry, gx + rx, gy + ry, 0xfff6e0);
        }
      });
    }
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens.killTweensOf(this.shake);
    if (this.glow) this.scene?.tweens.killTweensOf(this.glow);
    super.destroy(fromScene);
  }
}
