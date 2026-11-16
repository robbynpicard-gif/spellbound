import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../core/GameConfig';

/**
 * Animated night-sky backdrop shown behind the HTML menus.
 * (Replaces the Milestone 0–1 Phaser title screen; menus are HTML now, D-008.)
 */
export class BackdropScene extends Phaser.Scene {
  static readonly KEY = 'BackdropScene';

  constructor() {
    super(BackdropScene.KEY);
  }

  create(): void {
    const sky = this.add.graphics();
    sky.fillGradientStyle(PALETTE.midnight, PALETTE.midnight, PALETTE.charcoal, PALETTE.charcoal, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (let i = 0; i < 60; i++) {
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
