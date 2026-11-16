import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import { hex } from './layout';

/** Texture key for the soft particle, generated in BootScene. */
export const SPARK_TEXTURE = 'spark';

/** One-shot visual effects: word destruction bursts and floating score text. */
export class Effects {
  private readonly goldBurst: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly arcaneBurst: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly crimsonBurst: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private readonly scene: Phaser.Scene) {
    const base: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      speed: { min: 60, max: 280 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 350, max: 750 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    };
    this.goldBurst = scene.add.particles(0, 0, SPARK_TEXTURE, { ...base, tint: PALETTE.gold }).setDepth(20);
    this.arcaneBurst = scene.add
      .particles(0, 0, SPARK_TEXTURE, { ...base, tint: PALETTE.arcane, speed: { min: 30, max: 160 } })
      .setDepth(19);
    this.crimsonBurst = scene.add
      .particles(0, 0, SPARK_TEXTURE, { ...base, tint: PALETTE.crimson, angle: { min: 200, max: 340 } })
      .setDepth(20);
  }

  wordDestroyed(x: number, y: number, length: number, points: number): void {
    this.goldBurst.explode(10 + length * 3, x, y);
    this.arcaneBurst.explode(8 + length * 2, x, y);

    const label = this.scene.add
      .text(x, y, `+${points}`, {
        fontFamily: FONTS.gameplay,
        fontSize: '22px',
        fontStyle: '700',
        color: hex(PALETTE.gold),
        stroke: hex(PALETTE.midnight),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.scene.tweens.add({
      targets: label,
      y: y - 50,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  wordBrokeThrough(x: number, y: number): void {
    this.crimsonBurst.explode(24, x, y);
  }
}
