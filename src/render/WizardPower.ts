import Phaser from 'phaser';
import { FONTS, PALETTE, SIMULATION_STEP_MS } from '../core/GameConfig';
import { WIZARDS, type WizardId } from '../gameplay/Wizards';
import { SPARK_TEXTURE } from './Effects';
import { hex, LAYOUT } from './layout';

/**
 * The wizard's power on screen (decisions.md D-042): a proclamation when a
 * sigil is captured, a gauge above the wizard while the power lasts, and a
 * screen-wide wash in the wizard's colour.
 */
export class WizardPower {
  private readonly color: number;
  private readonly gauge: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly wash: Phaser.GameObjects.Rectangle;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private total = 0;
  private left = 0;
  /** Kindle counts captures, not time. */
  private counted = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly wizard: WizardId,
  ) {
    this.color = WIZARDS[wizard].color;
    const gx = LAYOUT.wizard.x + 96;
    const gy = LAYOUT.wizard.y - 30;
    this.label = scene.add
      .text(gx, gy - 16, WIZARDS[wizard].power.name.toUpperCase(), {
        fontFamily: FONTS.gameplay,
        fontSize: '16px',
        fontStyle: '700',
        color: hex(this.color),
        stroke: hex(PALETTE.midnight),
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(33)
      .setVisible(false);
    this.gauge = scene.add.graphics().setDepth(33);
    const fieldH = LAYOUT.wardY - LAYOUT.hudHeight;
    this.wash = scene.add
      .rectangle(LAYOUT.width / 2, LAYOUT.hudHeight + fieldH / 2, LAYOUT.width, fieldH, this.color, 0.08)
      .setDepth(-6)
      .setVisible(false);
    this.sparks = scene.add
      .particles(0, 0, SPARK_TEXTURE, {
        speed: { min: 80, max: 360 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 400, max: 1000 },
        scale: { start: 1.4, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [this.color, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(24);
  }

  /** The sigil was captured at (x, y): proclaim the power. */
  fired(x: number, y: number): void {
    const def = WIZARDS[this.wizard];
    this.sparks.explode(60, x, y);
    this.sparks.explode(40, LAYOUT.wizard.x + 96, LAYOUT.wizard.y + 80);
    this.scene.cameras.main.flash(180, (this.color >> 16) & 255, (this.color >> 8) & 255, this.color & 255, false);
    const cx = LAYOUT.width / 2;
    const cy = LAYOUT.spawnY + 230;
    const title = this.scene.add
      .text(cx, cy, def.power.name.toUpperCase(), {
        fontFamily: FONTS.heading,
        fontSize: '64px',
        color: hex(this.color),
        stroke: hex(PALETTE.midnight),
        strokeThickness: 10,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(41)
      .setScale(0.4);
    const sub = this.scene.add
      .text(cx, cy + 58, def.name, {
        fontFamily: FONTS.gameplay,
        fontSize: '22px',
        fontStyle: '700',
        color: hex(PALETTE.parchment),
        stroke: hex(PALETTE.midnight),
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(41)
      .setAlpha(0);
    this.scene.tweens.add({ targets: title, scale: 1, duration: 260, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: sub, alpha: 1, duration: 200, delay: 120 });
    this.scene.tweens.add({
      targets: [title, sub],
      alpha: 0,
      y: '-=30',
      delay: 1000,
      duration: 400,
      onComplete: () => {
        title.destroy();
        sub.destroy();
      },
    });
  }

  /** Engine report: the power started (ticks or Kindle charges left) or ended. */
  changed(active: boolean, left: number): void {
    if (!active) {
      this.left = 0;
      this.wash.setVisible(false);
      this.label.setVisible(false);
      this.gauge.clear();
      return;
    }
    this.counted = this.wizard === 'pyromancer';
    this.total = left;
    this.left = left;
    this.wash.setVisible(true).setAlpha(1);
    this.label.setVisible(true);
    this.draw();
  }

  /** Kindle: one charge used. */
  spend(): void {
    if (this.counted && this.left > 0) {
      this.left--;
      this.draw();
    }
  }

  /** Called every frame. */
  update(deltaMs: number): void {
    if (this.left <= 0 || this.counted) return;
    this.left = Math.max(0, this.left - deltaMs / SIMULATION_STEP_MS);
    this.draw();
  }

  /** Rewind: a sweep of the wizard's colour rushing up the field. */
  rewind(): void {
    const band = this.scene.add
      .rectangle(LAYOUT.width / 2, LAYOUT.wardY, LAYOUT.width, 80, this.color, 0.35)
      .setDepth(-5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({
      targets: band,
      y: LAYOUT.hudHeight,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.Out',
      onComplete: () => band.destroy(),
    });
    this.scene.cameras.main.shake(160, 0.004);
  }

  private draw(): void {
    const g = this.gauge;
    g.clear();
    if (this.left <= 0 || this.total <= 0) return;
    const w = 150;
    const x = LAYOUT.wizard.x + 96 - w / 2;
    const y = LAYOUT.wizard.y - 30;
    g.fillStyle(PALETTE.midnight, 0.85);
    g.fillRect(x - 3, y - 3, w + 6, 14);
    g.fillStyle(this.color, 1);
    g.fillRect(x, y, Math.round((w * this.left) / this.total), 8);
  }
}
