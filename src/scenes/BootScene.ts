import Phaser from 'phaser';
import { MainMenuScene } from './MainMenuScene';

/**
 * First scene to run. Will load shared assets (fonts, textures, audio) once
 * they exist, then hands over to the main menu.
 */
export class BootScene extends Phaser.Scene {
  static readonly KEY = 'BootScene';

  constructor() {
    super(BootScene.KEY);
  }

  preload(): void {
    // No assets yet — art and audio arrive in later milestones.
  }

  create(): void {
    this.scene.start(MainMenuScene.KEY);
  }
}
