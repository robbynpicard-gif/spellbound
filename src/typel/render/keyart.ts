/**
 * D-093: Typel's look is the owner's key-art painting. The painting is cut
 * into layers (tools/keyart/*.py → public/assets/typel/keyart/) and every
 * element that shows game state is a live object on top of it. This module
 * loads the layers and builds the living world: the rune arch (the Ward made
 * visible), the Rush wisps, candles, steam, the turning gear, the Grand Wizard
 * on his cloud and the apprentice's painted hands.
 *
 * Rendering only: nothing here reads or changes game rules.
 */
import Phaser from 'phaser';
import layout from './keyart.json';

type Box = { x: number; y: number; w: number; h: number; capL?: number; capR?: number; pivotX?: number; pivotY?: number };
type Pt = [number, number];
export const KA = layout as unknown as {
  scale: number;
  sprites: Record<string, Box>;
  rackCount: Record<string, Pt>;
  gauge: { x: number; y: number; from: number; to: number; r: number };
  tubes: { combo: { x: number; top: number; bottom: number; w: number }; rush: { x: number; top: number; bottom: number; w: number; band: Pt } };
  drums: { y: number; top: number; bottom: number; cells: Pt[]; comma: Pt };
  plates: { base: Pt; combo: Pt; rush: Pt; level: Pt; levelAngle: number };
  tray: Pt[];
  paper: { strikeX: number; baseline: number; left: number; right: number; top: number; bottom: number };
  keys: Record<string, Pt>;
  note: { x: number; y: number; angle: number; w: number };
  candles: Pt[];
  steam: { vent: Pt; cup: Pt; pipe: Pt };
  field: { x: number; y: number; w: number; h: number };
  /** D-096: the shorter shelf under the title; `boards` are the shelf surfaces, top to bottom. */
  shelf: { boards: number[]; top: number; left: number; right: number; scrollX: number; countX: number; ribbonX: number };
  /** D-096: the eight spell keys (Normal 1–8) above the letter keys. */
  spellKeys: Pt[];
  /** D-096: the Ward orb on the typewriter's right side. */
  orb: { x: number; y: number; r: number };
  /** D-098: the Rune display pane in the score machine. */
  runeDisplay: { x: number; y: number; w: number; h: number; lens: Pt; strip: Pt };
  /** D-096: the stage banner under the TYPEL plaque. */
  banner: { x: number; y: number; w: number; seal: Pt };
  pool: Pt;
  pipe: Pt;
};

const BASE = 'assets/typel/keyart/';
const FILES: Record<string, string> = {
  plate: 'plate.jpg', front: 'front.webp', arch: 'arch.png', wisps: 'wisps.webp', wizard: 'wizard.png',
  hand_l: 'hand_l.png', hand_r: 'hand_r.png', medal_1: 'medal_1.png', medal_2: 'medal_2.png', medal_3: 'medal_3.png',
  scroll_plain: 'scroll_plain.png', flame: 'flame.png', catch: 'catch.png', hammer: 'hammer.png', gear: 'gear.png',
  combo_empty: 'combo_empty.png', combo_liquid: 'combo_liquid.png', combo_surface: 'combo_surface.png',
  rush_empty: 'rush_empty.png', rush_liquid: 'rush_liquid.png', rush_band: 'rush_band.png',
};
for (const s of ['slow', 'fire', 'ice', 'barrier', 'shock', 'alter', 'wind', 'harvest']) {
  FILES[`rack_${s}`] = `rack_${s}.png`;
  FILES[`ribbon_${s}`] = `ribbon_${s}.png`;
  FILES[`gem_${s}`] = `gem_${s}.png`;
}
// D-096 batch 01b sprites (owner-approved Flow art)
Object.assign(FILES, { lockbar_bar: 'lockbar_bar.png', lockbar_lock: 'lockbar_lock.png', seal_normal: 'seal_normal.png', seal_hardcore: 'seal_hardcore.png', orb_liquid: 'orb_liquid.png' });

