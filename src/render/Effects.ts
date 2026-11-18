import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import { hex } from './layout';

/** Texture key for the soft particle, generated in BootScene. */
export const SPARK_TEXTURE = 'spark';

/** Capture flourishes (cosmetic, D-043): how a captured word bursts. */
interface FlourishStyle {
  texture: string;
  tints: number[];
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
  /** Particles per letter. */
  perLetter: number;
}

const CONFETTI_TEXTURE = 'confetti';

const FLOURISHES: Record<string, FlourishStyle> = {
  stars: { texture: SPARK_TEXTURE, tints: [0xffffff, 0xfff0a0, 0xa0e0ff], perLetter: 4, config: { speed: { min: 40, max: 200 }, lifespan: { min: 600, max: 1100 }, scale: { start: 1.4, end: 0 } } },
  confetti: { texture: CONFETTI_TEXTURE, tints: [0xffd060, 0xff60c8, 0x5ad0c0, 0xa0a0ff, 0xffffff], perLetter: 5, config: { speed: { min: 120, max: 360 }, angle: { min: 200, max: 340 }, gravityY: 600, rotate: { start: 0, end: 540 }, lifespan: { min: 700, max: 1200 }, scale: { min: 1, max: 2 } } },
  dust: { texture: SPARK_TEXTURE, tints: [0xc8c0b0, 0x8a8478], perLetter: 5, config: { speed: { min: 10, max: 70 }, lifespan: { min: 900, max: 1500 }, scale: { start: 1.6, end: 0 }, alpha: { start: 0.6, end: 0 } } },
  gears: { texture: CONFETTI_TEXTURE, tints: [0xc8902a, 0xffe080, 0x7a5018], perLetter: 3, config: { speed: { min: 80, max: 240 }, gravityY: 400, rotate: { start: 0, end: 720 }, lifespan: { min: 700, max: 1100 }, scale: { min: 1.5, max: 2.5 } } },
  sand: { texture: SPARK_TEXTURE, tints: [0xe6c890, 0xc8a060], perLetter: 6, config: { speed: { min: 20, max: 90 }, angle: { min: 60, max: 120 }, gravityY: 500, lifespan: { min: 700, max: 1100 }, scale: { start: 0.6, end: 0.3 } } },
  embers: { texture: SPARK_TEXTURE, tints: [0xff7a30, 0xffd060, 0xe0402a], perLetter: 5, config: { speed: { min: 40, max: 160 }, angle: { min: 230, max: 310 }, gravityY: -120, lifespan: { min: 700, max: 1300 }, scale: { start: 1, end: 0 } } },
  fireworks: { texture: SPARK_TEXTURE, tints: [0xff5a5a, 0xffd060, 0x60e0ff, 0xff60e0, 0xffffff], perLetter: 6, config: { speed: { min: 220, max: 420 }, gravityY: 300, lifespan: { min: 500, max: 900 }, scale: { start: 1.1, end: 0 } } },
  paper: { texture: CONFETTI_TEXTURE, tints: [0xf0e8d8, 0xd8ccb8], perLetter: 3, config: { speed: { min: 60, max: 200 }, angle: { min: 200, max: 340 }, gravityY: 60, rotate: { start: 0, end: 360 }, lifespan: { min: 1000, max: 1600 }, scale: { min: 1.5, max: 2.5 } } },
  compass: { texture: SPARK_TEXTURE, tints: [0x60d0ff, 0xffffff], perLetter: 3, config: { speed: 260, angle: { steps: 8, start: 0, end: 360 }, lifespan: 500, scale: { start: 1.2, end: 0 } } },
  ink: { texture: SPARK_TEXTURE, tints: [0x2a1a3a, 0x5a1a5a, 0xff5ad0], perLetter: 4, config: { speed: { min: 60, max: 260 }, gravityY: 500, lifespan: { min: 400, max: 800 }, scale: { start: 1.8, end: 0.4 }, blendMode: Phaser.BlendModes.NORMAL } },
};

/** One-shot visual effects: word destruction bursts and floating score text. */
export class Effects {
  private readonly flourishEmitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  /** Cosmetic capture flourish ('sparks' = the classic burst). */
  flourish = 'sparks';
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

  wordDestroyed(x: number, y: number, length: number, points: number, multiplier = 1, text = '', showPoints = true): void {
    const more = Math.min(4, Math.log2(multiplier) + 1);
    const style = FLOURISHES[this.flourish];
    if (this.flourish === 'letters' && text) this.letters(x, y, text);
    else if (style) this.emitter(this.flourish, style).explode(Math.round((6 + length * style.perLetter) * more), x, y);
    if (!style || this.flourish === 'letters') {
      this.goldBurst.explode(Math.round((10 + length * 3) * more * (this.flourish === 'letters' ? 0.4 : 1)), x, y);
      this.arcaneBurst.explode(Math.round((8 + length * 2) * more * (this.flourish === 'letters' ? 0.4 : 1)), x, y);
    } else this.goldBurst.explode(Math.round(4 * more), x, y);
    if (!showPoints) return;
    const label = multiplier > 1 ? `+${points.toLocaleString()}  ×${multiplier}` : `+${points}`;
    this.floatText(x, y, label, PALETTE.gold, 22 + Math.round(more * 3));
  }

  /** Short text that rises and fades (points, "+1 Fire", …). */
  floatText(x: number, y: number, text: string, color: number, size = 22): void {
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: FONTS.gameplay,
        fontSize: `${size}px`,
        fontStyle: '700',
        color: hex(color),
        stroke: hex(PALETTE.midnight),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.scene.tweens.add({
      targets: label,
      y: y - 50,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  private emitter(id: string, style: FlourishStyle): Phaser.GameObjects.Particles.ParticleEmitter {
    let e = this.flourishEmitters.get(id);
    if (!e) {
      const texture = this.scene.textures.exists(style.texture) ? style.texture : SPARK_TEXTURE;
      e = this.scene.add
        .particles(0, 0, texture, {
          speed: { min: 60, max: 280 },
          angle: { min: 0, max: 360 },
          lifespan: { min: 350, max: 750 },
          scale: { start: 0.9, end: 0 },
          alpha: { start: 1, end: 0 },
          blendMode: Phaser.BlendModes.ADD,
          ...style.config,
          tint: style.tints,
          emitting: false,
        })
        .setDepth(20);
      this.flourishEmitters.set(id, e);
    }
    return e;
  }

  /** "Loose Letters": the captured word's letters fly apart. */
  private letters(x: number, y: number, text: string): void {
    const chars = [...text].slice(0, 12);
    chars.forEach((ch, i) => {
      const t = this.scene.add
        .text(x + (i - chars.length / 2) * 14, y, ch, {
          fontFamily: FONTS.gameplay,
          fontSize: '24px',
          fontStyle: '700',
          color: hex(i % 2 ? PALETTE.parchment : PALETTE.gold),
          stroke: hex(PALETTE.midnight),
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(21);
      const angle = Phaser.Math.FloatBetween(-2.6, -0.5);
      const dist = Phaser.Math.Between(50, 120);
      this.scene.tweens.add({
        targets: t,
        x: t.x + Math.cos(angle) * dist,
        y: t.y + Math.sin(angle) * dist + 40,
        angle: Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: 800,
        ease: 'Quad.Out',
        onComplete: () => t.destroy(),
      });
    });
  }

  wordBrokeThrough(x: number, y: number): void {
    this.crimsonBurst.explode(24, x, y);
  }
}
