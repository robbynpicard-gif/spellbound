import Phaser from 'phaser';
import { SPARK_TEXTURE } from '../render/Effects';
import { MainMenuScene } from './MainMenuScene';

/**
 * First scene to run. Prepares shared textures (and later loads fonts, art
 * and audio), then hands over to the main menu.
 */
export class BootScene extends Phaser.Scene {
  static readonly KEY = 'BootScene';

  constructor() {
    super(BootScene.KEY);
  }

  create(): void {
    this.createSparkTexture();
    this.scene.start(MainMenuScene.KEY);
  }

  /** A soft white dot used by particle effects (tinted per effect). */
  private createSparkTexture(): void {
    if (this.textures.exists(SPARK_TEXTURE)) return;
    const size = 16;
    const g = this.make.graphics({}, false);
    for (let r = size / 2; r > 0; r--) {
      g.fillStyle(0xffffff, 0.15 + 0.85 * (1 - r / (size / 2)) ** 2);
      g.fillCircle(size / 2, size / 2, r);
    }
    g.generateTexture(SPARK_TEXTURE, size, size);
    g.destroy();
  }
}
