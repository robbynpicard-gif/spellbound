/**
 * The player's wizard (D-087 prototype). Seen from behind at a three-quarter
 * angle, over his left shoulder, like someone at a desk: we look where he
 * looks, into the Ward. An old, weathered, faintly ridiculous scholar with a
 * battered hat and a pipe. He can't show us his face, so he reacts with his
 * body: leaning in, flinching, jumping, grumbling, puffing smoke.
 * PLACEHOLDER character design; the final look is open.
 */
import Phaser from 'phaser';

const GRUMBLES = ['tsk', 'blast', 'hmph', 'drat', '#@%!', 'oh, come ON', 'bah'];
const ROBE = 0x3e1a1e;
const ROBE_DARK = 0x26100f;
const TRIM = 0x9c7a3c;
const FELT = 0x26222e;
const FELT_LIGHT = 0x3c3648;
const HAIR = 0x9e978a;
const SKIN = 0xb88a6a;
const GLOVE = 0x4a3020;

export class Wizard extends Phaser.GameObjects.Container {
  private readonly head: Phaser.GameObjects.Container;
  private readonly hat: Phaser.GameObjects.Container;
  private readonly profile: Phaser.GameObjects.Container;
  private readonly arms: Phaser.GameObjects.Graphics;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  readonly hands: [Phaser.GameObjects.Arc, Phaser.GameObjects.Arc];
  private handTurn = 0;
  private nervous = 0;
  private readonly reduced: boolean;
  private readonly baseX: number;
  private readonly baseY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, reduced: boolean) {
    super(scene, x, y);
    this.reduced = reduced;
    this.baseX = x;
    this.baseY = y;
    this.aura = scene.add.image(20, -20, 'typel-glow-gold').setDisplaySize(420, 420).setTint(0x4fbf78).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);

    // shoulders and back, robe with an embroidered collar and a bunched hood
    const body = scene.add.graphics();
    body.fillStyle(ROBE_DARK, 1).fillEllipse(30, 175, 360, 260);
    body.fillStyle(ROBE, 1);
    body.beginPath();
    body.moveTo(-150, 260);
    body.lineTo(-130, 120);
    body.lineTo(-70, 70);
    body.lineTo(40, 58);
    body.lineTo(150, 84);
    body.lineTo(205, 150);
    body.lineTo(230, 260);
    body.closePath();
    body.fillPath();
    body.fillStyle(ROBE_DARK, 0.6).fillEllipse(-40, 160, 60, 160).fillEllipse(110, 170, 50, 150);
    body.fillStyle(0x4e2226, 1).fillEllipse(10, 70, 170, 56); // bunched hood
    body.lineStyle(7, TRIM, 1).beginPath();
    body.arc(10, 64, 78, Math.PI * 0.05, Math.PI * 0.95, false).strokePath();
    body.lineStyle(2, 0xd8b870, 0.6).beginPath();
    body.arc(10, 64, 72, Math.PI * 0.1, Math.PI * 0.9, false).strokePath();

    // head: grey hair falls from under the hat; we see an ear, a cheek, beard edge and pipe
    this.head = scene.add.container(0, 0);
    const hair = scene.add.graphics();
    hair.fillStyle(0x6e685e, 1).fillEllipse(-4, 30, 124, 104);
    hair.fillStyle(HAIR, 1).fillEllipse(0, 22, 112, 96);
    hair.fillStyle(0xb8b2a4, 0.7).fillEllipse(-18, 14, 40, 70).fillEllipse(22, 20, 30, 60);
    this.profile = scene.add.container(0, 0);
    const face = scene.add.graphics();
    face.fillStyle(SKIN, 1).fillEllipse(50, 6, 26, 40); // cheek edge
    face.fillStyle(0xa07052, 1).fillEllipse(44, 4, 12, 22); // ear
    face.fillStyle(SKIN, 1).fillTriangle(60, -2, 74, 10, 60, 14); // nose tip
    face.fillStyle(0xc8c2b4, 1).fillEllipse(58, 40, 34, 46); // beard edge
    face.fillStyle(0xd8d2c4, 1).fillEllipse(64, 56, 20, 30);
    // pipe: a curved briar with a brass band
    face.lineStyle(5, 0x3a2416, 1).beginPath();
    face.moveTo(66, 20);
    face.lineTo(94, 26);
    face.strokePath();
    face.fillStyle(0x4a2c18, 1).fillRoundedRect(92, 8, 18, 22, 4);
    face.fillStyle(0xc89a4a, 1).fillRect(92, 22, 18, 3);
    face.fillStyle(0xff8a3a, 0.9).fillEllipse(101, 9, 12, 4);
    this.profile.add(face);
    // hat: battered, wide-brimmed, tall crown leaning back with a flopped tip
    this.hat = scene.add.container(-4, -30);
    const hatG = scene.add.graphics();
    hatG.fillStyle(FELT, 1);
    hatG.beginPath();
    hatG.moveTo(-52, -6);
    hatG.lineTo(-48, -90);
    hatG.lineTo(-56, -150);
    hatG.lineTo(-92, -176);
    hatG.lineTo(-80, -150);
    hatG.lineTo(-62, -128);
    hatG.lineTo(-10, -70);
    hatG.lineTo(46, -6);
    hatG.closePath();
    hatG.fillPath();
    hatG.fillStyle(FELT_LIGHT, 0.7).fillTriangle(-40, -10, -46, -100, -14, -56);
    hatG.lineStyle(2, 0x15131a, 0.8).lineBetween(-46, -64, -24, -50); // a dent
    hatG.fillStyle(0x5a3a22, 1).fillRect(-52, -24, 98, 16); // leather band
    hatG.fillStyle(0xc89a4a, 1).fillRect(-8, -26, 14, 20); // buckle
    hatG.fillStyle(FELT, 1).fillEllipse(-6, -4, 196, 44); // brim
    hatG.fillStyle(FELT_LIGHT, 0.6).fillEllipse(-6, -10, 180, 20);
    hatG.lineStyle(2, 0x15131a, 0.7).strokeEllipse(-6, -4, 196, 44);
    this.hat.add(hatG);
    this.head.add([hair, this.profile, this.hat]);
    this.head.setAngle(-4);

    this.arms = scene.add.graphics().setDepth(26);
    this.hands = [scene.add.circle(x + 120, y + 10, 13, GLOVE, 1), scene.add.circle(x + 200, y, 13, GLOVE, 1)];
    for (const h of this.hands) h.setStrokeStyle(3, 0x2a1a10, 1).setDepth(27);

    this.smoke = scene.add.particles(0, 0, 'typel-spark', {
      lifespan: 2600, speedY: { min: -40, max: -18 }, speedX: { min: -8, max: 14 }, scale: { start: 0.3, end: 1.4 },
      alpha: { start: 0.28, end: 0 }, tint: 0xbab4a8, frequency: 700, emitting: !reduced,
    }).setDepth(28);

    this.add([this.aura, body, this.head]);
    scene.add.existing(this);
    this.setDepth(25);
    if (!reduced) {
      scene.tweens.add({ targets: this, scaleY: 1.012, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: this.hat, angle: { from: -2, to: 1.5 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private pipeWorld(): { x: number; y: number } {
    const p = this.profile;
    return { x: this.x + (this.head.x + p.x + 101) * this.scaleX, y: this.y + (this.head.y + p.y + 6) * this.scaleY };
  }

  private puff(n: number, dark = false): void {
    const p = this.pipeWorld();
    this.smoke.setParticleTint(dark ? 0x5a5650 : 0xd4cec2);
    this.smoke.explode(this.reduced ? Math.ceil(n / 2) : n, p.x, p.y);
    this.smoke.setParticleTint(0xbab4a8);
  }

  private grumble(force?: string): void {
    const word = force ?? GRUMBLES[Math.floor(Math.random() * GRUMBLES.length)]!;
    const t = this.scene.add.text(this.x + 40, this.y - 120, word, {
      fontFamily: '"Kalam", "Trebuchet MS", sans-serif', fontSize: '24px', fontStyle: '700', color: '#efe2c2', stroke: '#1a0f08', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(40).setAngle(-6);
    this.scene.tweens.add({ targets: t, y: t.y - 36, alpha: 0, delay: 500, duration: 700, onComplete: () => t.destroy() });
  }

  /** Head turns toward a point in the field (usually the targeted scroll). */
  lookAt(sx: number, sy: number): void {
    const dx = sx - this.x;
    const dy = sy - (this.y - 40);
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    // turning further right shows more profile; looking up tilts the hat back
    this.profile.x = Phaser.Math.Linear(this.profile.x, (nx - 0.6) * 22, 0.2);
    this.head.angle = Phaser.Math.Linear(this.head.angle, -4 + nx * 6 + ny * 6, 0.15);
  }

  tickFrame(_delta: number): void {
    const jitter = this.nervous > 0 && !this.reduced ? (Math.random() - 0.5) * this.nervous * 3 : 0;
    this.x = this.baseX + jitter;
    // arms from the shoulders to wherever the hands are
    const g = this.arms.clear();
    const k = this.scaleX;
    const shoulders: [number, number][] = [[this.x + 70 * k, this.y + 92 * k], [this.x + 160 * k, this.y + 96 * k]];
    this.hands.forEach((h, i) => {
      const [sx, sy] = shoulders[i]!;
      g.lineStyle((i ? 38 : 30) * k, ROBE, 1).beginPath();
      g.moveTo(sx, sy);
      g.lineTo((sx + h.x) / 2 + 10, (sy + h.y) / 2 + 8);
      g.lineTo(h.x - 6, h.y + 8);
      g.strokePath();
      g.lineStyle(5, TRIM, 1).lineBetween(h.x - 16, h.y + 14, h.x + 4, h.y + 4); // cuff
    });
  }

  typed(): void {
    const h = this.hands[this.handTurn++ % 2]!;
    this.scene.tweens.killTweensOf(h);
    const base = (h.getData('y') as number | undefined) ?? h.y;
    h.setData('y', base);
    h.y = base + 6;
    this.scene.tweens.add({ targets: h, y: base, duration: 90, ease: 'Quad.easeOut' });
  }

  captured(big: boolean): void {
    if (big) this.puff(6);
    if (this.reduced) return;
    this.scene.tweens.add({ targets: this.head, y: big ? -8 : -3, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  }

  mistyped(): void {
    if (Math.random() < 0.35) this.grumble();
    this.puff(3, true);
    if (this.reduced) return;
    this.scene.tweens.add({ targets: this.head, angle: this.head.angle - 7, duration: 70, yoyo: true });
  }

  plunging(): void {
    if (this.reduced) return;
    this.scene.tweens.add({ targets: this, x: this.baseX + 10, y: this.baseY - 8, duration: 160, yoyo: true, hold: 600, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.head, angle: 4, duration: 160, yoyo: true, hold: 600 });
  }

  breached(): void {
    this.grumble(Math.random() < 0.5 ? 'ARGH' : '#@%!');
    this.puff(8, true);
    if (this.reduced) return;
    this.scene.tweens.add({ targets: this, y: this.baseY - 22, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.hat, y: -96, angle: -14, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
  }

  cheer(): void {
    this.puff(10);
    if (this.reduced) return;
    const h = this.hands[1];
    this.scene.tweens.add({ targets: h, y: h.y - 150, x: h.x - 10, duration: 220, yoyo: true, hold: 600, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.hat, y: -58, duration: 180, yoyo: true, hold: 300 });
  }

  /** Raise a hand for a spell; returns the fingertip position for effects. */
  cast(): { x: number; y: number } {
    const h = this.hands[1];
    if (!this.reduced) this.scene.tweens.add({ targets: h, y: h.y - 110, x: h.x + 30, duration: 160, yoyo: true, hold: 260, ease: 'Back.easeOut' });
    return { x: h.x + 30, y: h.y - 110 };
  }

  setWonder(on: boolean, power: number): void {
    this.aura.setAlpha(on ? Math.min(0.7, 0.2 + power * 0.1) : 0);
  }

  setNervous(level: number): void {
    this.nervous = level > 0.7 ? 1 : level > 0.5 ? 0.5 : 0;
    if (this.nervous && !this.reduced && Math.random() < 0.003) this.puff(4, true);
  }
}