/** Queue every painted layer that isn't loaded yet. Call from a scene's preload(). */
export function preloadKeyart(scene: Phaser.Scene): void {
  for (const [name, file] of Object.entries(FILES)) if (!scene.textures.exists(`ka-${name}`)) scene.load.image(`ka-${name}`, BASE + file);
}

const box = (name: string) => KA.sprites[name]!;

/** D-096: the shelf scrolls sit smaller on the shorter shelf. */
export const RACK_SCALE = 0.56;
const RIBBON_SCALE = 0.62;
/** Where spell `i`'s scroll rests: centred on its shelf, sitting on the board. */
export function shelfSpot(i: number, id: string): { x: number; y: number } {
  const h = box(`rack_${id}`).h * RACK_SCALE;
  return { x: KA.shelf.scrollX, y: KA.shelf.boards[i]! - h / 2 + 3 };
}
/** A shelf scroll at its spot. */
export function placeRack(scene: Phaser.Scene, i: number, id: string, depth: number): Phaser.GameObjects.Image {
  const p = shelfSpot(i, id);
  return scene.add.image(p.x, p.y, `ka-rack_${id}`).setScale(RACK_SCALE).setDepth(depth);
}
/** D-096: the spell's colour ribbon, hanging at the left of its compartment. */
export function placeRibbon(scene: Phaser.Scene, i: number, id: string, depth: number): Phaser.GameObjects.Image {
  const top = i === 0 ? KA.shelf.top : KA.shelf.boards[i - 1]! + 8;
  return scene.add.image(KA.shelf.ribbonX, top, `ka-ribbon_${id}`).setOrigin(0.5, 0).setScale(RIBBON_SCALE).setDepth(depth);
}
/** Place a painted cut-out exactly where it sits in the painting, centred for animation. */
export function placed(scene: Phaser.Scene, name: string, depth: number): Phaser.GameObjects.Image {
  const b = box(name);
  return scene.add.image(b.x + b.w / 2, b.y + b.h / 2, `ka-${name}`).setDepth(depth);
}

export const LEFT_KEYS = new Set([...'qwertasdfgzxcvb']);

/** The apprentice's painted hands: same reaction interface the scene already drives. */
export class PaintedHands {
  private readonly hand: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private readonly home: [{ x: number; y: number }, { x: number; y: number }];
  private nervous = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly reduced: boolean) {
    this.hand = [placed(scene, 'hand_l', 24), placed(scene, 'hand_r', 24)];
    this.home = [{ x: this.hand[0].x, y: this.hand[0].y }, { x: this.hand[1].x, y: this.hand[1].y }];
  }

  private settle(i: number, dy: number, ms: number, back = 90): void {
    const h = this.hand[i]!;
    this.scene.tweens.killTweensOf(h);
    if (this.reduced) return void h.setPosition(this.home[i]!.x, this.home[i]!.y).setAngle(0);
    this.scene.tweens.chain({ targets: h, tweens: [
      { y: this.home[i]!.y + dy, duration: ms, ease: 'Quad.easeOut' },
      { y: this.home[i]!.y, x: this.home[i]!.x, angle: 0, duration: back, ease: 'Quad.easeIn' },
    ] });
  }

  lookAt(_x: number, _y: number): void {}

  tickFrame(_delta: number): void {
    if (this.nervous > 0.55 && !this.reduced) for (const [i, h] of this.hand.entries()) if (!this.scene.tweens.isTweening(h)) h.x = this.home[i]!.x + (Math.random() - 0.5) * (this.nervous - 0.5) * 4;
  }

  typed(ch = ''): void {
    this.settle(LEFT_KEYS.has(ch.toLowerCase()) ? 0 : 1, 5, 35, 70);
  }

  captured(big: boolean): void {
    this.settle(0, big ? -10 : -4, 90, 160);
    this.settle(1, big ? -10 : -4, 90, 160);
  }

  mistyped(): void {
    if (this.reduced) return;
    for (const [i, h] of this.hand.entries()) {
      this.scene.tweens.killTweensOf(h);
      this.scene.tweens.add({ targets: h, x: this.home[i]!.x + (i ? 3 : -3), duration: 40, yoyo: true, repeat: 2, onComplete: () => h.setPosition(this.home[i]!.x, this.home[i]!.y) });
    }
  }

  plunging(): void {
    this.settle(0, -6, 120, 260);
    this.settle(1, -6, 120, 260);
  }

  breached(): void {
    this.settle(0, 14, 70, 300);
    this.settle(1, 14, 70, 300);
  }

  cheer(): void {
    this.settle(0, -16, 140, 260);
    this.settle(1, -16, 140, 260);
  }

  /** The right hand lifts to cast; returns the fingertip for the spell burst. */
  cast(): { x: number; y: number } {
    const h = this.hand[1];
    this.scene.tweens.killTweensOf(h);
    if (!this.reduced) this.scene.tweens.chain({ targets: h, tweens: [
      { y: this.home[1].y - 24, angle: -4, duration: 110, ease: 'Back.easeOut' },
      { y: this.home[1].y, angle: 0, x: this.home[1].x, duration: 220, ease: 'Quad.easeIn' },
    ] });
    return { x: h.x - h.displayWidth * 0.22, y: h.y - h.displayHeight * 0.42 };
  }

  setWonder(_on: boolean, _power: number): void {}

  setNervous(level: number): void {
    this.nervous = level;
  }
}

