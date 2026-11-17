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
  private readonly flames: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private iceSpikes: Phaser.GameObjects.Graphics | null = null;
  private clock: Phaser.GameObjects.Container | null = null;

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

    // Incineration's wall of fire, rising from the ward line.
    this.flames = scene.add
      .particles(0, 0, SPARK_TEXTURE, {
        speedY: { min: -720, max: -320 },
        speedX: { min: -40, max: 40 },
        lifespan: { min: 700, max: 1200 },
        scale: { start: 1.5, end: 0.1 },
        alpha: { start: 1, end: 0 },
        tint: [PALETTE.fire, PALETTE.gold, PALETTE.crimson, 0xffe0a0],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(22);
    // Frostbinding: snow drifting while everything is frozen.
    this.snow = scene.add
      .particles(0, 0, SPARK_TEXTURE, {
        x: { min: LAYOUT.fieldLeft, max: LAYOUT.fieldRight },
        y: LAYOUT.hudHeight,
        speedY: { min: 30, max: 80 },
        speedX: { min: -20, max: 20 },
        lifespan: 6000,
        scale: { min: 0.3, max: 0.8 },
        alpha: { start: 0.9, end: 0.2 },
        tint: [0xffffff, PALETTE.ice],
        frequency: 40,
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

  /**
   * A cast is a moment (D-045): the spell's name slams in, a shockwave rolls
   * out from the seal, the camera kicks, and the spell's own big effect plays.
   */
  cast(spell: SpellId): void {
    const color = SPELL_COLORS[spell];
    const big = spell === 'fire' || spell === 'harvest' || spell === 'wind';
    this.announce(spell);
    this.glow(color);
    this.shockwave(LAYOUT.seal.x, LAYOUT.seal.y, color, big ? 900 : 700);
    this.scene.cameras.main.shake(big ? 320 : 220, big ? 0.009 : 0.006);
    const cx = (LAYOUT.fieldLeft + LAYOUT.fieldRight) / 2;
    const fieldMid = (LAYOUT.hudHeight + LAYOUT.wardY) / 2;
    switch (spell) {
      case 'fire': {
        // a wall of flame sweeps up the field from the ward line
        const span = LAYOUT.fieldRight - LAYOUT.fieldLeft;
        for (let i = 0; i <= 24; i++) {
          this.scene.time.delayedCall(i * 18, () => {
            this.flames.explode(24, LAYOUT.fieldLeft + (span * i) / 24, LAYOUT.wardY);
            this.flames.explode(18, LAYOUT.fieldRight - (span * i) / 24, LAYOUT.wardY);
          });
        }
        this.tint(PALETTE.fire, 0.3, 900);
        break;
      }
      case 'ice': {
        this.frost.setVisible(true).setAlpha(0);
        this.scene.tweens.add({ targets: this.frost, alpha: 1, duration: 250 });
        this.growIce();
        this.snow.start();
        break;
      }
      case 'shock':
        this.scene.cameras.main.flash(140, 200, 230, 255, false);
        break;
      case 'slow': {
        this.temporal.setVisible(true).setAlpha(0);
        this.temporalPulse?.stop();
        this.temporalPulse = this.scene.tweens.add({ targets: this.temporal, alpha: { from: 1, to: 0.45 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        this.showClock(cx, fieldMid);
        break;
      }
      case 'barrier': {
        // a wall of light rises from the ward line
        const wall = this.scene.add.rectangle(cx, LAYOUT.wardY, LAYOUT.fieldRight - LAYOUT.fieldLeft, 140, PALETTE.shield, 0.45).setOrigin(0.5, 1).setDepth(21).setScale(1, 0);
        wall.setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: wall, scaleY: 1, duration: 260, ease: 'Back.Out' });
        this.scene.tweens.add({ targets: wall, alpha: 0, delay: 500, duration: 700, onComplete: () => wall.destroy() });
        for (let i = 0; i < 12; i++) this.burst(LAYOUT.fieldLeft + ((LAYOUT.fieldRight - LAYOUT.fieldLeft) * i) / 11, LAYOUT.wardY - 20, PALETTE.shield, 8);
        break;
      }
      case 'alter':
        for (let i = 0; i < 3; i++) this.scene.time.delayedCall(i * 140, () => this.shockwave(cx, fieldMid, PALETTE.transmute, 600, 6));
        break;
      case 'wind': {
        this.wind.explode(160);
        this.scene.time.delayedCall(220, () => this.wind.explode(120));
        const band = this.scene.add.rectangle(cx, LAYOUT.wardY, LAYOUT.fieldRight - LAYOUT.fieldLeft, 18, PALETTE.wind, 0.8).setDepth(21);
        band.setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: band, scaleY: 6, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => band.destroy() });
        break;
      }
      case 'harvest': {
        // a golden crescent sweeps across the field
        const g = this.scene.add.graphics().setDepth(22);
        g.setBlendMode(Phaser.BlendModes.ADD);
        const sweep = { t: 0 };
        this.scene.tweens.add({
          targets: sweep,
          t: 1,
          duration: 520,
          ease: 'Cubic.InOut',
          onUpdate: () => {
            g.clear();
            const x = LAYOUT.fieldLeft - 200 + (LAYOUT.fieldRight - LAYOUT.fieldLeft + 400) * sweep.t;
            g.lineStyle(26, PALETTE.harvest, 0.7);
            g.beginPath();
            g.arc(x, fieldMid, 260, -1.1, 1.1);
            g.strokePath();
            g.lineStyle(8, 0xfff0c0, 0.9);
            g.beginPath();
            g.arc(x, fieldMid, 260, -1.1, 1.1);
            g.strokePath();
          },
          onComplete: () => g.destroy(),
        });
        this.tint(PALETTE.harvest, 0.2, 700);
        break;
      }
    }
  }

  /** An expanding ring of the spell's colour. */
  private shockwave(x: number, y: number, color: number, radius: number, width = 10): void {
    const g = this.scene.add.graphics().setDepth(24);
    g.setBlendMode(Phaser.BlendModes.ADD);
    const ring = { r: 20, a: 0.9 };
    this.scene.tweens.add({
      targets: ring,
      r: radius,
      a: 0,
      duration: 650,
      ease: 'Cubic.Out',
      onUpdate: () => {
        g.clear();
        g.lineStyle(width, color, ring.a);
        g.strokeCircle(x, y, ring.r);
        g.lineStyle(width * 2.5, color, ring.a * 0.25);
        g.strokeCircle(x, y, ring.r * 0.94);
      },
      onComplete: () => g.destroy(),
    });
  }

  /** A colour wash over the field that fades out. */
  private tint(color: number, alpha: number, ms: number): void {
    const fieldH = LAYOUT.wardY - LAYOUT.hudHeight;
    const r = this.scene.add.rectangle(LAYOUT.width / 2, LAYOUT.hudHeight + fieldH / 2, LAYOUT.width, fieldH, color, alpha).setDepth(-5);
    r.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
  }

  /** Frostbinding: ice crystals grow in from the edges of the field. */
  private growIce(): void {
    this.iceSpikes?.destroy();
    const g = this.scene.add.graphics().setDepth(21).setAlpha(0);
    const l = LAYOUT.fieldLeft, r = LAYOUT.fieldRight, top = LAYOUT.hudHeight, bottom = LAYOUT.wardY;
    const spike = (x: number, y: number, dx: number, dy: number, len: number) => {
      const nx = -dy, ny = dx;
      g.fillStyle(0xe8f8ff, 0.75);
      g.fillTriangle(x + nx * 9, y + ny * 9, x - nx * 9, y - ny * 9, x + dx * len, y + dy * len);
      g.fillStyle(PALETTE.ice, 0.55);
      g.fillTriangle(x + nx * 4, y + ny * 4, x - nx * 4, y - ny * 4, x + dx * len * 0.7, y + dy * len * 0.7);
    };
    for (let y = top + 20; y < bottom; y += 38) {
      spike(l, y, 1, Phaser.Math.FloatBetween(-0.3, 0.3), Phaser.Math.Between(40, 90));
      spike(r, y + 19, -1, Phaser.Math.FloatBetween(-0.3, 0.3), Phaser.Math.Between(40, 90));
    }
    for (let x = l + 20; x < r; x += 46) spike(x, bottom, Phaser.Math.FloatBetween(-0.3, 0.3), -1, Phaser.Math.Between(30, 70));
    this.scene.tweens.add({ targets: g, alpha: 1, duration: 300 });
    this.iceSpikes = g;
  }

  /** Temporal Distortion: a great clock face over the field, its hands turning back. */
  private showClock(x: number, y: number): void {
    this.clock?.destroy();
    const face = this.scene.add.graphics();
    face.lineStyle(6, PALETTE.arcane, 0.6);
    face.strokeCircle(0, 0, 200);
    face.lineStyle(2, PALETTE.arcane, 0.4);
    face.strokeCircle(0, 0, 186);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      face.lineStyle(i % 3 === 0 ? 8 : 4, PALETTE.arcane, 0.6);
      face.lineBetween(Math.cos(a) * 168, Math.sin(a) * 168, Math.cos(a) * 192, Math.sin(a) * 192);
    }
    const hour = this.scene.add.rectangle(0, 0, 10, 110, PALETTE.arcane, 0.7).setOrigin(0.5, 1);
    const minute = this.scene.add.rectangle(0, 0, 6, 160, PALETTE.arcane, 0.7).setOrigin(0.5, 1);
    const c = this.scene.add.container(x, y, [face, hour, minute]).setDepth(-4).setAlpha(0).setScale(0.6);
    c.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 400, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: minute, angle: -720, duration: 8000, ease: 'Cubic.Out' });
    this.scene.tweens.add({ targets: hour, angle: -60, duration: 8000, ease: 'Cubic.Out' });
    this.clock = c;
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
    if (spell === 'ice') {
      this.snow.stop();
      const spikes = this.iceSpikes;
      this.iceSpikes = null;
      if (spikes) this.scene.tweens.add({ targets: spikes, alpha: 0, duration: 400, onComplete: () => spikes.destroy() });
    }
    if (spell === 'slow' && this.clock) {
      const clock = this.clock;
      this.clock = null;
      this.scene.tweens.add({ targets: clock, alpha: 0, scale: 1.2, duration: 400, onComplete: () => clock.destroy() });
    }
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

  /** The spell's name slams in over the field, then lifts away. */
  private announce(spell: SpellId): void {
    const text = this.scene.add
      .text(LAYOUT.width / 2, LAYOUT.spawnY + 220, SPELLS[spell].name.toUpperCase(), {
        fontFamily: FONTS.heading,
        fontSize: '68px',
        color: hex(SPELL_COLORS[spell]),
        stroke: hex(PALETTE.midnight),
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setScale(2.2)
      .setAlpha(0);
    this.scene.tweens.add({ targets: text, scale: 1, alpha: 1, duration: 200, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: text, y: text.y - 40, alpha: 0, delay: 650, duration: 450, ease: 'Cubic.In', onComplete: () => text.destroy() });
  }
}
