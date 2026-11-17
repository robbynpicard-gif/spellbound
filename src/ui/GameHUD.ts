import Phaser from 'phaser';
import { FONTS, PALETTE } from '../core/GameConfig';
import type { InstabilityStage } from '../gameplay/InstabilityManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import { SPELL_IDS, type SpellCharges, type SpellId } from '../gameplay/SpellManager';
import { ART, ART_SCALE, hex, LAYOUT, SPELL_COLORS } from '../render/layout';
import { TypingConsole } from './TypingConsole';

const PX = ART_SCALE;
const INK = 0x22180f;
const PAPER = 0xd6ba8c;
const PAPER_DARK = 0xb4966a;
const SLOT_EMPTY = 0x8a7458;
const LABEL = 0xe6d6b4;

/** Ward bar colour by health: magenta when healthy, then amber, ember, red. */
const WARD_COLORS: Record<InstabilityStage, number> = {
  0: PALETTE.arcane,
  1: PALETTE.gold,
  2: PALETTE.fire,
  3: PALETTE.crimson,
  4: PALETTE.crimson,
};

const ui = (color: number, size: number): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONTS.heading,
  fontSize: `${size}px`,
  fontStyle: '600',
  color: hex(color),
});
const ink = (size: number): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONTS.gameplay,
  fontSize: `${size}px`,
  fontStyle: '700',
  color: hex(INK),
});

const shade = (color: number, f: number): number => {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c((color >> 16) & 255) << 16) | (c((color >> 8) & 255) << 8) | c(color & 255);
};
/** Depleted spells: greyed and darkened, but still recognisable. */
const desaturate = (color: number): number => {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const grey = (r + g + b) / 3;
  const mix = (v: number) => Math.round((v * 0.3 + grey * 0.7) * 0.75);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
};

/** A thin bar in a status-bar panel. */
class Bar {
  private readonly g: Phaser.GameObjects.Graphics;
  private shown = 0;
  private readonly t = { v: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly w: number,
    private color: number,
  ) {
    this.g = scene.add.graphics().setDepth(31);
    this.draw(0);
  }

  set(value: number, color = this.color): void {
    this.color = color;
    this.scene.tweens.killTweensOf(this.t);
    this.t.v = this.shown;
    this.scene.tweens.add({ targets: this.t, v: value, duration: 350, ease: 'Cubic.Out', onUpdate: () => this.draw(this.t.v) });
  }

  private draw(value: number): void {
    this.shown = value;
    const { g, x, y, w } = this;
    g.clear();
    g.fillStyle(0x060404, 1);
    g.fillRect(x - PX, y - PX, w + 2 * PX, 5 * PX);
    g.fillStyle(0x2a2020, 1);
    g.fillRect(x, y, w, 3 * PX);
    const fill = Math.round((w * Math.max(0, Math.min(100, value))) / 100 / PX) * PX;
    g.fillStyle(this.color, 1);
    g.fillRect(x, y, fill, 3 * PX);
    g.fillStyle(shade(this.color, 1.35), 1);
    g.fillRect(x, y, fill, PX);
  }
}

