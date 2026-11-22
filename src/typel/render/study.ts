/** Shared TypeL textures and the room (prototype, D-085/D-086). */
import Phaser from 'phaser';
import { H, paintFlame, paintGlow, paintStar, W } from './paint';
import { buildWorld, dressForMenu, preloadKeyart } from './keyart';

/** Scroll lettering (D-086): clear, bold, slightly hand-lettered. */
export const FONT_WORD = '"Kalam", "Patrick Hand", "Comic Neue", "Trebuchet MS", sans-serif';
/** Numbers and callouts: engraved, weighty, grown-up (D-087 replaces the chunky cartoon face). */
export const FONT_ARCADE = '"Cinzel", "Trajan Pro", "Palatino Linotype", Georgia, serif';
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

/** Small generated textures for particles and glows (the world itself is the painted key art, D-093). */
export function ensureTextures(scene: Phaser.Scene): void {
  canvas(scene, 'typel-spark', 32, 32, (c) => paintGlow(c, 32, 'rgba(255,245,210,1)'));
  canvas(scene, 'typel-star', 32, 32, (c) => paintStar(c, 32));
  canvas(scene, 'typel-glow-gold', 128, 128, (c) => paintGlow(c, 128, 'rgba(255,220,120,0.95)'));
  canvas(scene, 'typel-flame', 32, 48, paintFlame);
  canvas(scene, 'typel-sheen', 32, 64, (c) => {
    const g = c.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 64);
  });
  canvas(scene, 'typel-edge', 64, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 256);
  });
}

/** Menus: the same painted world at rest, under a gentle veil. */
export class TypeLMenuScene extends Phaser.Scene {
  static readonly KEY = 'typel-menu';
  constructor() {
    super(TypeLMenuScene.KEY);
  }
  private wizard?: ReturnType<typeof buildWorld>['wizard'];
  preload(): void {
    preloadKeyart(this);
  }
  create(): void {
    ensureTextures(this);
    const world = buildWorld(this, true);
    this.wizard = world.wizard;
    dressForMenu(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0705, 0.3).setDepth(30);
  }
  override update(_t: number, delta: number): void {
    this.wizard?.tick(delta);
  }
}
