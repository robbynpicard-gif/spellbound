import Phaser from 'phaser';
import { PALETTE } from '../core/GameConfig';
import type { InstabilityStage } from '../gameplay/InstabilityManager';
import { ART, ART_SCALE, LAYOUT } from './layout';

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
 * The pixel art comes from public/assets (tools/pixelart); the instability
 * glow, ward colour and shield are drawn over it.
 */
export class FieldBackground {
  private readonly ward: Phaser.GameObjects.Graphics;
  private readonly danger: Phaser.GameObjects.Graphics;
  private readonly shield: Phaser.GameObjects.Graphics;
  private shieldPulse?: Phaser.Tweens.Tween;
  private pulse?: Phaser.Tweens.Tween;
  private stage: InstabilityStage = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    chapter = 1,
  ) {
    const { width } = LAYOUT;

    // The chapter's pixel-art backdrop: scene, ward line, the wizard's study and the iron HUD plate.
    const key = ART.chapter(chapter);
    if (scene.textures.exists(key)) scene.add.image(0, 0, key).setOrigin(0).setScale(ART_SCALE).setDepth(-10);
    else scene.add.rectangle(0, 0, width, LAYOUT.height, PALETTE.midnight).setOrigin(0).setDepth(-10);

    // Dust drifting through the field, one art-pixel each.
    for (let i = 0; i < 26; i++) {
      const mote = scene.add
        .rectangle(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(LAYOUT.spawnY, LAYOUT.wardY),
          ART_SCALE / 2,
          ART_SCALE / 2,
          i % 3 === 0 ? PALETTE.parchment : PALETTE.gold,
          Phaser.Math.FloatBetween(0.1, 0.3),
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
    this.ward.fillStyle(color, 0.1);
    this.ward.fillRect(0, y - 12, LAYOUT.width, 12);
    this.ward.fillStyle(color, 0.75);
    this.ward.fillRect(0, y, LAYOUT.width, ART_SCALE);

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
