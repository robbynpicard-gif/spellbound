import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import { isSpellId, type SpellCharges } from '../gameplay/SpellManager';
import { hex, SPELL_COLORS } from '../render/layout';
import { SPELLS } from '../spells/SpellRegistry';

const H = 56;
const FONT_SIZE = 24;
const PAD = 12;

/** Darker shades of a colour for ink on parchment. */
const inkOf = (color: number): number =>
  (Math.round(((color >> 16) & 255) * 0.6) << 16) | (Math.round(((color >> 8) & 255) * 0.6) << 8) | Math.round((color & 255) * 0.6);

/**
 * The typing console (decisions.md D-020), drawn as text typed onto the
 * sheet of paper in the wizard's alchemic typewriter (D-028). What still
 * matches a word or spell is ink; anything after the first wrong letter is
 * red. A blinking caret marks the end. The line under it shows the hint
 * ("↵ Enter", "↵ cast …").
 */
export class TypingConsole {
  private readonly flashBox: Phaser.GameObjects.Graphics;
  private readonly line: Phaser.GameObjects.Container;
  private readonly okText: Phaser.GameObjects.Text;
  private readonly badText: Phaser.GameObjects.Text;
  private readonly placeholder: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly caret: Phaser.GameObjects.Rectangle;
  private readonly container: Phaser.GameObjects.Container;
  private readonly W: number;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    width = 256,
  ) {
    this.W = width;
    const W = width;
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONTS.gameplay,
      fontSize: `${FONT_SIZE}px`,
      fontStyle: '700',
    };
    this.flashBox = scene.add.graphics();
    this.okText = scene.add.text(0, 0, '', { ...style, color: hex(PALETTE.ink) }).setOrigin(0, 0.5);
    this.badText = scene.add.text(0, 0, '', { ...style, color: hex(PALETTE.crimson) }).setOrigin(0, 0.5);
    this.caret = scene.add.rectangle(0, 0, 3, FONT_SIZE - 2, PALETTE.rust).setOrigin(0, 0.5);
    this.line = scene.add.container(-W / 2 + PAD, -8, [this.okText, this.badText, this.caret]);
    this.placeholder = scene.add
      .text(-W / 2 + PAD, -8, 'type a word, then Enter', {
        fontFamily: FONTS.heading,
        fontSize: '20px',
        color: hex(PALETTE.ink),
      })
      .setOrigin(0, 0.5)
      .setAlpha(0.45);
    this.hint = scene.add
      .text(W / 2 - PAD, H / 2 - 12, '', { fontFamily: FONTS.heading, fontSize: '18px' })
      .setOrigin(1, 0.5);
    scene.tweens.add({ targets: this.caret, alpha: 0, duration: 500, yoyo: true, repeat: -1, ease: 'Stepped' });

    this.container = scene.add
      .container(x, y, [this.flashBox, this.placeholder, this.line, this.hint])
      .setDepth(31);
  }

  /**
   * Redraw for new console text. `validLength` = leading characters that
   * still match; `completeWord` = Enter would destroy a word now.
   */
  update(input: string, validLength: number, charges: SpellCharges, completeWord = false): void {
    const ok = input.slice(0, validLength);
    const bad = input.slice(validLength);
    this.okText.setText(ok);
    this.badText.setText(bad);
    this.badText.x = ok ? this.okText.width : 0;
    this.caret.x = this.badText.x + (bad ? this.badText.width : 0) + 2;
    this.placeholder.setVisible(input.length === 0);
    // Long entries shrink to stay on the paper.
    const room = this.W - 2 * PAD;
    const used = this.caret.x + 4;
    this.line.setScale(used > room ? room / used : 1);

    if (completeWord) {
      this.hint.setText('↵ Enter').setColor(hex(PALETTE.rust));
      this.okText.setColor(hex(PALETTE.rust));
    } else if (isSpellId(input)) {
      const has = charges[input] > 0;
      this.hint
        .setText(has ? `↵ cast ${SPELLS[input].name}` : `no ${SPELLS[input].book} charges`)
        .setColor(hex(has ? inkOf(SPELL_COLORS[input]) : PALETTE.crimson));
      this.okText.setColor(hex(inkOf(SPELL_COLORS[input])));
    } else {
      this.hint.setText('');
      this.okText.setColor(hex(PALETTE.ink));
    }
  }

  /** Brief coloured flash on the paper (word destroyed, spell cast…). */
  flash(color: number): void {
    const g = this.flashBox;
    g.clear();
    g.fillStyle(color, 0.28);
    g.fillRect(-this.W / 2, -H / 2 + 4, this.W, H - 4);
    this.scene.time.delayedCall(160, () => g.clear());
  }

  /** Red shake: a submission that wasn't a word or spell. */
  reject(): void {
    this.flash(PALETTE.crimson);
    const x = this.container.x;
    this.scene.tweens.add({
      targets: this.container,
      x: { from: x - 6, to: x + 6 },
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.container.setX(x),
    });
  }
}
