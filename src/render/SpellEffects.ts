import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { SpellId } from '../gameplay/SpellManager';
import { SPELLS } from '../spells/SpellRegistry';
import { SPARK_TEXTURE } from './Effects';
import { hex, LAYOUT, SPELL_COLORS } from './layout';

/**
 * Screen-wide spell visuals. Overlays are translucent and sit behind the
 * words so text stays readable (GDD §3 readability).
 *
 * Temporary art: built from shapes and particles until original assets exist.
 */
export class SpellEffects {
  private readonly frost: Phaser.GameObjects.Rectangle;
  private readonly temporal: Phaser.GameObjects.Rectangle;
  private readonly fire: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly wind: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly spark: Phaser.GameObjects.Particles.ParticleEmitter;
  private temporalPulse?: Phaser.Tweens.Tween;

  constructor(private readonly scene: Phaser.Scene) {
    const fieldH = LAYOUT.wardY - LAYOUT.hudHeight;
    const cy = LAYOUT.hudHeight + fieldH / 2;
    this.frost = scene.add
      .rectangle(LAYOUT.width / 2, cy, LAYOUT.width, fieldH, PALETTE.ice, 0.13)
      .setDepth(-6)
      .setVisible(false);
    this.temporal = scene.add
      .rectangle(LAYOUT.width / 2, cy, LAYOUT.width, fieldH, PALETTE.arcane, 0.1)
      .setDepth(-6)
      .setVisible(false);

    this.fire = scene.add
      .particles(0, 0, SPARK_TEXTURE, {
        speed: { min: 80, max: 320 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 400, max: 900 },
        scale: { start: 1.3, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [PALETTE.fire, PALETTE.gold, PALETTE.crimson],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(22);

    this.wind = scene.add
      .particles(0, 0, SPARK_TEXTURE, {
        x: -20,
        y: { min: LAYOUT.hudHeight, max: LAYOUT.wardY },
        speedX: { min: 900, max: 1500 },
        speedY: { min: -40, max: 40 },
        lifespan: 1200,
        scaleX: { start: 2.5, end: 0.5 },
        scaleY: 0.5,
        alpha: { start: 0.9, end: 0 },
        tint: [PALETTE.wind, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(22);

    // Shared burst for Chain Lightning, Transmutation and Harvest (tinted per use).
    this.spark = scene.add
      .particles(0, 0, SPARK_TEXTURE, {
        speed: { min: 60, max: 260 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 300, max: 700 },
        scale: { start: 1.1, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(22);
  }

  /** A word engulfed by Incineration. */
  burnWord(x: number, y: number): void {
    this.fire.explode(28, x, y);
  }

  /** Chain Lightning: jagged bolts joining the struck words, in order. */
  lightning(points: readonly { x: number; y: number }[]): void {
    if (points.length === 0) return;
    const g = this.scene.add.graphics().setDepth(23);
    const bolt = (ax: number, ay: number, bx: number, by: number, width: number, alpha: number) => {
      g.lineStyle(width, PALETTE.lightning, alpha);
      g.beginPath();
      g.moveTo(ax, ay);
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        g.lineTo(ax + (bx - ax) * t + Phaser.Math.Between(-14, 14), ay + (by - ay) * t + Phaser.Math.Between(-14, 14));
      }
      g.lineTo(bx, by);
      g.strokePath();
    };
    const first = points[0]!;
    bolt(first.x, LAYOUT.hudHeight, first.x, first.y, 4, 0.95);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      bolt(a.x, a.y, b.x, b.y, 3, 0.9);
    }
    for (const p of points) this.burst(p.x, p.y, PALETTE.lightning, 22);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 450, ease: 'Cubic.In', onComplete: () => g.destroy() });
  }

  /** A coloured burst of sparks at a point. */
  burst(x: number, y: number, color: number, count = 18): void {
    this.spark.setParticleTint(color);
    this.spark.explode(count, x, y);
  }

  cast(spell: SpellId): void {
    this.announce(spell);
    this.glow(SPELL_COLORS[spell]);
    switch (spell) {
      case 'fire':
        break;
      case 'ice':
        this.frost.setVisible(true).setAlpha(0);
        this.scene.tweens.add({ targets: this.frost, alpha: 1, duration: 250 });
        break;
      case 'slow':
        this.temporal.setVisible(true).setAlpha(0);
        this.temporalPulse?.stop();
        this.temporalPulse = this.scene.tweens.add({
          targets: this.temporal,
          alpha: { from: 1, to: 0.45 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
        break;
      case 'wind':
        this.wind.explode(160);
        break;
      default:
        // Arcane Shield, Chain Lightning, Transmutation and Harvest draw their
        // effects where they act (see GameScene).
        break;
    }
  }

  /** Temporal Distortion stacks changed: deeper stacks make the overlay stronger. */
  setSlowStacks(stacks: number): void {
    if (stacks > 0) this.temporal.setFillStyle(PALETTE.arcane, Math.min(0.28, 0.1 * stacks));
  }

  /**
   * A soft, brief colour wash over the field. Deliberately gentle (max 25%
   * opacity, fades over 0.5 s) instead of a full-screen flash, for comfort
   * and photosensitivity.
   */
  private glow(color: number): void {
    const fieldH = LAYOUT.wardY - LAYOUT.hudHeight;
    const wash = this.scene.add
      .rectangle(LAYOUT.width / 2, LAYOUT.hudHeight + fieldH / 2, LAYOUT.width, fieldH, color, 1)
      .setDepth(-5)
      .setAlpha(0.25);
    this.scene.tweens.add({ targets: wash, alpha: 0, duration: 500, ease: 'Cubic.Out', onComplete: () => wash.destroy() });
  }

  ended(spell: SpellId): void {
    const overlay = spell === 'ice' ? this.frost : spell === 'slow' ? this.temporal : null;
    if (!overlay) return;
    if (spell === 'slow') this.temporalPulse?.stop();
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 300,
      onComplete: () => overlay.setVisible(false),
    });
  }

  /** Spell name rises briefly in the middle of the field. */
  private announce(spell: SpellId): void {
    const text = this.scene.add
      .text(LAYOUT.width / 2, LAYOUT.spawnY + 230, SPELLS[spell].name, {
        fontFamily: FONTS.heading,
        fontSize: '54px',
        color: hex(SPELL_COLORS[spell]),
        stroke: hex(PALETTE.midnight),
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: text,
      alpha: { from: 0, to: 0.9 },
      y: text.y - 30,
      duration: 300,
      yoyo: true,
      hold: 300,
      onComplete: () => text.destroy(),
    });
  }
}
