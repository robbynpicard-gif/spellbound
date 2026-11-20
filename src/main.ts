/**
 * Typel prototype entry (D-085). The dev preview boots the new Arcane
 * Renaissance prototype; production `main` keeps its own entry until the
 * owner approves promotion.
 */
import Phaser from 'phaser';
import './typel/typel.css';
import { TypelApp } from './typel/app';
import { sound } from './typel/audio';
import { TypelPlayScene } from './typel/render/PlayScene';
import { TypelMenuScene } from './typel/render/study';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1920,
  height: 1080,
  backgroundColor: '#0c0806',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
  scene: [],
});
game.scene.add(TypelMenuScene.KEY, TypelMenuScene, false);
game.scene.add(TypelPlayScene.KEY, TypelPlayScene, false);

for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => sound.unlock(), { capture: true });

const app = new TypelApp(game, document.getElementById('ui-root')!);
const start = () => app.showTitle();
// Wait briefly for the web fonts so canvas text uses them; never block on it.
Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).then(() => {
  if (game.isBooted) start();
  else game.events.once('ready', start);
});

Object.assign(window, { typelGame: game, typelApp: app });
