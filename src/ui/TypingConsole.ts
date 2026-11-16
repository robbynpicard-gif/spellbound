import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import { isSpellId, type SpellCharges } from '../gameplay/SpellManager';
import { hex, SPELL_COLORS } from '../render/layout';
import { SPELLS } from '../spells/SpellRegistry';

const W = 440;
const H = 46;
const FONT_SIZE = 26;
const PAD = 16;

/**
 * The typing console (decisions.md D-020): shows exactly what the player has
 * typed. The part that still matches a word or spell is parchment; anything
 * after the first wrong letter is crimson. A blinking caret marks the end.
 * Typing a spell name shows a "↵ cast" hint in that spell's colour.
 */
export class TypingConsole {
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly okText: Phaser.GameObjects.Text;
  private readonly badText: Phaser.GameObjects.Text;
  private readonly placeholder: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly caret: Phaser.GameObjects.Rectangle;
  private readonly container: Phaser.GameObjects.Container;
  private borderColor: number = PALETTE.gold;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONTS.gameplay,
      fontSize: `${FONT_SIZE}px`,
      fontStyle: '600',
    };
    this.box = scene.add.graphics();
    this.okText = scene.add.text(-W / 2 + PAD, 0, '', { ...style, color: hex(PALETTE.parchment) }).setOrigin(0, 0.5);
    this.badText = scene.add.text(0, 0, '', { ...style, color: '#ff7a6b' }).setOrigin(0, 0.5);
    this.placeholder = scene.add
      .text(-W / 2 + PAD, 0, 'type here · Enter casts spells · Esc pauses', {
        fontFamily: FONTS.gameplay,
        fontSize: '16px',
        color: hex(PALETTE.parchment),
      })
      .setOrigin(0, 0.5)
      .setAlpha(0.4);
    this.hint = scene.add
      .text(W / 2 - PAD, 0, '', { fontFamily: FONTS.gameplay, fontSize: '15px', fontStyle: '700' })
      .setOrigin(1, 0.5);
    this.caret = scene.add.rectangle(-W / 2 + PAD, 0, 2, FONT_SIZE, PALETTE.gold);
    scene.tweens.add({ targets: this.caret, alpha: 0, duration: 500, yoyo: true, repeat: -1, ease: 'Stepped' });

    this.container = scene.add
      .container(x, y, [this.box, this.placeholder, this.okText, this.badText, this.caret, this.hint])
      .setDepth(31);
    this.drawBox();
  }

  /** Redraw for new console text. `validLength` = leading characters that still match. */
  update(input: string, validLength: number, charges: SpellCharges): void {
    const ok = input.slice(0, validLength);
    const bad = input.slice(validLength);
    this.okText.setText(ok);
    this.badText.setText(bad);
    this.badText.x = this.okText.x + (ok ? this.okText.width : 0);
    this.caret.x = this.badText.x + (bad ? this.badText.width : 0) + 2;
    this.placeholder.setVisible(input.length === 0);

    if (isSpellId(input)) {
      const has = charges[input] > 0;
      this.hint
        .setText(has ? `↵ cast ${SPELLS[input].name}` : `no ${SPELLS[input].book} charges`)
        .setColor(hex(has ? SPELL_COLORS[input] : PALETTE.crimson));
      this.okText.setColor(hex(SPELL_COLORS[input]));
    } else {
      this.hint.setText('');
      this.okText.setColor(hex(PALETTE.parchment));
    }
    this.borderColor = bad ? PALETTE.crimson : PALETTE.gold;
    this.drawBox();
  }

  /** Brief coloured border flash (word destroyed, spell cast…). */
  flash(color: number): void {
    this.drawBox(color, 3);
    this.scene.time.delayedCall(180, () => this.drawBox());
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

  private drawBox(color = this.borderColor, width = 2): void {
    const g = this.box;
    g.clear();
    g.fillStyle(PALETTE.midnight, 0.95);
    g.fillRoundedRect(-W / 2, -H / 2, W, H, 10);
    g.lineStyle(width, color, 0.9);
    g.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);
  }
}
