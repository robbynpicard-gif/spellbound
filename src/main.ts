import Phaser from 'phaser';
import './styles/main.css';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from './core/GameConfig';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: PALETTE.midnight,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainMenuScene],
});

// Handy for debugging in the browser console during development only.
if (import.meta.env.DEV) {
  (window as unknown as { spellbound: Phaser.Game }).spellbound = game;
}
