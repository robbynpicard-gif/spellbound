/** Shared Typel textures and the study backdrop (prototype, D-085). */
import Phaser from 'phaser';
import { H, paintApprentice, paintFlame, paintGlow, paintInstruments, paintKey, paintStudy, paintTypewriter, W } from './paint';

export const FONT_WORD = '"Crimson Pro", "Iowan Old Style", "Palatino Linotype", Georgia, serif';
export const FONT_TITLE = '"Cormorant Garamond", "Palatino Linotype", Georgia, serif';
export const hexNum = (hex: string) => parseInt(hex.replace('#', ''), 16);

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
}

export function ensureTextures(scene: Phaser.Scene): void {
  canvas(scene, 'typel-study', W, H, paintStudy);
  canvas(scene, 'typel-typewriter', W, H, paintTypewriter);
  canvas(scene, 'typel-instruments', W, H, paintInstruments);
  canvas(scene, 'typel-apprentice', W, H, paintApprentice);
  canvas(scene, 'typel-key', 40, 40, (c) => paintKey(c, false));
  canvas(scene, 'typel-spark', 32, 32, (c) => paintGlow(c, 32, 'rgba(255,240,200,1)'));
  canvas(scene, 'typel-glow-gold', 128, 128, (c) => paintGlow(c, 128, 'rgba(255,214,120,0.9)'));
  canvas(scene, 'typel-candle-glow', 256, 256, (c) => paintGlow(c, 256, 'rgba(255,190,100,0.55)'));
  canvas(scene, 'typel-flame', 32, 48, paintFlame);
  canvas(scene, 'typel-veil', 256, 256, (c) => {
    // All-In veil: warm gold-crimson edges, clear centre.
    const g = c.createRadialGradient(128, 128, 60, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(160,40,30,0.25)');
    g.addColorStop(1, 'rgba(240,180,60,0.85)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  });
}

const CANDLES: [number, number][] = [[70, 238], [250, 494], [1690, 366], [1850, 622], [300, 690], [1600, 690]];

/** Paints the study, desk, typewriter and apprentice; returns the candle flames for animation. */
export function buildStudy(scene: Phaser.Scene, withInstruments: boolean): Phaser.GameObjects.Image[] {
  scene.add.image(0, 0, 'typel-study').setOrigin(0).setDepth(-20);
  const flames: Phaser.GameObjects.Image[] = [];
  for (const [x, y] of CANDLES) {
    scene.add.rectangle(x, y + 22, 14, 34, 0xe8dcc0).setDepth(-15);
    const glow = scene.add.image(x, y, 'typel-candle-glow').setDepth(-14).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
    const flame = scene.add.image(x, y - 2, 'typel-flame').setOrigin(0.5, 0.95).setDepth(-13).setScale(0.8);
    scene.tweens.add({ targets: glow, alpha: { from: 0.6, to: 0.9 }, scale: { from: 0.95, to: 1.05 }, duration: 380 + Math.random() * 300, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: flame, scaleY: { from: 0.75, to: 0.9 }, duration: 160 + Math.random() * 140, yoyo: true, repeat: -1 });
    flames.push(flame);
  }
  scene.add.image(0, 0, 'typel-apprentice').setOrigin(0).setDepth(-6);
  scene.add.image(0, 0, 'typel-typewriter').setOrigin(0).setDepth(20);
  if (withInstruments) scene.add.image(0, 0, 'typel-instruments').setOrigin(0).setDepth(21);
  // drifting dust in the window light
  scene.add.particles(0, 0, 'typel-spark', {
    x: { min: 480, max: 1440 }, y: { min: 40, max: 660 }, lifespan: 7000, speedY: { min: -6, max: 6 }, speedX: { min: -8, max: 8 },
    scale: { start: 0.12, end: 0.05 }, alpha: { start: 0, end: 0.35, ease: 'Sine.easeInOut' }, frequency: 260, blendMode: 'ADD',
  }).setDepth(-12);
  return flames;
}

/** A quiet backdrop for menus: the same study, typewriter and candles. */
export class TypelMenuScene extends Phaser.Scene {
  static readonly KEY = 'typel-menu';
  constructor() {
    super(TypelMenuScene.KEY);
  }
  create(): void {
    ensureTextures(this);
    buildStudy(this, false);
    // the typewriter's keys, at rest
    ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].forEach((row, r) => {
      const x0 = 960 - ((row.length - 1) * 48) / 2 + r * 10;
      [...row].forEach((_, i) => this.add.image(x0 + i * 48, 912 + r * 48, 'typel-key').setDepth(27));
    });
    this.add.rectangle(W / 2, H / 2, W, H, 0x0c0806, 0.35).setDepth(30);
  }
}
