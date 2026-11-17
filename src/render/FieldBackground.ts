import Phaser from 'phaser';
import { PALETTE } from '../core/GameConfig';
import type { InstabilityStage } from '../gameplay/InstabilityManager';
import { ART, ART_SCALE, LAYOUT } from './layout';

/** Ward-line colour per instability stage: magenta → amber → ember → red. */
const WARD_COLORS: Record<InstabilityStage, number> = {
  0: PALETTE.arcane,
  1: PALETTE.gold,
  2: PALETTE.fire,
  3: PALETTE.crimson,
  4: PALETTE.crimson,
};

/** Crack lines across the seal (relative to its centre, in screen px); more show as the ward weakens. */
const CRACKS: readonly (readonly [number, number][])[] = [
  [[-20, -40], [-34, -70], [-30, -96], [-48, -128]],
  [[30, -10], [62, -24], [88, -18], [120, -40]],
  [[-10, 30], [-40, 52], [-56, 90], [-90, 104]],
  [[16, 40], [40, 76], [36, 104], [70, 126]],
  [[-60, -10], [-96, 0], [-118, -22], [-140, -18]],
];

/**
 * The study backdrop and the wizard (decisions.md D-037) plus what reacts to play: the
 * ward line words must not reach, a red glow as danger rises, the Arcane
 * Shield, and the runic seal on the wall, which flickers, darkens and
 * cracks as the ward weakens. Never covers the words.
 */
