/**
 * The player's wizard (D-086 prototype): a charming, naive apprentice who
 * watches the Ward and reacts to everything with wonder. Built from simple
 * shapes so every part can animate. PLACEHOLDER character design.
 */
import Phaser from 'phaser';

type Eyes = 'open' | 'happy' | 'wince' | 'wide' | 'closed';

export class Wizard extends Phaser.GameObjects.Container {
  private readonly hat: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Container;
  private readonly eyes: Phaser.GameObjects.Graphics;
  private readonly brows: Phaser.GameObjects.Graphics;
  private readonly mouth: Phaser.GameObjects.Graphics;
  private readonly sweat: Phaser.GameObjects.Text;
  private readonly aura: Phaser.GameObjects.Image;
  readonly hands: [Phaser.GameObjects.Arc, Phaser.GameObjects.Arc];
  private eyeState: Eyes = 'open';
  private look = { x: 0, y: -1 };
  private hold = 0;
  private handTurn = 0;
  private nervous = 0;
  private wonder = false;
  private reduced: boolean;
  private readonly baseX: number;

  constructor(scene: Phaser.Scene, x: number, y: number, reduced: boolean) {
    super(scene, x, y);
    this.reduced = reduced;
    this.baseX = x;
    this.aura = scene.add.image(0, -80, 'typel-glow-gold').setDisplaySize(360, 360).setTint(0x3ddc84).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    // robe
    const robe = scene.add.graphics();
    robe.fillStyle(0x2f5bff, 1).fillRoundedRect(-92, -40, 184, 210, { tl: 70, tr: 70, bl: 10, br: 10 });
    robe.fillStyle(0x1e3ab8, 1).fillRect(-6, -30, 12, 190);
    robe.fillStyle(0xffd977, 1);
    for (const [sx, sy] of [[-60, 10], [50, 40], [-40, 90], [62, 110], [-70, 140]]) this.starAt(robe, sx!, sy!, 7);
    // head
    this.head = scene.add.container(0, -92);
    const face = scene.add.graphics();
    face.fillStyle(0xffd2b0, 1).fillCircle(0, 0, 50);
    face.fillStyle(0xff9a8a, 0.55).fillCircle(-30, 14, 10).fillCircle(30, 14, 10);
    const beard = scene.add.graphics();
    beard.fillStyle(0xf4f1ea, 1);
    for (const [bx, by, r] of [[-34, 26, 22], [34, 26, 22], [-14, 44, 26], [14, 44, 26], [0, 70, 24], [-28, 56, 18], [28, 56, 18]]) beard.fillCircle(bx!, by!, r!);
    this.mouth = scene.add.graphics();
    const nose = scene.add.graphics();
    nose.fillStyle(0xff8f7a, 1).fillCircle(0, 6, 10);
    this.eyes = scene.add.graphics();
    this.brows = scene.add.graphics();
    this.sweat = scene.add.text(42, -36, '💧', { fontSize: '22px' }).setAlpha(0);
    // hat
    this.hat = scene.add.container(0, -36);
    const hatG = scene.add.graphics();
    hatG.fillStyle(0x7a2cff, 1);
    hatG.fillTriangle(-74, 0, 74, 0, 34, -170);
    hatG.fillStyle(0x7a2cff, 1).fillCircle(44, -168, 14);
    hatG.fillStyle(0x5a18d0, 1).fillEllipse(0, 0, 176, 30);
    hatG.fillStyle(0xffc94a, 1).fillRect(-62, -22, 116, 14);
    hatG.fillStyle(0xffe9a8, 1);
    for (const [sx, sy] of [[-20, -60], [18, -100], [-6, -130], [30, -150]]) this.starAt(hatG, sx!, sy!, 8);
    this.hat.add(hatG);
    this.head.add([beard, face, nose, this.mouth, this.eyes, this.brows, this.sweat, this.hat]);
    face.setDepth(0);
    // hands rest on the keys, drawn in front of the typewriter by the scene
    this.hands = [scene.add.circle(x - 58, y + 118, 19, 0xffd2b0, 1), scene.add.circle(x + 58, y + 118, 19, 0xffd2b0, 1)];
    for (const h of this.hands) h.setFillStyle(0xffd2b0, 1).setStrokeStyle(5, 0x2f5bff, 1).setDepth(26);
    this.add([this.aura, robe, this.head]);
    this.reorderFace(beard, face);
    this.drawFace();
    scene.add.existing(this);
    this.setDepth(18);
    // idle life: breathing, a swaying hat, blinking
    if (!reduced) {
      scene.tweens.add({ targets: this, scaleY: 1.015, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: this.hat, angle: { from: -3, to: 3 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    scene.time.addEvent({ delay: 3400, loop: true, callback: () => this.blink() });
  }

  private reorderFace(beard: Phaser.GameObjects.Graphics, face: Phaser.GameObjects.Graphics): void {
    this.head.sendToBack(beard);
    this.head.moveAbove(face, beard);
  }

  private starAt(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.42 : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
    }
    g.fillPoints(pts, true);
  }

  private drawFace(): void {
    const e = this.eyes.clear();
    const b = this.brows.clear();
    const m = this.mouth.clear();
    const px = this.look.x * 6;
    const py = this.look.y * 5;
    for (const side of [-1, 1]) {
      const ex = side * 19;
      const ey = -12;
      switch (this.eyeState) {
        case 'happy':
          e.lineStyle(5, 0x2b1606, 1).beginPath().arc(ex, ey + 4, 10, Math.PI * 1.1, Math.PI * 1.9).strokePath();
          break;
        case 'wince':
          e.lineStyle(5, 0x2b1606, 1).lineBetween(ex - 9, ey - 6, ex + 7, ey).lineBetween(ex + 7, ey, ex - 9, ey + 6);
          break;
        case 'closed':
          e.lineStyle(4, 0x2b1606, 1).lineBetween(ex - 10, ey, ex + 10, ey);
          break;
        default: {
          const big = this.eyeState === 'wide' || this.wonder;
          e.fillStyle(0xffffff, 1).fillEllipse(ex, ey, big ? 30 : 26, big ? 34 : 30);
          e.fillStyle(this.wonder ? 0x1e7a4a : 0x2b1606, 1).fillCircle(ex + px, ey + py, big ? 9 : 7.5);
          e.fillStyle(0xffffff, 1).fillCircle(ex + px - 2.5, ey + py - 3, 2.6);
          if (this.wonder) e.fillStyle(0xffe9a8, 1).fillCircle(ex + px + 3, ey + py + 2, 1.6);
        }
      }
      const lift = this.eyeState === 'wide' || this.wonder ? -8 : this.eyeState === 'wince' ? 4 : 0;
      b.lineStyle(6, 0xe8e4dc, 1).lineBetween(ex - 12, ey - 22 + lift + (this.nervous > 0 ? side * -3 : 0), ex + 10, ey - 24 + lift);
    }
    if (this.eyeState === 'happy' || this.wonder) m.fillStyle(0x8a2a1a, 1).slice(0, 22, 12, 0, Math.PI, false).fillPath();
    else if (this.eyeState === 'wince' || this.eyeState === 'wide') m.fillStyle(0x8a2a1a, 1).fillEllipse(0, 26, 14, this.eyeState === 'wide' ? 18 : 8);
    else m.lineStyle(4, 0x8a2a1a, 1).beginPath().arc(0, 18, 10, 0.2 * Math.PI, 0.8 * Math.PI).strokePath();
  }

  private expression(state: Eyes, ms: number): void {
    this.eyeState = state;
    this.hold = ms;
    this.drawFace();
  }

  /** Eyes follow a point on screen (usually the targeted scroll). */
  lookAt(sx: number, sy: number): void {
    const dx = sx - (this.x + this.head.x);
    const dy = sy - (this.y + this.head.y);
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    if (Math.abs(nx - this.look.x) + Math.abs(ny - this.look.y) < 0.08) return;
    this.look = { x: nx, y: ny };
    this.head.angle = Phaser.Math.Clamp(nx * 6, -8, 8);
    if (this.eyeState === 'open' || this.eyeState === 'wide') this.drawFace();
  }

  tickFrame(delta: number): void {
    if (this.hold > 0 && (this.hold -= delta) <= 0) {
      this.eyeState = 'open';
      this.drawFace();
    }
    this.x = this.baseX + (this.nervous > 0 && !this.reduced ? (Math.random() - 0.5) * this.nervous * 3 : 0);
  }

  private blink(): void {
    if (this.eyeState !== 'open') return;
    this.expression('closed', 110);
  }

  typed(): void {
    const h = this.hands[this.handTurn++ % 2]!;
    this.scene.tweens.killTweensOf(h);
    const base = h.getData('y') ?? h.y;
    h.setData('y', base);
    h.y = base + 7;
    this.scene.tweens.add({ targets: h, y: base, duration: 90, ease: 'Quad.easeOut' });
  }

  captured(big: boolean): void {
    this.expression('happy', big ? 600 : 300);
    if (!this.reduced) this.scene.tweens.add({ targets: this, y: this.y - (big ? 16 : 7), duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  }

  mistyped(): void {
    this.expression('wince', 380);
    this.sweatDrop();
  }

  plunging(): void {
    this.expression('wide', 900);
    if (!this.reduced) this.scene.tweens.add({ targets: this.head, x: 10, duration: 160, yoyo: true, hold: 500 });
  }

  breached(): void {
    this.expression('wide', 700);
    if (this.reduced) return;
    this.scene.tweens.add({ targets: this, y: this.y - 24, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.hat, y: -110, angle: 18, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
  }

  cheer(): void {
    this.expression('happy', 1200);
    if (this.reduced) return;
    for (const [i, h] of this.hands.entries()) this.scene.tweens.add({ targets: h, y: h.y - 140, x: h.x + (i ? 40 : -40), duration: 220, yoyo: true, hold: 600, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.hat, y: -70, duration: 180, yoyo: true, hold: 300 });
  }

  /** Raise a hand for a spell; returns the fingertip position for effects. */
  cast(): { x: number; y: number } {
    const h = this.hands[1];
    if (!this.reduced) this.scene.tweens.add({ targets: h, y: h.y - 100, x: h.x + 30, duration: 160, yoyo: true, hold: 260, ease: 'Back.easeOut' });
    this.expression('wide', 500);
    return { x: h.x + 30, y: h.y - 100 };
  }

  setWonder(on: boolean, power: number): void {
    if (on !== this.wonder) {
      this.wonder = on;
      this.drawFace();
    }
    this.aura.setAlpha(on ? Math.min(0.8, 0.25 + power * 0.12) : 0);
  }

  setNervous(level: number): void {
    const n = level > 0.7 ? 1 : level > 0.5 ? 0.5 : 0;
    if (n !== this.nervous) {
      this.nervous = n;
      this.drawFace();
    }
  }

  private sweatDrop(): void {
    this.sweat.setAlpha(1).setY(-36);
    this.scene.tweens.add({ targets: this.sweat, y: -6, alpha: 0, duration: 600, ease: 'Quad.easeIn' });
  }
}