/** One scroll in the spell rack: coloured all over, a big symbol, the spell's name and its charges. */
class RackScroll {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly name: Phaser.GameObjects.Text;
  private readonly count: Phaser.GameObjects.Text;
  private readonly container: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly spell: SpellId,
    x: number,
    y: number,
    private readonly w: number,
    private readonly h: number,
  ) {
    const big = h >= 70;
    this.g = scene.add.graphics();
    this.icon = scene.add
      .image(-w / 2 + (big ? 40 : 30), big ? -6 : 0, ART.icons, SPELL_IDS.indexOf(spell))
      .setScale(big ? 4 : 3);
    this.count = scene.add
      .text(w / 2 - 14, big ? -10 : -2, '', ui(0xf6ecd8, big ? 28 : 22))
      .setOrigin(1, 0.5)
      .setShadow(2, 2, '#1a1214', 0, false, true);
    this.name = scene.add
      .text(big ? 0 : w / 2 - 14, big ? h / 2 - 20 : h / 2 - 12, spell.toUpperCase(), ui(0xf6ecd8, big ? 16 : 12))
      .setOrigin(big ? 0.5 : 1, 0.5)
      .setShadow(2, 2, '#1a1214', 0, false, true)
      .setVisible(big || h >= 46);
    this.container = scene.add.container(x + w / 2, y + h / 2, [this.g, this.icon, this.count, this.name]).setDepth(31);
    this.set(0);
  }

  set(charges: number): void {
    const active = charges > 0;
    const base = SPELL_COLORS[this.spell];
    const body = active ? base : desaturate(base);
    const { g, w, h } = this;
    const x0 = -w / 2;
    const y0 = -h / 2;
    const curl = 5 * PX;
    g.clear();
    // Body, with rolled curls at top and bottom.
    g.fillStyle(0x0a0606, 1);
    g.fillRect(x0 + PX, y0 + 3 * PX, w - 2 * PX, h - 4 * PX);
    g.fillStyle(body, 1);
    g.fillRect(x0 + 2 * PX, y0 + curl, w - 4 * PX, h - 2 * curl);
    for (const cy of [y0, y0 + h - curl]) {
      g.fillStyle(shade(body, 0.6), 1);
      g.fillRect(x0, cy, w, curl);
      g.fillStyle(shade(body, 1.3), 1);
      g.fillRect(x0, cy, w, PX);
      g.fillStyle(shade(body, 0.4), 1);
      g.fillRect(x0 + w - 3 * PX, cy + PX, 2 * PX, curl - 2 * PX);
    }
    g.fillStyle(shade(body, 1.2), 1);
    g.fillRect(x0 + 2 * PX, y0 + curl, PX, h - 2 * curl);
    g.fillStyle(shade(body, 0.7), 1);
    g.fillRect(x0 + w - 3 * PX, y0 + curl, PX, h - 2 * curl);
    this.icon.setAlpha(active ? 1 : 0.55);
    this.count.setText(`×${charges}`).setAlpha(active ? 1 : 0.5);
    this.name.setAlpha(active ? 1 : 0.6);
  }

  /** Collected or cast: a quick unfurl. */
  pulse(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleY: { from: 1.18, to: 1 },
      scaleX: { from: 1.06, to: 1 },
      duration: 280,
      ease: 'Back.Out',
    });
  }

  /** Tried to cast with no charges. */
  deny(): void {
    const x = this.container.x;
    this.scene.tweens.add({
      targets: this.container,
      x: { from: x - 5, to: x + 5 },
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.container.setX(x),
    });
  }
}

/**
 * Heads-up display set into the study art (decisions.md D-035,
 * docs/art-direction.md). The typewriter's parchment roll shows progress
 * segments and the typing line; the brass counter shows the score on number
 * wheels with the combo below; the rack on the right holds a coloured scroll
 * per unlocked spell; the status bar gives exact values.
 */