export class FieldBackground {
  private readonly ward: Phaser.GameObjects.Graphics;
  private readonly danger: Phaser.GameObjects.Graphics;
  private readonly shield: Phaser.GameObjects.Graphics;
  private readonly sealShade: Phaser.GameObjects.Graphics;
  private readonly sealCracks: Phaser.GameObjects.Graphics;
  private shieldPulse?: Phaser.Tweens.Tween;
  private pulse?: Phaser.Tweens.Tween;
  private flicker?: Phaser.Tweens.Tween;
  private stage: InstabilityStage = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    chapter = 1,
    /** 0–3 through a chapter's levels, 4 on its boss: weather and gloom build with it. */
    intensity = 0,
    boss = false,
    /** The wizard at the desk (D-042). */
    wizard = 'apprentice',
  ) {
    const { width, height } = LAYOUT;
    const key = ART.backdrop(chapter, boss);
    if (scene.textures.exists(key)) scene.add.image(0, 0, key).setOrigin(0).setScale(ART_SCALE).setDepth(-10);
    else scene.add.rectangle(0, 0, width, height, PALETTE.midnight).setOrigin(0).setDepth(-10);
    // The night deepens level by level through a chapter (only over the window view).
    const win = LAYOUT.window;
    if (intensity > 0) {
      scene.add
        .rectangle(win.left, 0, win.right - win.left, LAYOUT.wardY, PALETTE.midnight, 0.05 * intensity)
        .setOrigin(0)
        .setDepth(-9.5);
    }
    // The wizard, seated at lower left (D-037).
    const portrait = scene.textures.exists(ART.wizard(wizard)) ? ART.wizard(wizard) : ART.wizard();
    if (scene.textures.exists(portrait)) {
      scene.add.image(LAYOUT.wizard.x, LAYOUT.wizard.y, portrait).setOrigin(0).setScale(ART_SCALE).setDepth(-8.4);
    }

    // Seal deterioration, drawn over the seal in the backdrop.
    this.sealShade = scene.add.graphics().setDepth(-9);
    this.sealCracks = scene.add.graphics().setDepth(-9);

    this.weather(chapter, intensity);

    this.danger = scene.add.graphics().setDepth(-8).setAlpha(0);
    this.danger.fillGradientStyle(PALETTE.crimson, PALETTE.crimson, PALETTE.crimson, PALETTE.crimson, 0, 0, 0.3, 0.3);
    this.danger.fillRect(0, LAYOUT.wardY - 120, LAYOUT.fieldRight + 10, 120);

    this.ward = scene.add.graphics().setDepth(-7);

    // Arcane Shield: a pale wall of light just above the ward line.
    this.shield = scene.add.graphics().setDepth(-6).setVisible(false);
    this.shield.fillGradientStyle(PALETTE.shield, PALETTE.shield, PALETTE.shield, PALETTE.shield, 0, 0, 0.4, 0.4);
    this.shield.fillRect(0, LAYOUT.wardY - 36, LAYOUT.fieldRight + 10, 36);
    this.shield.fillStyle(PALETTE.shield, 0.95);
    this.shield.fillRect(0, LAYOUT.wardY - 2 * ART_SCALE, LAYOUT.fieldRight + 10, ART_SCALE);
    this.setStage(0);
  }

  /**
   * Weather through the windows, heavier as the chapter goes on:
   * 1 drifting magic motes · 2 rising bubbles · 3 rising embers · 4 rain and lightning.
   */
  private weather(chapter: number, intensity: number): void {
    const scene = this.scene;
    const left = LAYOUT.window.left;
    const right = LAYOUT.window.right;
    const k = 1 + intensity;
    if (chapter === 4) {
      for (let i = 0; i < 14 * k; i++) {
        const drop = scene.add
          .rectangle(Phaser.Math.Between(left, right + 60), Phaser.Math.Between(-40, LAYOUT.wardY - 10), ART_SCALE, 5 * ART_SCALE, 0xaab4d2, 0.35)
          .setAngle(15)
          .setDepth(-8.5);
        scene.tweens.add({
          targets: drop,
          y: { from: -20, to: LAYOUT.wardY },
          x: `-=${120}`,
          duration: Phaser.Math.Between(500, 800),
          delay: Phaser.Math.Between(0, 800),
          repeat: -1,
        });
      }
      // Lightning: more often as the storm builds.
      scene.time.addEvent({
        delay: Math.max(2200, 9000 - intensity * 1700),
        loop: true,
        callback: () => {
          if (Math.random() < 0.7) scene.cameras.main.flash(90, 200, 205, 235, false);
        },
      });
      return;
    }
    const kind = chapter === 2
      ? { color: 0xbef0e6, alt: 0x7ad2c0, rise: [80, 220], dur: [5000, 9000], n: 8 }
      : chapter === 3
        ? { color: 0xffb450, alt: 0xff7a30, rise: [100, 260], dur: [2500, 5000], n: 9 }
        : { color: PALETTE.magentaGlow, alt: PALETTE.teal, rise: [60, 160], dur: [4000, 9000], n: 6 };
    for (let i = 0; i < kind.n * k; i++) {
      const p = scene.add
        .rectangle(
          Phaser.Math.Between(left, right),
          Phaser.Math.Between(LAYOUT.spawnY + 60, LAYOUT.wardY),
          ART_SCALE,
          ART_SCALE,
          i % 3 === 0 ? kind.alt : kind.color,
          Phaser.Math.FloatBetween(0.25, 0.6),
        )
        .setDepth(-8.5);
      scene.tweens.add({
        targets: p,
        y: p.y - Phaser.Math.Between(kind.rise[0]!, kind.rise[1]!),
        x: p.x + Phaser.Math.Between(-20, 20),
        alpha: 0,
        duration: Phaser.Math.Between(kind.dur[0]!, kind.dur[1]!),
        delay: Phaser.Math.Between(0, 4000),
        repeat: -1,
      });
    }
  }

  /** Show or hide the Arcane Shield glow. */
  setShield(active: boolean): void {
    if (this.shield.visible === active) return;
    this.shieldPulse?.stop();
    this.shield.setVisible(active).setAlpha(1);
    if (active) {
      this.shieldPulse = this.scene.tweens.add({
        targets: this.shield,
        alpha: { from: 1, to: 0.55 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  /** A word stopped by the shield: a soft flare instead of a shake. */
  flashBlocked(): void {
    this.scene.cameras.main.flash(120, 154, 164, 184, false);
  }

  setStage(stage: InstabilityStage): void {
    this.stage = stage;
    const color = WARD_COLORS[stage];
    const y = LAYOUT.wardY;
    const w = LAYOUT.fieldRight + 10;
    this.ward.clear();
    this.ward.fillStyle(color, 0.12);
    this.ward.fillRect(0, y - 10, w, 10);
    this.ward.fillStyle(color, 0.8);
    for (let x = 0; x < w; x += 12) this.ward.fillRect(x, y, 8, ART_SCALE); // a dashed rune line

    this.pulse?.stop();
    this.ward.setAlpha(1);
    this.pulse = this.scene.tweens.add({
      targets: this.ward,
      alpha: { from: 1, to: 0.45 },
      duration: [1800, 1300, 900, 450, 300][stage],
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.scene.tweens.add({ targets: this.danger, alpha: [0, 0.25, 0.5, 0.85, 1][stage], duration: 400 });
    this.drawSeal(stage);
  }

  /** High health: untouched. Then: dimmer and flickering, then red-tinged and cracked, then collapsing. */
  private drawSeal(stage: InstabilityStage): void {
    const { x, y, radius } = LAYOUT.seal;
    const shade = this.sealShade;
    shade.clear();
    if (stage >= 1) {
      shade.fillStyle(PALETTE.midnight, [0, 0.2, 0.35, 0.45, 0.6][stage]);
      shade.fillCircle(x, y, radius + 20);
    }
    if (stage >= 3) {
      shade.fillStyle(PALETTE.crimson, stage === 4 ? 0.22 : 0.14);
      shade.fillCircle(x, y, radius);
    }
    const cracks = this.sealCracks;
    cracks.clear();
    const shown = [0, 0, 1, 3, 5][stage];
    for (let i = 0; i < shown; i++) {
      const pts = CRACKS[i]!;
      cracks.lineStyle(ART_SCALE * 2, PALETTE.midnight, 0.9);
      cracks.strokePoints(pts.map(([dx, dy]) => ({ x: x + dx, y: y + dy })));
      cracks.lineStyle(ART_SCALE, stage >= 3 ? PALETTE.crimson : PALETTE.magentaGlow, 0.8);
      cracks.strokePoints(pts.map(([dx, dy]) => ({ x: x + dx + 1, y: y + dy + 1 })));
    }
    this.flicker?.stop();
    shade.setAlpha(1);
    if (stage >= 2) {
      this.flicker = this.scene.tweens.add({
        targets: shade,
        alpha: { from: 1, to: 0.6 },
        duration: stage >= 3 ? 120 : 260,
        yoyo: true,
        repeat: -1,
        repeatDelay: stage >= 3 ? 300 : 900,
        ease: 'Stepped',
      });
    }
  }

  /** Brief flare when a word breaks through. */
  flashMiss(): void {
    this.scene.cameras.main.shake(180, 0.004 + this.stage * 0.0015);
    this.scene.cameras.main.flash(120, 192, 57, 43, false);
  }
}