/** The Grand Wizard (D-093: from the key art): an eccentric observer on his cloud. */
export class GrandWizard {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly home: { x: number; y: number };
  private bubble: Phaser.GameObjects.Container | null = null;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly steam: Phaser.GameObjects.Particles.ParticleEmitter;
  private t = Math.random() * 1000;

  constructor(private readonly scene: Phaser.Scene, private readonly reduced: boolean) {
    this.sprite = placed(scene, 'wizard', -27);
    this.home = { x: this.sprite.x, y: this.sprite.y };
    const puff = { lifespan: 2600, speedY: { min: -26, max: -12 }, speedX: { min: -8, max: 6 }, scale: { start: 0.25, end: 1.1 }, alpha: { start: 0.32, end: 0 }, tint: 0xd8d4e8, frequency: reduced ? -1 : 520 };
    this.smoke = scene.add.particles(0, 0, 'typel-glow-gold', puff).setDepth(-26);
    this.steam = scene.add.particles(0, 0, 'typel-glow-gold', { ...puff, lifespan: 1600, scale: { start: 0.15, end: 0.6 }, alpha: { start: 0.28, end: 0 }, tint: 0xffffff, frequency: reduced ? -1 : 700 });
    this.steam.setDepth(-26);
  }

  private anchor(p: Pt): { x: number; y: number } {
    return { x: p[0] + (this.sprite.x - this.home.x), y: p[1] + (this.sprite.y - this.home.y) };
  }

  tick(delta: number): void {
    this.t += delta;
    if (!this.reduced && !this.scene.tweens.isTweening(this.sprite)) this.sprite.y = this.home.y + Math.sin(this.t / 950) * 4;
    const pipe = this.anchor(KA.steam.pipe);
    const cup = this.anchor(KA.steam.cup);
    this.smoke.setPosition(pipe.x, pipe.y);
    this.steam.setPosition(cup.x, cup.y);
  }

  private move(tweens: Record<string, unknown>[]): void {
    if (this.reduced) return;
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.chain({ targets: this.sprite, tweens: [...tweens, { x: this.home.x, y: this.home.y, angle: 0, scale: 1, duration: 260, ease: 'Sine.easeInOut' }] as never });
  }