export class GameHUD {
  readonly console: TypingConsole;
  private readonly roll: Phaser.GameObjects.Graphics;
  private readonly rollLabel: Phaser.GameObjects.Text;
  private readonly wheels: Phaser.GameObjects.Text[] = [];
  private readonly counterGlow: Phaser.GameObjects.Rectangle;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly wordsText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly accuracyText: Phaser.GameObjects.Text;
  private readonly wardText: Phaser.GameObjects.Text;
  private readonly progressBar: Bar;
  private readonly wardBar: Bar;
  private readonly scrolls: Partial<Record<SpellId, RackScroll>> = {};
  private lastCharges: SpellCharges | null = null;
  private completed = 0;
  private shownScore = -1;
  private ward = 100;
  private shield = 0;
  private survivalMs: number | null = null;
  private survivalLeftMs = 0;
  private rival: { name: string; score: number; instability: number; alive: boolean } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    levelName: string,
    private readonly quota: number | null,
    /** Run score from earlier levels, added to this level's score. */
    private readonly scoreOffset = 0,
    rivalName?: string,
    /** Spells with a scroll in the rack (those this run has unlocked), in power order. */
    knownSpells: readonly SpellId[] = SPELL_IDS,
  ) {
    if (rivalName) this.rival = { name: rivalName, score: 0, instability: 0, alive: true };

    // Typewriter roll: progress segments and the typing line.
    const r = LAYOUT.roll;
    this.roll = scene.add.graphics().setDepth(30);
    this.rollLabel = scene.add.text(r.x + r.width - 12, r.y + 16, '', ink(16)).setOrigin(1, 0.5).setDepth(31);
    this.console = new TypingConsole(scene, r.x + r.width / 2, r.y + 48, r.width);

    // Brass counter: six number wheels, and the combo plate.
    const c = LAYOUT.counter;
    const wheelW = 21;
    const gap = (c.width - 6 * wheelW) / 5;
    const wheels = scene.add.graphics().setDepth(30);
    for (let i = 0; i < 6; i++) {
      const wx = Math.round(c.x + i * (wheelW + gap));
      wheels.fillStyle(0xe8dcc0, 1);
      wheels.fillRect(wx, c.y + 4, wheelW, c.height - 8);
      wheels.fillStyle(0xb8a888, 1);
      wheels.fillRect(wx, c.y + 4, wheelW, 4);
      wheels.fillRect(wx, c.y + c.height - 8, wheelW, 4);
      this.wheels.push(scene.add.text(wx + wheelW / 2, c.y + c.height / 2, '0', ink(26)).setOrigin(0.5).setDepth(31));
    }
    this.counterGlow = scene.add
      .rectangle(c.x - 4, c.y, c.width + 8, c.height, PALETTE.gold, 1)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(32);
    const k = LAYOUT.combo;
    this.comboText = scene.add
      .text(k.x + k.width / 2, k.y + k.height / 2, '', ui(PALETTE.magentaGlow, 20))
      .setOrigin(0.5)
      .setDepth(31);

    // Spell rack: one scroll per unlocked spell.
    const shown = SPELL_IDS.filter((id) => knownSpells.includes(id));
    const rack = LAYOUT.rack;
    const step = shown.length > 0 ? Math.min(98, Math.floor(rack.height / shown.length)) : 0;
    shown.forEach((id, i) => {
      this.scrolls[id] = new RackScroll(scene, id, rack.x + 6, rack.y + i * step + 4, rack.width - 12, step - 8);
    });

    // Status bar: level · words · score · ward.
    const st = LAYOUT.status;
    const [p1, p2, p3, p4] = st.panels;
    const cx = (p: readonly [number, number]) => (p[0] + p[1]) / 2;
    this.levelText = scene.add
      .text(cx(p1), st.y + st.height / 2, levelName.toUpperCase(), ui(LABEL, 17))
      .setOrigin(0.5)
      .setDepth(31);
    this.wordsText = scene.add.text(cx(p2), st.y + 16, '', ui(LABEL, 17)).setOrigin(0.5).setDepth(31);
    this.progressBar = new Bar(scene, p2[0] + 24, st.y + 34, p2[1] - p2[0] - 48, PALETTE.gold);
    this.scoreText = scene.add.text(cx(p3), st.y + 16, '', ui(LABEL, 17)).setOrigin(0.5).setDepth(31);
    this.accuracyText = scene.add.text(cx(p3), st.y + 38, '', ui(LABEL, 14)).setOrigin(0.5).setAlpha(0.8).setDepth(31);
    this.wardText = scene.add.text(cx(p4), st.y + 16, '', ui(LABEL, 17)).setOrigin(0.5).setDepth(31);
    this.wardBar = new Bar(scene, p4[0] + 24, st.y + 34, p4[1] - p4[0] - 48, WARD_COLORS[0]);
    this.wardBar.set(100);

    // Labels on the brass plates above the counter and the rack.
    scene.add.text(LAYOUT.scorePlate.x, LAYOUT.scorePlate.y, 'SCORE', ui(LABEL, 12)).setOrigin(0.5).setDepth(31);
    scene.add.text(LAYOUT.rackPlate.x, LAYOUT.rackPlate.y, 'SPELLS', ui(LABEL, 20)).setOrigin(0.5).setDepth(31);

    this.drawRoll();
    this.updateStats(null);
    this.refreshWard();
  }

  // ───────────────────────── score, combo, accuracy ─────────────────────────

  updateStats(stats: GameStats | null, combo = 0): void {
    const score = this.scoreOffset + (stats?.score ?? 0);
    if (score !== this.shownScore) {
      const grew = this.shownScore >= 0 && score > this.shownScore;
      this.shownScore = score;
      const digits = String(Math.min(999999, score)).padStart(6, '0');
      this.wheels.forEach((t, i) => t.setText(digits[i]!));
      if (grew) {
        // Subtle golden light on the counter when the score goes up.
        this.scene.tweens.killTweensOf(this.counterGlow);
        this.counterGlow.setAlpha(0.3);
        this.scene.tweens.add({ targets: this.counterGlow, alpha: 0, duration: 400 });
      }
    }
    this.comboText.setText(`COMBO ×${combo}`).setColor(hex(combo >= 5 ? PALETTE.gold : PALETTE.magentaGlow));
    this.scoreText.setText(`SCORE ${score.toLocaleString()} · COMBO ×${combo}`);
    const acc = stats ? Math.round(stats.accuracy * 100) : 100;
    const wpm = stats ? Math.round(stats.wpm) : 0;
    this.accuracyText.setText(`${acc}% ACCURACY · ${wpm} WPM`);
  }

  pulseCombo(): void {
    this.scene.tweens.add({ targets: this.comboText, scale: { from: 1.25, to: 1 }, duration: 200 });
  }

  /** Replace the level label (e.g. the duel timer). */
  setTitle(text: string): void {
    const upper = text.toUpperCase();
    if (this.levelText.text !== upper) this.levelText.setText(upper);
  }

  // ───────────────────────── progress ─────────────────────────

  setRival(score: number, instability: number, alive: boolean): void {
    if (!this.rival) return;
    Object.assign(this.rival, { score, instability, alive });
    this.drawRoll();
  }

  setProgress(completed: number): void {
    this.completed = completed;
    this.drawRoll();
  }

  /** Boss level: the roll and bar show time survived. */
  setSurvival(totalMs: number, leftMs: number): void {
    const before = Math.ceil(this.survivalLeftMs / 1000);
    const first = this.survivalMs === null;
    this.survivalMs = totalMs;
    this.survivalLeftMs = leftMs;
    if (first || Math.ceil(leftMs / 1000) !== before) this.drawRoll();
  }

  /** Segments on the parchment roll, the exact count beside them, and the status-bar bar. */
  private drawRoll(): void {
    const r = LAYOUT.roll;
    const g = this.roll;
    g.clear();
    g.fillStyle(PAPER, 1);
    g.fillRect(r.x, r.y, r.width, r.height);
    g.fillStyle(0xead2a6, 1);
    g.fillRect(r.x, r.y, r.width, PX);
    g.fillStyle(PAPER_DARK, 1);
    g.fillRect(r.x, r.y + r.height - PX, r.width, PX);
    g.fillRect(r.x + 10, r.y + 32, r.width - 20, PX);

    let filled = 0;
    let total = 0;
    let label: string;
    let percent: number;
    const rv = this.rival;
    if (rv) {
      total = 20;
      filled = Math.round((rv.instability / 100) * total);
      const name = rv.name.slice(0, 8).toUpperCase();
      label = rv.alive ? `${name} ${rv.score.toLocaleString()}` : `${name} FELL`;
      percent = rv.alive ? 100 - rv.instability : 0;
      this.wordsText.setText(rv.alive ? `RIVAL WARD ${Math.round(100 - rv.instability)}%` : 'RIVAL FELL');
    } else if (this.survivalMs !== null) {
      total = 20;
      const done = (this.survivalMs - this.survivalLeftMs) / this.survivalMs;
      filled = Math.floor(done * total);
      const s = Math.ceil(this.survivalLeftMs / 1000);
      label = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      percent = done * 100;
      this.wordsText.setText(`SURVIVE ${label}`);
    } else if (this.quota !== null) {
      const done = Math.min(this.completed, this.quota);
      total = Math.min(this.quota, 36);
      filled = Math.floor((done / this.quota) * total);
      label = `${done} / ${this.quota}`;
      percent = (done / this.quota) * 100;
      this.wordsText.setText(`${label} WORDS`);
    } else {
      label = `${this.completed} WORDS`;
      percent = 100;
      this.wordsText.setText(label);
    }
    this.rollLabel.setText(label);

    if (total > 0) {
      const area = r.width - 20 - this.rollLabel.width - 16;
      const cell = Math.max(2 * PX, Math.floor(area / total / PX) * PX);
      for (let i = 0; i < total; i++) {
        const x = r.x + 10 + i * cell;
        g.fillStyle(i < filled ? PALETTE.gold : SLOT_EMPTY, 1);
        g.fillRect(x, r.y + 10, cell - PX, 6 * PX);
        if (i < filled) {
          g.fillStyle(0xffd278, 1);
          g.fillRect(x, r.y + 10, cell - PX, PX);
        }
      }
    }
    this.progressBar.set(percent);
  }

  // ───────────────────────── ward ─────────────────────────

  setInstability(value: number, stage: InstabilityStage): void {
    this.ward = Math.max(0, 100 - value);
    this.wardBar.set(this.ward, WARD_COLORS[stage]);
    this.refreshWard(stage);
  }

  /** Arcane Shield blocks left. */
  setShield(remaining: number): void {
    this.shield = remaining;
    this.refreshWard();
  }

  private refreshWard(stage?: InstabilityStage): void {
    this.wardText.setText(`WARD ${Math.round(this.ward)}%${this.shield > 0 ? ` · SHIELD ×${this.shield}` : ''}`);
    if (stage !== undefined) this.wardText.setColor(hex(stage >= 3 ? PALETTE.crimson : LABEL));
  }

  // ───────────────────────── spells ─────────────────────────

  setSpells(charges: SpellCharges, pulse?: SpellId): void {
    for (const id of SPELL_IDS) {
      if (!this.lastCharges || this.lastCharges[id] !== charges[id]) this.scrolls[id]?.set(charges[id]);
    }
    this.lastCharges = { ...charges };
    if (pulse) this.scrolls[pulse]?.pulse();
  }

  denySpell(spell: SpellId): void {
    this.scrolls[spell]?.deny();
  }
}
