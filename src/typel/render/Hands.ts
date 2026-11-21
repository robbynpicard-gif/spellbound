/**
 * The player's hands at the typewriter (D-089). The full wizard character is
 * removed for now (owner, 2026-11-21); a pair of weathered, ringed wizard
 * hands in burgundy sleeves rests on the keys and reacts to play. Same
 * reaction interface the wizard had, so the scene drives it identically.
 * PLACEHOLDER art.
 */
import Phaser from 'phaser';

const SLEEVE = 0x3e1a1e;
const TRIM = 0x9c7a3c;

export class Hands {
  private readonly hand: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private readonly sleeves: Phaser.GameObjects.Graphics;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly home: [{ x: number; y: number }, { x: number; y: number }];
  private turn = 0;
  private nervous = 0;
  private readonly reduced: boolean;
  private readonly baseScale: number;

  constructor(private readonly scene: Phaser.Scene, left: { x: number; y: number }, right: { x: number; y: number }, reduced: boolean, scale = 0.72) {
    this.reduced = reduced;
    this.baseScale = scale;
    this.home = [{ ...left }, { ...right }];
    this.aura = scene.add.image((left.x + right.x) / 2, left.y - 70, 'typel-glow-gold').setDisplaySize(520, 300).setTint(0x4fbf78).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(26);
    this.sleeves = scene.add.graphics().setDepth(27);
    this.hand = [
      scene.add.image(left.x, left.y, 'typel-hand').setOrigin(0.5, 0.92).setScale(scale).setFlipX(true).setDepth(28),
      scene.add.image(right.x, right.y, 'typel-hand').setOrigin(0.5, 0.92).setScale(scale).setDepth(28),
    ];
    this.drawSleeves();
  }

  private drawSleeves(): void {
    const g = this.sleeves.clear();
    this.hand.forEach((h, i) => {
      const side = i ? 1 : -1;
      const wx = h.x - side * 6;
      const wy = h.y - 4;
      g.lineStyle(84, SLEEVE, 1).beginPath();
      g.moveTo(wx + side * 70, 1180);
      g.lineTo(wx, wy + 40);
      g.strokePath();
      g.lineStyle(12, TRIM, 1).lineBetween(wx - 38, wy + 20, wx + 38, wy + 20);
    });
  }

  /** Kept for interface parity with the wizard; hands don't look anywhere. */
  lookAt(_x: number, _y: number): void {}

  tickFrame(_delta: number): void {
    if (this.nervous > 0 && !this.reduced) for (const [i, h] of this.hand.entries()) h.x = this.home[i]!.x + (Math.random() - 0.5) * this.nervous * 3;
    this.drawSleeves();
  }

  /** Every move ends at the hand's fixed home, so repeated actions can never drift (D-089 bug fix). */
  private settle(i: number): void {
    const h = this.hand[i]!;
    h.setPosition(this.home[i]!.x, this.home[i]!.y).setAngle(0).setScale(this.baseScale);
  }

  private press(i: number, dy: number, ms = 90): void {
    const h = this.hand[i]!;
    const base = this.home[i]!.y;
    this.scene.tweens.killTweensOf(h);
    this.settle(i);
    h.y = base + dy;
    this.scene.tweens.add({ targets: h, y: base, duration: ms, ease: 'Quad.easeOut', onComplete: () => this.settle(i) });
  }

  /** Raise a hand from home and bring it back to exactly home. */
  private lift(i: number, dy: number, angle: number, up: number, hold: number, ease = 'Back.easeOut'): void {
    const h = this.hand[i]!;
    this.scene.tweens.killTweensOf(h);
    this.settle(i);
    this.scene.tweens.add({ targets: h, y: this.home[i]!.y + dy, angle, duration: up, yoyo: true, hold, ease, onComplete: () => this.settle(i) });
  }

  typed(): void {
    this.press(this.turn++ % 2, 6);
  }

  captured(big: boolean): void {
    if (this.reduced) return;
    for (const i of [0, 1]) this.press(i, big ? -14 : -6, big ? 220 : 140);
  }

  mistyped(): void {
    if (this.reduced) return;
    const i = this.turn % 2;
    this.press(i, 14, 240);
    this.hand[i]!.setAngle((i ? 1 : -1) * 9);
    this.scene.tweens.add({ targets: this.hand[i], angle: 0, duration: 260, ease: 'Elastic.easeOut' });
  }

  plunging(): void {
    if (this.reduced) return;
    this.hand.forEach((h, i) => {
      this.scene.tweens.killTweensOf(h);
      this.settle(i);
      this.scene.tweens.add({ targets: h, scale: this.baseScale * 1.06, duration: 150, yoyo: true, hold: 500, onComplete: () => this.settle(i) });
    });
  }

  breached(): void {
    if (this.reduced) return;
    for (const i of [0, 1]) this.lift(i, -60, (i ? 1 : -1) * 14, 120, 0, 'Quad.easeOut');
  }

  cheer(): void {
    if (this.reduced) return;
    this.lift(1, -170, -8, 220, 520);
  }

  /** Raise the right hand for a spell; returns the fingertips for effects. */
  cast(): { x: number; y: number } {
    if (!this.reduced) this.lift(1, -130, 0, 160, 260);
    return { x: this.home[1].x, y: this.home[1].y - 260 };
  }

  setWonder(on: boolean, power: number): void {
    this.aura.setAlpha(on ? Math.min(0.6, 0.18 + power * 0.08) : 0);
  }

  setNervous(level: number): void {
    this.nervous = level > 0.7 ? 1 : level > 0.5 ? 0.5 : 0;
    if (!this.nervous) this.hand.forEach((h, i) => (h.x = this.home[i]!.x));
  }
}
