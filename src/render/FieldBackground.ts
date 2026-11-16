import Phaser from 'phaser';
import { PALETTE } from '../core/GameConfig';
import type { InstabilityStage } from '../gameplay/InstabilityManager';
import { LAYOUT } from './layout';

/** Ward-line colour per instability stage: calm arcane → gold → ember → crimson. */
const WARD_COLORS: Record<InstabilityStage, number> = {
  0: PALETTE.arcane,
  1: PALETTE.gold,
  2: PALETTE.fire,
  3: PALETTE.crimson,
  4: PALETTE.crimson,
};

/**
 * The playing-field backdrop: a night-sky gradient, faint drifting runes and
 * the glowing ward line the words must not reach. Reacts to instability with
 * colour, pulse speed and a crimson edge glow — never covering the words.
 *
 * Temporary art: drawn with shapes until original illustrated assets exist.
 */
export class FieldBackground {
  private readonly ward: Phaser.GameObjects.Graphics;
  private readonly danger: Phaser.GameObjects.Graphics;
  private readonly shield: Phaser.GameObjects.Graphics;
  private shieldPulse?: Phaser.Tweens.Tween;
  private pulse?: Phaser.Tweens.Tween;
  private stage: InstabilityStage = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = LAYOUT;

    const sky = scene.add.graphics().setDepth(-10);
    sky.fillGradientStyle(PALETTE.midnight, PALETTE.midnight, PALETTE.charcoal, PALETTE.charcoal, 1);
    sky.fillRect(0, 0, width, height);

    for (let i = 0; i < 30; i++) {
      const mote = scene.add
        .circle(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(LAYOUT.spawnY, LAYOUT.wardY),
          Phaser.Math.FloatBetween(1, 2.2),
          i % 3 === 0 ? PALETTE.arcane : PALETTE.gold,
          Phaser.Math.FloatBetween(0.1, 0.35),
        )
        .setDepth(-9);
      scene.tweens.add({
        targets: mote,
        y: mote.y - Phaser.Math.Between(40, 120),
        alpha: 0,
        duration: Phaser.Math.Between(5000, 10000),
        delay: Phaser.Math.Between(0, 5000),
        repeat: -1,
      });
    }

    this.danger = scene.add.graphics().setDepth(-8).setAlpha(0);
    this.danger.fillGradientStyle(PALETTE.crimson, PALETTE.crimson, PALETTE.crimson, PALETTE.crimson, 0, 0, 0.35, 0.35);
    this.danger.fillRect(0, LAYOUT.wardY - 140, width, 140);

    this.ward = scene.add.graphics().setDepth(-7);

    // Arcane Shield: a pale wall of light just above the ward line.
    this.shield = scene.add.graphics().setDepth(-6).setVisible(false);
    this.shield.fillGradientStyle(PALETTE.shield, PALETTE.shield, PALETTE.shield, PALETTE.shield, 0, 0, 0.4, 0.4);
    this.shield.fillRect(0, LAYOUT.wardY - 36, width, 36);
    this.shield.lineStyle(3, PALETTE.shield, 0.95);
    this.shield.lineBetween(0, LAYOUT.wardY - 2, width, LAYOUT.wardY - 2);
    this.setStage(0);
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
    this.scene.cameras.main.flash(120, 169, 184, 255, false);
  }

  setStage(stage: InstabilityStage): void {
    this.stage = stage;
    const color = WARD_COLORS[stage];
    const y = LAYOUT.wardY;
    this.ward.clear();
    this.ward.fillStyle(color, 0.12);
    this.ward.fillRect(0, y - 10, LAYOUT.width, 20);
    this.ward.lineStyle(2, color, 0.9);
    this.ward.lineBetween(0, y, LAYOUT.width, y);

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

    this.scene.tweens.add({
      targets: this.danger,
      alpha: [0, 0.25, 0.5, 0.85, 1][stage],
      duration: 400,
    });
  }

  /** Brief flare when a word breaks through. */
  flashMiss(): void {
    this.scene.cameras.main.shake(180, 0.004 + this.stage * 0.0015);
    this.scene.cameras.main.flash(120, 192, 57, 43, false);
  }
}
