import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import { STREAK_MILESTONES } from '../gameplay/ScoringSystem';
import { STREAK_COLORS } from '../ui/GameHUD';
import { CONFETTI } from './Celebrations';
import { SPARK_TEXTURE } from './Effects';
import { hex, LAYOUT } from './layout';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const text = (size: number, color: number, family: string = FONTS.heading): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: family,
  fontSize: `${size}px`,
  fontStyle: family === FONTS.heading ? 'normal' : '700',
  color: hex(color),
  stroke: hex(PALETTE.midnight),
  strokeThickness: Math.max(4, Math.round(size / 7)),
  align: 'center',
});

/**
 * How the Clean Streak (D-046) shows itself. Only presentation: it reacts to
 * engine events and never touches the score. Severity grows from a quiet ink
 * blot (corrected typo) to a torn page (wrong Enter) to the whole streak
 * shattering (a word through the ward). Milestones are illuminated, grander
 * each time.
 */
export class StreakFeedback {
  private readonly gold: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ink: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    /** The Clean Streak panel in the status bar. */
    private readonly anchor: { x: number; y: number },
  ) {
    this.gold = scene.add
      .particles(0, 0, SPARK_TEXTURE, {
        speed: { min: 80, max: 420 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 500, max: 1200 },
        scale: { start: 1.3, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffe9a0, PALETTE.gold, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(38);
    this.ink = scene.add
      .particles(0, 0, scene.textures.exists(CONFETTI) ? CONFETTI : SPARK_TEXTURE, {
        speed: { min: 60, max: 260 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 400, max: 900 },
        gravityY: 500,
        scale: { min: 1, max: 2.2 },
        alpha: { start: 1, end: 0 },
        tint: [0x1a1020, 0x2a1830, 0x5a1a2a],
        emitting: false,
      })
      .setDepth(38);
  }

  /** A new milestone: an illuminated proclamation, grander for each tier. */
  milestone(tier: number, multiplier: number, delayMs = 0): void {
    if (delayMs > 0) {
      this.scene.time.delayedCall(delayMs, () => this.milestone(tier, multiplier));
      return;
    }
    const scene = this.scene;
    const color = STREAK_COLORS[Math.min(tier, STREAK_COLORS.length - 1)]!;
    const grand = tier / (STREAK_MILESTONES.length - 1); // 0..1
    const cx = LAYOUT.width / 2;
    const cy = LAYOUT.spawnY + 300;
    const title = scene.add
      .text(cx, cy, `CLEAN STREAK ${ROMAN[tier] ?? tier}`, text(34 + Math.round(grand * 26), color))
      .setOrigin(0.5)
      .setDepth(39)
      .setScale(1.8)
      .setAlpha(0);
    const sub = scene.add
      .text(cx, cy + 44 + grand * 14, `×${multiplier.toFixed(2)} on every word`, text(20, PALETTE.parchment, FONTS.gameplay))
      .setOrigin(0.5)
      .setDepth(39)
      .setAlpha(0);
    scene.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    scene.tweens.add({ targets: sub, alpha: 1, delay: 150, duration: 200 });
    scene.tweens.add({
      targets: [title, sub],
      alpha: 0,
      y: '-=24',
      delay: 900 + grand * 700,
      duration: 400,
      onComplete: () => {
        title.destroy();
        sub.destroy();
      },
    });
    this.gold.explode(30 + tier * 25, cx, cy);
    this.gold.explode(12 + tier * 6, this.anchor.x, this.anchor.y + 20);
    if (tier >= 4) scene.cameras.main.flash(160, 255, 230, 160, false);
    if (tier >= 5) scene.cameras.main.shake(200, 0.004);
  }

  /** A corrected typo: a small ink blot on the streak, and the drop shown plainly. */
  typo(fromMultiplier: number, toMultiplier: number, lost: number): void {
    const { x, y } = this.anchor;
    this.ink.explode(10, x, y + 8);
    const label = fromMultiplier !== toMultiplier ? `×${fromMultiplier.toFixed(2)} → ×${toMultiplier.toFixed(2)}` : `streak −${lost}`;
    this.float(x, y - 10, label, 0xe08a60, 18);
  }

  /** A wrong Enter: the page tears; the streak is gone. */
  lost(previous: number): void {
    const r = LAYOUT.roll;
    this.ink.explode(26, this.anchor.x, this.anchor.y + 8);
    this.ink.explode(18, r.x + r.width / 2, r.y + 10);
    this.float(r.x + r.width / 2, r.y - 26, `STREAK LOST (${previous})`, PALETTE.crimson, 26);
  }

  /** A word through the ward: the streak shatters, loud and central. */
  broken(previous: number): void {
    const scene = this.scene;
    const cx = LAYOUT.width / 2;
    const cy = LAYOUT.wardY - 70;
    const t = scene.add.text(cx, cy, 'STREAK BROKEN', text(48, PALETTE.crimson)).setOrigin(0.5).setDepth(39).setScale(0.6);
    const sub = scene.add
      .text(cx, cy + 42, `${previous} clean words`, text(18, PALETTE.parchment, FONTS.gameplay))
      .setOrigin(0.5)
      .setDepth(39);
    scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.Out' });
    scene.tweens.add({
      targets: [t, sub],
      alpha: 0,
      y: '+=30',
      delay: 800,
      duration: 450,
      ease: 'Cubic.In',
      onComplete: () => {
        t.destroy();
        sub.destroy();
      },
    });
    this.ink.explode(50, cx, cy);
    this.ink.explode(20, this.anchor.x, this.anchor.y + 8);
  }

  private float(x: number, y: number, label: string, color: number, size: number): void {
    const t = this.scene.add.text(x, y, label, text(size, color, FONTS.gameplay)).setOrigin(0.5).setDepth(39);
    this.scene.tweens.add({ targets: t, y: y - 36, alpha: 0, delay: 500, duration: 600, onComplete: () => t.destroy() });
  }
}