  /** Approving nod: excellent typing, rescues. */
  nod(): void {
    this.move([{ angle: 3, y: this.home.y + 5, duration: 140, ease: 'Sine.easeOut' }, { angle: -1, y: this.home.y, duration: 160 }]);
  }

  /** A dry chuckle: Arcane Rush, fumbles. */
  chuckle(): void {
    this.move([{ y: this.home.y - 5, duration: 70 }, { y: this.home.y + 2, duration: 70 }, { y: this.home.y - 4, duration: 70 }, { y: this.home.y + 1, duration: 70 }]);
    this.smoke.explode(this.reduced ? 1 : 4);
  }

  /** Harrumph: leans in at breaches and dangerous mistakes. */
  harrumph(): void {
    this.move([{ scale: 1.05, angle: -3, y: this.home.y + 10, duration: 180, ease: 'Back.easeOut' }, { scale: 1.05, duration: 380 }]);
  }

  /** Genuinely impressed (he'd never say so): big scores, high Runes, wagers. */
  impressed(): void {
    this.move([{ y: this.home.y - 14, scale: 1.04, duration: 200, ease: 'Back.easeOut' }, { y: this.home.y - 14, duration: 300 }]);
    this.steam.explode(this.reduced ? 1 : 6);
  }

  /** A remark in a parchment bubble beside his cloud (his Rune lines, D-090). */
  say(text: string, ms = 3600): void {
    this.bubble?.destroy();
    if (!text) return;
    const s = this.scene;
    const t = s.add.text(0, 0, text, { fontFamily: '"Crimson Pro", Georgia, serif', fontStyle: 'italic 600', fontSize: '21px', color: '#2a170a', align: 'center', wordWrap: { width: 250 } }).setOrigin(0.5);
    const w = t.width + 34;
    const h = t.height + 22;
    const g = s.add.graphics();
    g.fillStyle(0x1a0c04, 0.35).fillRoundedRect(-w / 2 + 4, -h / 2 + 5, w, h, 14);
    g.fillStyle(0xf1e3c2, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 14).lineStyle(2, 0x8a6a3a, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(0xf1e3c2, 0.97).fillTriangle(w / 2 - 6, -8, w / 2 + 16, 2, w / 2 - 6, 10);
    const b = this.sprite.getBounds();
    this.bubble = s.add.container(b.left - w / 2 - 14, b.top + 92, [g, t]).setDepth(44).setAlpha(0);
    const bubble = this.bubble;
    s.tweens.add({ targets: bubble, alpha: 1, duration: 180 });
    s.tweens.add({ targets: bubble, alpha: 0, delay: ms, duration: 400, onComplete: () => bubble.destroy() });
  }
}

export interface World {
  arch: Phaser.GameObjects.Image;
  barriers: Phaser.GameObjects.Image[];
  wisps: Phaser.GameObjects.Image;
  gear: Phaser.GameObjects.Image;
  candles: Phaser.GameObjects.Image[];
  wizard: GrandWizard;
}

/** The painted world. Scrolls live at depth ~10, between the sky (≤ -20) and the desk (20). */
export function buildWorld(scene: Phaser.Scene, reduced: boolean): World {
  scene.add.image(0, 0, 'ka-plate').setOrigin(0).setDepth(-30);
  const F = KA.field;
  scene.add.particles(0, 0, 'typel-spark', {
    x: { min: F.x + 20, max: F.x + F.w - 20 }, y: { min: F.y, max: F.y + F.h * 0.8 },
    lifespan: 2600, scale: { start: 0, end: 0.12, ease: 'Sine.easeInOut', yoyo: true } as never, alpha: { start: 0.8, end: 0 },
    frequency: reduced ? 1200 : 380, blendMode: 'ADD',
  }).setDepth(-24);
  const archBox = box('arch');
  const arch = scene.add.image(archBox.x, archBox.y, 'ka-arch').setOrigin(0).setDisplaySize(archBox.w, archBox.h)
    .setBlendMode(Phaser.BlendModes.ADD).setTint(0x9ff8ee).setAlpha(0.2).setDepth(-28);
  const barriers = [0, 1, 2, 3, 4, 5].map((i) => {
    const s = 1 + 0.018 * (i + 1);
    return scene.add.image(archBox.x + archBox.w / 2, archBox.y + archBox.h, 'ka-arch').setOrigin(0.5, 1)
      .setDisplaySize(archBox.w * s, archBox.h * s).setBlendMode(Phaser.BlendModes.ADD).setTint(0x9fc0ff).setAlpha(0).setDepth(-28);
  });
  const wb = box('wisps');
  const wisps = scene.add.image(wb.x, wb.y, 'ka-wisps').setOrigin(0).setDisplaySize(wb.w, wb.h).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12).setDepth(-28);
  const wizard = new GrandWizard(scene, reduced);
  const gear = placed(scene, 'gear', -26);
  scene.add.image(0, box('front').y, 'ka-front').setOrigin(0).setDepth(20);
  const candles = KA.candles.map(([x, y]) => {
    const c = scene.add.image(x, y, 'typel-glow-gold').setDisplaySize(90, 120).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(21);
    if (!reduced) scene.tweens.add({ targets: c, alpha: { from: 0.32, to: 0.55 }, scaleX: { from: c.scaleX * 0.92, to: c.scaleX * 1.06 }, duration: 160 + Math.random() * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  });
  if (!reduced) {
    const [vx, vy] = KA.steam.vent;
    scene.add.particles(vx, vy, 'typel-glow-gold', {
      lifespan: 2200, speedY: { min: -40, max: -18 }, speedX: { min: 4, max: 22 }, scale: { start: 0.2, end: 0.9 },
      alpha: { start: 0.3, end: 0 }, tint: 0xe8e4f0, frequency: 420,
    }).setDepth(-26);
    // D-096: the wizard's pipe smoulders on the desk
    const [px, py] = KA.pipe;
    scene.add.particles(px, py, 'typel-glow-gold', {
      lifespan: 3200, speedY: { min: -34, max: -16 }, speedX: { min: -14, max: 4 }, scale: { start: 0.12, end: 0.75 },
      alpha: { start: 0.34, end: 0 }, tint: 0xd8d4e8, frequency: 360,
    }).setDepth(21.6);
  }
  return { arch, barriers, wisps, gear, candles, wizard };
}

/** Static dressing for the menus: a full shelf with its ribbons, zeroed drums, the note. */
export function dressForMenu(scene: Phaser.Scene): void {
  ['slow', 'fire', 'ice', 'barrier', 'shock', 'alter', 'wind', 'harvest'].forEach((id, i) => {
    placeRibbon(scene, i, id, 20.9);
    placeRack(scene, i, id, 21);
  });
  placed(scene, 'hand_l', 24);
  placed(scene, 'hand_r', 24);
  const D = KA.drums;
  D.cells.forEach(([a, b]) => scene.add.text((a + b) / 2, D.y, '0', { fontFamily: 'Georgia, serif', fontStyle: '700', fontSize: '66px', color: '#3a140a' }).setOrigin(0.5).setDepth(21));
  scene.add.text(D.comma[0], D.comma[1], ',', { fontFamily: 'Georgia, serif', fontStyle: '700', fontSize: '54px', color: '#3a140a' }).setOrigin(0.5).setDepth(21);
  scene.add.text(KA.note.x, KA.note.y, 'NO SMUDGES!\nAnd spell it right this time.\n— M.', { fontFamily: '"Kalam", "Patrick Hand", sans-serif', fontStyle: '700', fontSize: '18px', color: '#2a1a10', align: 'center', wordWrap: { width: KA.note.w } })
    .setOrigin(0.5).setAngle(KA.note.angle).setDepth(21);
}
