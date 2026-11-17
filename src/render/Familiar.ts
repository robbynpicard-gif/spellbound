import Phaser from 'phaser';
import { ART, ART_SCALE, LAYOUT } from './layout';

/**
 * A familiar (cosmetic, D-043): a small companion sitting by the wizard that
 * bobs while idle, hops on every capture, cheers at a new multiplier and
 * flinches when a word breaks through.
 */
export class Familiar {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly baseY: number;
  private readonly frame: number;
  private hopTween: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    row: number,
  ) {
    this.frame = row * 2;
    const x = LAYOUT.wizard.x + 176;
    this.baseY = LAYOUT.wizard.y + 214;
    this.sprite = scene.add.sprite(x, this.baseY, ART.familiars, this.frame).setOrigin(0.5, 1).setScale(ART_SCALE).setDepth(-8.3);
    scene.tweens.add({ targets: this.sprite, scaleY: ART_SCALE * 0.94, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  /** A word captured: a little hop. */
  hop(height = 10): void {
    const s = this.sprite;
    this.hopTween?.stop();
    s.y = this.baseY;
    this.hopTween = this.scene.tweens.add({ targets: s, y: this.baseY - height, duration: 110, yoyo: true, ease: 'Quad.Out' });
  }

  /** A new multiplier tier or a wizard power: a big hop with the cheering frame. */
  cheer(): void {
    this.sprite.setFrame(this.frame + 1);
    this.hop(22);
    this.scene.time.delayedCall(700, () => this.sprite.active && this.sprite.setFrame(this.frame));
  }

  /** A word broke through: a flinch. */
  flinch(): void {
    const s = this.sprite;
    const x = s.x;
    this.scene.tweens.add({ targets: s, x: { from: x - 4, to: x + 4 }, duration: 50, yoyo: true, repeat: 2, onComplete: () => s.setX(x) });
  }
}
