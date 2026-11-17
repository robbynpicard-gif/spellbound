import Phaser from 'phaser';
import './styles/main.css';
import './styles/menu.css';
import { App } from './app/App';
import { audio } from './audio/Audio';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from './core/GameConfig';
import { CAMPAIGN_LEVELS } from './difficulty/LevelDefinitions';
import { BackdropScene } from './scenes/BackdropScene';
import { BOOT_COMPLETE, BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { browserStorage, SaveManager } from './storage/SaveManager';
import { UIRoot } from './ui/UIRoot';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: PALETTE.midnight,
  // Whole-pixel positions keep the pixel art and text crisp.
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, BackdropScene, GameScene],
});

const save = new SaveManager(browserStorage(), CAMPAIGN_LEVELS.count);
audio.setMusic(save.audio.music);
audio.setSfx(save.audio.sfx);
// Browsers only allow sound after the player clicks or presses a key.
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'click', 'touchend', 'keydown', 'keyup'] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true });
}
// A soft tick for every menu button.
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement | null)?.closest?.('.menu-button')) audio.click();
});

const app = new App(game, new UIRoot(document.getElementById('ui-root')!), save, CAMPAIGN_LEVELS);
game.events.once(BOOT_COMPLETE, () => app.showMainMenu());

// Handy for debugging in the browser console during development only.
if (import.meta.env.DEV) {
  Object.assign(window, { wizzyType: game, wizzyApp: app });
}
