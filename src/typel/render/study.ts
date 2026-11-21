/** Shared Typel textures and the room (prototype, D-085/D-086). */
import Phaser from 'phaser';
import { FIELD_RECT, H, paintFlame, paintFrame, paintGlow, paintKey, paintMeters, paintRoom, paintSky, paintStar, paintTypewriter, W } from './paint';

/** Scroll lettering (D-086): clear, bold, slightly hand-lettered. */
export const FONT_WORD = '"Kalam", "Patrick Hand", "Comic Neue", "Trebuchet MS", sans-serif';
/** Arcade numbers and callouts: chunky and friendly. */
export const FONT_ARCADE = '"Lilita One", "Arial Black", Impact, sans-serif';
/** Titles: timeless and magical. */
export const FONT_TITLE = '"Cinzel Decorative", "Cinzel", "Palatino Linotype", Georgia, serif';
export const FONT_BODY = '"Crimson Pro", "Palatino Linotype", Georgia, serif';
export const hexNum = (hex: string) => parseInt(hex.replace('#', ''), 16);

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
}

export function ensureTextures(scene: Phaser.Scene): void {
  canvas(scene, 'typel-room', W, H, paintRoom);
  canvas(scene, 'typel-sky', FIELD_RECT.w, FIELD_RECT.h, (c) => paintSky(c, FIELD_RECT.w, FIELD_RECT.h));
  canvas(scene, 'typel-frame', W, H, paintFrame);
  canvas(scene, 'typel-typewriter', W, H, paintTypewriter);
  canvas(scene, 'typel-meters', W, H, paintMeters);
  canvas(scene, 'typel-key', 28, 28, paintKey);
  canvas(scene, 'typel-spark', 32, 32, (c) => paintGlow(c, 32, 'rgba(255,245,210,1)'));
  canvas(scene, 'typel-star', 32, 32, (c) => paintStar(c, 32));
  canvas(scene, 'typel-glow-gold', 128, 128, (c) => paintGlow(c, 128, 'rgba(255,220,120,0.95)'));
  canvas(scene, 'typel-flame', 32, 48, paintFlame);
  canvas(scene, 'typel-edge', 64, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 256);
  });
}

/** Room, sky, frame and typewriter. Returns nothing to animate; twinkles run on their own. */
export function buildRoom(scene: Phaser.Scene, withMeters: boolean): void {
  scene.add.image(0, 0, 'typel-room').setOrigin(0).setDepth(-30);
  scene.add.image(FIELD_RECT.x, FIELD_RECT.y, 'typel-sky').setOrigin(0).setDepth(-25);
  // twinkling stars and drifting magic motes in the sky
  scene.add.particles(0, 0, 'typel-star', {
    x: { min: FIELD_RECT.x + 20, max: FIELD_RECT.x + FIELD_RECT.w - 20 }, y: { min: 10, max: FIELD_RECT.h * 0.75 },
    lifespan: 2400, scale: { start: 0, end: 0.35, ease: 'Sine.easeInOut', yoyo: true } as never, alpha: { start: 1, end: 0 },
    frequency: 140, blendMode: 'ADD',
  }).setDepth(-24);
  scene.add.particles(0, 0, 'typel-spark', {
    x: { min: FIELD_RECT.x, max: FIELD_RECT.x + FIELD_RECT.w }, y: FIELD_RECT.h, lifespan: 9000, speedY: { min: -60, max: -20 },
    speedX: { min: -12, max: 12 }, scale: { start: 0.18, end: 0.05 }, alpha: { start: 0.7, end: 0 },
    tint: [0xff5fa8, 0x26d9e8, 0xffd977, 0xa259ff], frequency: 220, blendMode: 'ADD',
  }).setDepth(-24);
  scene.add.image(0, 0, 'typel-frame').setOrigin(0).setDepth(16);
  scene.add.image(0, 0, 'typel-typewriter').setOrigin(0).setDepth(22);
  if (withMeters) scene.add.image(0, 0, 'typel-meters').setOrigin(0).setDepth(20);
}

/** Menus: the same room, a gentler veil, and the typewriter keys at rest. */
export class TypelMenuScene extends Phaser.Scene {
  static readonly KEY = 'typel-menu';
  constructor() {
    super(TypelMenuScene.KEY);
  }
  create(): void {
    ensureTextures(this);
    buildRoom(this, false);
    ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].forEach((row, r) => {
      const x0 = 214 - ((row.length - 1) * 30) / 2 + r * 8;
      [...row].forEach((_, i) => this.add.image(x0 + i * 30, 966 + r * 30, 'typel-key').setDepth(24));
    });
    this.add.rectangle(W / 2, H / 2, W, H, 0x12051e, 0.3).setDepth(30);
  }
}
