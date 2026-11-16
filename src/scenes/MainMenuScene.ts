import Phaser from 'phaser';
import { FONTS, GAME_HEIGHT, GAME_TITLE, GAME_WIDTH, PALETTE } from '../core/GameConfig';

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/**
 * Milestone 0 title screen. Its only job right now is to prove Phaser boots,
 * renders text and animates. The real menu (Campaign, Practice, Multiplayer,
 * Spellbook, Settings, Credits) is built in later milestones.
 */
export class MainMenuScene extends Phaser.Scene {
  static readonly KEY = 'MainMenuScene';

  constructor() {
    super(MainMenuScene.KEY);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    this.cameras.main.setBackgroundColor(PALETTE.midnight);
    this.createDriftingMotes();

    this.add
      .text(cx, GAME_HEIGHT * 0.36, GAME_TITLE.toUpperCase(), {
        fontFamily: FONTS.heading,
        fontSize: '96px',
        color: hex(PALETTE.gold),
      })
      .setOrigin(0.5)
      .setLetterSpacing(12)
      .setShadow(0, 0, hex(PALETTE.arcane), 24, false, true);

    this.add
      .text(cx, GAME_HEIGHT * 0.5, 'Defend the tower. Speak the counterspell.', {
        fontFamily: FONTS.heading,
        fontSize: '28px',
        fontStyle: 'italic',
        color: hex(PALETTE.parchment),
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        GAME_HEIGHT * 0.86,
        `Project foundation ready · Phaser ${Phaser.VERSION}\nGameplay arrives in Milestone 1`,
        {
          fontFamily: FONTS.gameplay,
          fontSize: '18px',
          color: hex(PALETTE.parchment),
          align: 'center',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

  /** Slow golden motes of light: a quick check that the update loop runs. */
  private createDriftingMotes(): void {
    for (let i = 0; i < 40; i++) {
      const mote = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(1, 3),
        i % 3 === 0 ? PALETTE.arcane : PALETTE.gold,
        Phaser.Math.FloatBetween(0.2, 0.7),
      );
      this.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(60, 160),
        alpha: 0,
        duration: Phaser.Math.Between(4000, 9000),
        delay: Phaser.Math.Between(0, 4000),
        repeat: -1,
      });
    }
  }
}
