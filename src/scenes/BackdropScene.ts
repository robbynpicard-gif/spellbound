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
    if (this.textures.exists(ART.backdrop)) this.add.image(0, 0, ART.backdrop).setOrigin(0).setScale(ART_SCALE);
    // Darken it so the menus stand out (the live HUD areas are empty here).
    this.add.rectangle(0, 0, LAYOUT.width, LAYOUT.height, PALETTE.midnight, 0.55).setOrigin(0);

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
