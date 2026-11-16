import Phaser from 'phaser';
import { PALETTE } from '../core/GameConfig';
import { ART, ART_SCALE, LAYOUT } from '../render/layout';

/**
 * The pixel-art study shown behind the HTML menus, with drifting dust in
 * the candlelight. (Menus are HTML, D-008.)
 */
export class BackdropScene extends Phaser.Scene {
  static readonly KEY = 'BackdropScene';

  constructor() {
    super(BackdropScene.KEY);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.midnight);
    if (this.textures.exists(ART.menu)) this.add.image(0, 0, ART.menu).setOrigin(0).setScale(ART_SCALE);

    for (let i = 0; i < 40; i++) {
      const mote = this.add.rectangle(
        Phaser.Math.Between(0, LAYOUT.width),
        Phaser.Math.Between(LAYOUT.hudHeight, LAYOUT.height),
        ART_SCALE / 2,
        ART_SCALE / 2,
        i % 3 === 0 ? PALETTE.parchment : PALETTE.gold,
        Phaser.Math.FloatBetween(0.15, 0.5),
      );
      this.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(60, 160),
        alpha: 0,
        duration: Phaser.Math.Between(5000, 10000),
        delay: Phaser.Math.Between(0, 4000),
        repeat: -1,
      });
    }
  }
}
