/**
 * Typel play scene (prototype, D-085/D-086). Rendering only reacts to engine
 * events; cosmetic motion never changes positions, speeds or hit tests.
 * Layout follows the owner's zones (see paint.ts header).
 */
import Phaser from 'phaser';
import { GameEngine } from '../../core/GameEngine';
import { SIMULATION_STEP_MS, FIELD } from '../../core/GameConfig';
import type { GameResult } from '../../core/GameEvents';
import type { DifficultyConfig } from '../../difficulty/DifficultyConfig';
import { isSurvival } from '../../difficulty/DifficultyConfig';
import type { GameStats } from '../../gameplay/ScoringSystem';
import type { SpellCharges, SpellId } from '../../gameplay/SpellManager';
import type { WordState } from '../../gameplay/Word';
import { RUNE_BY_ID } from '../../gameplay/runes/RuneCatalogue';
import { WORDS } from '../../data/wordList';
import { SPELL_ORDER, type Line } from '../apprenticeship';
import { sound } from '../audio';
import { prefs } from '../prefs';
import { FIELD_RECT, FLOOR, INK, paintScroll, RACK_X, RUBRIC, SPELL_GLYPH, SPELL_HUE, WARD_Y, KEY_ROWS } from './paint';
import { buildRoom, ensureTextures, FONT_ARCADE, FONT_TITLE, FONT_WORD, FONT_BODY, hexNum } from './study';
import { Wizard } from './Wizard';

export interface Carry {
  spells: SpellCharges;
  instability: number;
  ward: { cap: number; wagers: number };
  combo: number;
  words: WordState[];
}

export interface PlaySetup {
  config: DifficultyConfig;
  hardcore: boolean;
  seed?: number;
  initialSpells?: Partial<SpellCharges>;
  initialInstability?: number;
  initialWard?: { cap: number; wagers: number };
  initialCombo?: number;
  initialWords?: readonly WordState[];
  scoreOffset?: number;
  poolLimitOverride?: number;
  spells: readonly SpellId[];
  title: string;
  subtitle: string;
  lines?: Line[];
  boss?: boolean;
  onEnd(result: GameResult, stats: GameStats, carry: Carry): void;
  onPause(): void;
}

const SX = FIELD_RECT.w / FIELD.width;
const SY = FIELD_RECT.h / FIELD.height;
const toX = (x: number) => FIELD_RECT.x + x * SX;
const toY = (y: number) => FIELD_RECT.y + y * SY;
const WORD_STYLE = { fontFamily: FONT_WORD, fontSize: '32px', fontStyle: '700', color: INK };
const PLUNGE_COLOR = [0, 0xffd60a, 0xff8a1a, 0xff2a3a];
const COUNTER = { x: 200, y: 62 };
const COMBO_TUBE = { x: 42, w: 116, top: 236, bottom: 548 };
const RUSH_TUBE = { x: 242, w: 116, top: 236, bottom: 548 };
const PAPER = { x: 262, y: 716 };


class ScrollView extends Phaser.GameObjects.Container {
  private readonly img: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly done: Phaser.GameObjects.Text;
  private readonly rest: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly tag: Phaser.GameObjects.Text;
  private typedCount = -1;
  plunge = 0;
  readonly scrollWidth: number;

  constructor(scene: Phaser.Scene, readonly word: WordState) {
    super(scene, toX(word.x), toY(word.y));
    this.rest = scene.add.text(0, 0, word.text, WORD_STYLE).setOrigin(0, 0.5);
    this.done = scene.add.text(0, 0, '', { ...WORD_STYLE, color: RUBRIC, stroke: '#ffe08a', strokeThickness: 2 }).setOrigin(0, 0.5);
    this.scrollWidth = Math.ceil((this.rest.width + 70 + (word.spell ? 30 : 0)) / 16) * 16;
    this.glow = scene.add.image(0, 0, 'typel-glow-gold').setDisplaySize(this.scrollWidth + 90, 130).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.ring = scene.add.graphics();
    this.img = scene.add.image(0, 0, scrollKey(scene, this.scrollWidth, word.spell));
    this.tag = scene.add.text(0, -44, 'CATCH!', { fontFamily: FONT_ARCADE, fontSize: '22px', color: '#ffffff', stroke: '#b00018', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    this.add([this.glow, this.ring, this.img, this.done, this.rest, this.tag]);
    this.img.setInteractive({ useHandCursor: true }).setData('wordId', word.id);
    this.setTyped(word.typed);
    scene.add.existing(this);
    this.setDepth(10);
  }

  /** Returns where a letter was un-inked if the typed count went down. */
  setTyped(n: number): { x: number; ch: string } | null {
    if (n === this.typedCount) return null;
    const prev = this.typedCount;
    this.typedCount = n;
    const full = this.word.text;
    const shift = this.word.spell ? -15 : 0;
    this.done.setText(full.slice(0, n));
    this.rest.setText(full.slice(n));
    const total = this.done.width + this.rest.width;
    this.done.setX(-total / 2 + shift);
    this.rest.setX(-total / 2 + this.done.width + shift);
    if (prev > n && prev > 0) return { x: this.x + this.rest.x + 9, ch: full[n] ?? '' };
    return null;
  }

  setTarget(on: boolean): void {
    this.glow.setAlpha(on ? 0.75 : 0);
    this.setScale(on ? 1.08 : 1);
    this.setDepth(on ? 12 : this.plunge ? 11 : 10);
  }

  setFrozen(on: boolean): void {
    if (on) this.img.setTint(0xbff6ff);
    else this.img.clearTint();
  }

  setPlunge(tier: number): void {
    this.plunge = tier;
    const c = PLUNGE_COLOR[tier] ?? 0xffffff;
    this.ring.clear().lineStyle(6, c, 0.95).strokeRoundedRect(-this.scrollWidth / 2 - 6, -32, this.scrollWidth + 12, 64, 18);
    this.tag.setAlpha(1).setText(tier === 3 ? 'CATCH IT!!' : tier === 2 ? 'CATCH IT!' : 'CATCH!');
    this.tag.setStroke(Phaser.Display.Color.IntegerToColor(c).rgba, 6);
  }
}

function scrollKey(scene: Phaser.Scene, w: number, spell: SpellId | null): string {
  const key = `typel-scroll2-${w}-${spell ?? 'plain'}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, w, 54)!;
    paintScroll(tex.getContext(), w, 54, spell);
    tex.refresh();
  }
  return key;
}

export class TypelPlayScene extends Phaser.Scene {
  static readonly KEY = 'typel-play';
  private setup!: PlaySetup;
  engine!: GameEngine;
  private views = new Map<number, ScrollView>();
  private acc = 0;
  private paused = false;
  private ended = false;
  private reduced = false;
  private wizard!: Wizard;

  private paper!: Phaser.GameObjects.Text;
  private caret!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private shownScore = 0;
  private equation!: Phaser.GameObjects.Container;
  private comboFill!: Phaser.GameObjects.Graphics;
  private comboMult!: Phaser.GameObjects.Text;
  private comboCount!: Phaser.GameObjects.Text;
  private rushFill!: Phaser.GameObjects.Graphics;
  private rushMult!: Phaser.GameObjects.Text;
  private rushState!: Phaser.GameObjects.Text;
  private rushBubbles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private rushEruption!: Phaser.GameObjects.Particles.ParticleEmitter;
  private edges: Phaser.GameObjects.Image[] = [];
  private lastRush = 1;
  private lastMult = 1;
  private floor!: Phaser.GameObjects.Graphics;
  private floorLeft!: Phaser.GameObjects.Text;
  private floorRight!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Rectangle;
  private allInVeil!: Phaser.GameObjects.Rectangle;
  private rack = new Map<SpellId, { count: Phaser.GameObjects.Text; slot: Phaser.GameObjects.Container; learned: boolean; y: number }>();
  private poolText!: Phaser.GameObjects.Text;
  private keys = new Map<string, Phaser.GameObjects.Container>();
  private trails = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();
  private pressureTimer = 0;
  private time0 = 0;

  constructor() {
    super(TypelPlayScene.KEY);
  }

  init(setup: PlaySetup): void {
    this.setup = setup;
    this.views = new Map();
    this.rack = new Map();
    this.keys = new Map();
    this.trails = new Map();
    this.edges = [];
    this.acc = 0;
    this.paused = false;
    this.ended = false;
    this.lastRush = 1;
    this.reduced = prefs.reducedMotion();
    this.engine = new GameEngine({
      config: setup.config,
      seed: setup.seed ?? Math.floor(Math.random() * 2 ** 31),
      words: WORDS,
      hardcore: setup.hardcore,
      experimentalScoring: true,
      initialSpells: setup.initialSpells,
      initialInstability: setup.initialInstability,
      initialWard: setup.initialWard,
      initialCombo: setup.initialCombo,
      initialWords: setup.initialWords,
      poolLimitOverride: setup.poolLimitOverride,
    });
    this.shownScore = setup.scoreOffset ?? 0;
    this.lastMult = 1 + Math.floor((setup.initialCombo ?? 0) / 10);
  }

  create(): void {
    ensureTextures(this);
    buildRoom(this, true);
    // D-087: seen from behind, over the left shoulder, hands on the keys.
    this.wizard = new Wizard(this, 108, 846, this.reduced);
    this.wizard.hands[0].setPosition(222, 884).setData('y', 884);
    this.wizard.hands[1].setPosition(322, 870).setData('y', 870);
    this.buildHud();
    this.bindEvents();
    this.bindInput();
    for (const w of this.engine.state.words) this.addView(w);
    this.refreshRack();
    this.setPaper('', true);
    sound.setMood(this.setup.boss ? 'boss' : 'play');
    if (this.setup.boss) sound.bossStart();
    this.banner(this.setup.title, this.setup.subtitle);
    if (this.setup.lines?.length) this.showLines(this.setup.lines);
    (window as unknown as { typelEngine?: GameEngine }).typelEngine = this.engine;
  }

  // ───────────────────────── HUD ─────────────────────────

  private text(x: number, y: number, s: string, size: number, color: string, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, { fontFamily: FONT_BODY, fontSize: `${size}px`, color, ...opts }).setDepth(30);
  }

  private buildHud(): void {
    this.scoreText = this.text(COUNTER.x, COUNTER.y, this.shownScore.toLocaleString('en-US'), 58, '#ffd35a', { fontFamily: FONT_ARCADE, stroke: '#5a1a00', strokeThickness: 6 }).setOrigin(0.5);
    this.equation = this.add.container(200, 138).setDepth(30);

    this.comboFill = this.add.graphics().setDepth(21);
    this.rushFill = this.add.graphics().setDepth(21);
    this.comboMult = this.text(100, 300, '×1', 46, '#ffffff', { fontFamily: FONT_ARCADE, stroke: '#0b2a7a', strokeThickness: 7 }).setOrigin(0.5);
    this.comboCount = this.text(100, 522, '0', 22, '#cfe2ff', { fontFamily: FONT_ARCADE, stroke: '#0b2a7a', strokeThickness: 5 }).setOrigin(0.5);
    this.rushMult = this.text(300, 300, '×1', 46, '#ffffff', { fontFamily: FONT_ARCADE, stroke: '#0b5a2a', strokeThickness: 7 }).setOrigin(0.5);
    this.rushState = this.text(300, 522, '', 18, '#d6ffe6', { fontFamily: FONT_ARCADE, stroke: '#0b5a2a', strokeThickness: 5 }).setOrigin(0.5);
    this.rushBubbles = this.add.particles(0, 0, 'typel-spark', {
      x: { min: RUSH_TUBE.x + 14, max: RUSH_TUBE.x + RUSH_TUBE.w - 14 }, y: RUSH_TUBE.bottom - 8, lifespan: 1400, speedY: { min: -160, max: -60 },
      scale: { start: 0.35, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0x7dffb5, 0xffffff, 0xffe08a], blendMode: 'ADD', frequency: 90, emitting: false,
    }).setDepth(22);
    this.rushEruption = this.add.particles(300, 200, 'typel-star', {
      lifespan: 1100, speedY: { min: -320, max: -120 }, speedX: { min: -120, max: 120 }, gravityY: 260, scale: { start: 0.6, end: 0 },
      tint: [0x3ddc84, 0xffd35a, 0xffffff, 0xff5fa8], blendMode: 'ADD', frequency: 60, emitting: false,
    }).setDepth(31);
    for (const side of [0, 1]) {
      const e = this.add.image(side ? FIELD_RECT.x + FIELD_RECT.w : FIELD_RECT.x, FIELD_RECT.h / 2, 'typel-edge')
        .setOrigin(side ? 1 : 0, 0.5).setDisplaySize(140, FIELD_RECT.h).setTint(0x3ddc84).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
      if (side) e.setFlipX(true);
      this.edges.push(e);
    }

    const sheet = this.add.graphics().setDepth(23);
    // the sheet stands up out of the platen, facing us and the wizard
    sheet.fillStyle(0x000000, 0.35).fillRect(176, 670, 184, 98);
    sheet.fillStyle(0xf3e8cc, 1).fillRect(172, 664, 180, 102).fillStyle(0xd9c497, 1).fillRect(172, 748, 180, 18);
    sheet.lineStyle(1, 0xb08a58, 0.35);
    for (let y = 690; y < 748; y += 22) sheet.lineBetween(182, y, 342, y);
    this.paper = this.text(PAPER.x, PAPER.y, '', 34, INK, { fontFamily: FONT_WORD, fontStyle: '700' }).setOrigin(0.5).setDepth(24);
    this.caret = this.add.rectangle(PAPER.x, PAPER.y, 3, 32, hexNum(RUBRIC)).setDepth(24);
    this.tweens.add({ targets: this.caret, alpha: 0.15, duration: 520, yoyo: true, repeat: -1 });

    this.floor = this.add.graphics().setDepth(8);
    this.floorLeft = this.text(FLOOR.x + 24, FLOOR.y + 18, '', 20, '#ffe9b0', { fontFamily: FONT_ARCADE }).setDepth(9);
    this.floorRight = this.text(FLOOR.x + FLOOR.w - 24, FLOOR.y + 18, '', 22, '#ffffff', { fontFamily: FONT_ARCADE, align: 'right' }).setOrigin(1, 0).setDepth(9);
    this.subtitle = this.text(FLOOR.x + FLOOR.w / 2, FLOOR.y + 78, '', 22, '#fff4d8', { align: 'center', wordWrap: { width: 720 }, stroke: '#1a0630', strokeThickness: 4 }).setOrigin(0.5).setDepth(9);

    this.overlay = this.add.rectangle(FIELD_RECT.x + FIELD_RECT.w / 2, FIELD_RECT.h / 2, FIELD_RECT.w, FIELD_RECT.h, 0x000000, 0).setDepth(7);
    this.allInVeil = this.add.rectangle(FIELD_RECT.x + FIELD_RECT.w / 2, FIELD_RECT.h / 2, FIELD_RECT.w, FIELD_RECT.h, 0xffb020, 0).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);

    this.buildRack();
    this.buildKeys();
  }

  private buildRack(): void {
    const g = this.add.graphics().setDepth(26);
    g.fillStyle(0x2a0f08, 0.55).fillRoundedRect(RACK_X + 4, 12, 260, 1056, 14).lineStyle(4, 0xffc94a, 0.9).strokeRoundedRect(RACK_X + 4, 12, 260, 1056, 14);
    this.text(RACK_X + 134, 26, 'SPELL RACK', 22, '#ffd35a', { fontFamily: FONT_ARCADE, stroke: '#3a1000', strokeThickness: 5 }).setOrigin(0.5, 0);
    this.poolText = this.text(RACK_X + 134, 56, '', 16, '#ffe9c0').setOrigin(0.5, 0);
    SPELL_ORDER.forEach((id, i) => {
      const y = 142 + i * 118;
      const learned = this.setup.spells.includes(id);
      const c = this.add.container(RACK_X + 16, y).setDepth(30).setAlpha(learned ? 1 : 0.25);
      const hue = hexNum(SPELL_HUE[id]);
      const board = this.add.graphics();
      board.fillStyle(0x8a4a22, 1).fillRoundedRect(-6, 40, 248, 14, 4).fillStyle(0xc27a3e, 1).fillRect(-6, 40, 248, 4);
      const vial = this.add.graphics();
      vial.fillStyle(hue, 0.35).fillCircle(36, 6, 34).fillStyle(hue, 1).fillCircle(36, 12, 26).lineStyle(3, 0xffffff, 0.7).strokeCircle(36, 6, 34);
      vial.fillStyle(0xffd977, 1).fillRoundedRect(28, -34, 16, 12, 3);
      vial.fillStyle(0xffffff, 0.5).fillEllipse(24, -4, 10, 18);
      const glyph = this.add.text(36, 10, SPELL_GLYPH[id], { fontFamily: 'serif', fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
      const name = this.add.text(80, -20, id.toUpperCase(), { fontFamily: FONT_ARCADE, fontSize: '24px', color: '#ffffff', stroke: '#3a1000', strokeThickness: 5 });
      const key = this.add.text(80, 10, this.setup.hardcore ? 'type the name' : `press ${i + 1}`, { fontFamily: FONT_BODY, fontSize: '16px', color: '#ffe0b0' });
      const count = this.add.text(230, 2, '0', { fontFamily: FONT_ARCADE, fontSize: '36px', color: '#ffe08a', stroke: '#3a1000', strokeThickness: 6 }).setOrigin(1, 0.5);
      c.add([board, vial, glyph, name, key, count]);
      this.rack.set(id, { count, slot: c, learned, y });
    });
  }

  private buildKeys(): void {
    // rows recede from the wizard toward the platen (perspective)
    KEY_ROWS.forEach(({ row, y, gap, scale }, r) => {
      const x0 = 262 - ((row.length - 1) * gap) / 2 + r * 4;
      [...row].forEach((ch, i) => {
        const c = this.add.container(x0 + i * gap, y).setDepth(24).setScale(scale);
        c.add([this.add.image(0, 0, 'typel-key'), this.add.text(0, 1, ch.toUpperCase(), { fontFamily: FONT_TITLE, fontSize: '13px', fontStyle: '700', color: '#eadfc4' }).setOrigin(0.5)]);
        c.setData('y', c.y);
        this.keys.set(ch, c);
      });
    });
  }

  private pressKey(ch: string): void {
    const k = this.keys.get(ch);
    if (!k) return;
    const base = k.getData('y') as number;
    this.tweens.killTweensOf(k);
    k.y = base + 4;
    this.tweens.add({ targets: k, y: base, duration: 90, ease: 'Quad.easeOut' });
  }

  /** Level title card that sweeps in over the field and away. */
  private banner(title: string, sub: string): void {
    const cx = FIELD_RECT.x + FIELD_RECT.w / 2;
    const t = this.text(cx, 380, title, 60, '#ffe9a8', { fontFamily: FONT_TITLE, fontStyle: '700', stroke: '#2a0040', strokeThickness: 10 }).setOrigin(0.5).setDepth(60);
    const s = this.text(cx, 450, sub, 28, '#ffffff', { fontFamily: FONT_ARCADE, stroke: '#2a0040', strokeThickness: 6 }).setOrigin(0.5).setDepth(60);
    for (const o of [t, s]) {
      o.setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
      this.tweens.add({ targets: o, alpha: 0, y: o.y - 40, delay: 1500, duration: 500, onComplete: () => o.destroy() });
    }
  }

  /** Master lines, shown as subtitles on the Ward floor. */
  showLines(lines: readonly Line[]): void {
    let i = 0;
    const next = () => {
      const line = lines[i++];
      if (!line) return void this.tweens.add({ targets: this.subtitle, alpha: 0, duration: 500 });
      this.subtitle.setText(`${line.who}:  ${line.text}`).setAlpha(0);
      this.tweens.add({ targets: this.subtitle, alpha: 1, duration: 250 });
      this.time.delayedCall(Math.max(4800, line.text.length * 60), next);
    };
    this.time.delayedCall(1600, next);
  }

  // ───────────────────────── engine events ─────────────────────────

  private bindEvents(): void {
    const ev = this.engine.events;
    const cx = FIELD_RECT.x + FIELD_RECT.w / 2;
    ev.on('wordSpawned', ({ word }) => this.addView(word));
    ev.on('wordProgress', ({ word }) => this.views.get(word.id)?.setTyped(word.typed));
    ev.on('targetChanged', ({ previousId, currentId }) => {
      if (previousId !== null) this.views.get(previousId)?.setTarget(false);
      if (currentId !== null) this.views.get(currentId)?.setTarget(true);
    });
    ev.on('inputChanged', ({ input, valid }) => this.setPaper(input, valid));
    ev.on('wordCompleted', ({ word, points, combo, perfect, volley }) => {
      const at = this.posOf(word);
      this.stopTrail(word.id);
      this.collectView(word.id, false);
      sound.capture(combo, volley ?? 1, perfect === true);
      this.captureBurst(at.x, at.y, word.text, combo);
      const base = (word.originalLength ?? word.text.length) * 10;
      this.tally(base, 1 + Math.floor(combo / 10), volley ?? 1, this.engine.wardInfo.allInMultiplier, points);
      this.floatPoints(at.x, at.y, points);
      this.wizard.captured(points >= 300);
      if (word.plunge) this.callout(at.x, at.y - 60, word.plunge === 3 ? 'DARING RESCUE!' : 'SAVED!', '#ffffff', 30, '#d0002a');
    });
    ev.on('typingError', ({ wordId }) => {
      sound.typo();
      this.wizard.mistyped();
      const v = wordId !== null ? this.views.get(wordId) : null;
      if (v && !this.reduced) this.tweens.add({ targets: v, angle: { from: -5, to: 0 }, duration: 220, ease: 'Elastic.easeOut' });
    });
    ev.on('wordPlunged', ({ word, tier }) => {
      const v = this.views.get(word.id);
      if (!v) return;
      v.setPlunge(tier);
      sound.plunge(tier);
      this.wizard.plunging();
      this.startTrail(v, tier);
    });
    ev.on('submitMissed', () => {
      sound.wrongEntry();
      this.wizard.mistyped();
      if (!this.reduced) this.tweens.add({ targets: this.paper, x: PAPER.x + 6, duration: 40, yoyo: true, repeat: 3, onComplete: () => this.paper.setX(PAPER.x) });
    });
    ev.on('wordMissed', ({ word }) => {
      const v = this.views.get(word.id);
      this.stopTrail(word.id);
      if (v) this.burst(v.x, WARD_Y - 6, 0xff3a4a, 26);
      this.removeView(word.id);
      sound.breach();
      this.wizard.breached();
      if (!this.reduced) this.cameras.main.shake(200, 0.006);
      this.floorFlash(0xff3a4a);
    });
    ev.on('wordBlocked', ({ word }) => {
      const v = this.views.get(word.id);
      this.stopTrail(word.id);
      if (v) this.burst(v.x, WARD_Y - 6, 0x8fb8ff, 20);
      this.removeView(word.id);
      sound.spell('barrier');
      this.floorFlash(0x8fb8ff);
    });
    ev.on('spellCollected', ({ spell, stored, x, y }) => this.claimSpell(spell, stored, toX(x), toY(y)));
    ev.on('manaPoolChanged', () => this.refreshRack());
    ev.on('spellCast', ({ spell }) => {
      if (spell !== 'wind') sound.spell(spell);
      this.refreshRack();
      const tip = this.wizard.cast();
      this.burst(tip.x, tip.y, hexNum(SPELL_HUE[spell]), 18);
      const slot = this.rack.get(spell);
      if (slot) this.tweens.add({ targets: slot.slot, scale: 1.12, duration: 110, yoyo: true });
      this.callout(cx, 120, spell.toUpperCase(), SPELL_HUE[spell], 44, '#1a0630');
    });
    ev.on('spellFizzled', ({ spell }) => {
      sound.fizzle();
      const slot = this.rack.get(spell);
      if (slot && !this.reduced) this.tweens.add({ targets: slot.slot, x: slot.slot.x + 6, duration: 40, yoyo: true, repeat: 2 });
    });
    ev.on('slowChanged', ({ stacks }) => this.mood(stacks > 0 ? 'slow' : null));
    ev.on('freezeChanged', ({ ticks }) => {
      this.mood(ticks > 0 ? 'ice' : null);
      for (const v of this.views.values()) v.setFrozen(ticks > 0);
      if (ticks > 0) for (const v of this.views.values()) this.burst(v.x, v.y, 0xbff6ff, 8);
    });
    ev.on('iceMelting', () => {
      sound.thaw();
      this.callout(cx, 360, 'Board clear! The ice melts…', '#bff6ff', 34, '#0a3a5a');
    });
    ev.on('spellEnded', ({ spell }) => {
      if (spell === 'ice') for (const v of this.views.values()) v.setFrozen(false);
      if (spell === 'ice' || spell === 'slow') this.mood(this.engine.state.slowStacks.length > 0 ? 'slow' : null);
    });
    ev.on('iceFocus', ({ gain }) => {
      sound.focus(gain);
      this.callout(100, 380, `FOCUS +${gain}`, '#bff6ff', 30, '#0a3a5a');
    });
    ev.on('scoreInsured', () => {
      sound.spell('barrier');
      this.callout(100, 380, 'COMBO SAVED', '#cfe2ff', 26, '#0b2a7a');
      this.floorFlash(0x8fb8ff);
    });
    ev.on('wordsBurned', ({ words, depths, links }) => {
      const pos = new Map(words.map((w) => [w.id, this.posOf(w)]));
      words.forEach((w, i) => {
        const p = pos.get(w.id)!;
        const v = this.views.get(w.id);
        this.views.delete(w.id);
        this.stopTrail(w.id);
        this.time.delayedCall((depths?.[i] ?? 0) * 140, () => (this.fire(p.x, p.y), v?.destroy()));
      });
      for (const l of links ?? []) {
        const a = pos.get(l.from);
        const b = pos.get(l.to);
        if (a && b) this.time.delayedCall(Math.max(0, l.depth * 140 - 70), () => this.bolt(a, b, 0xff8a2a, false));
      }
      if (words.length >= 5) this.callout(cx, 420, `INFERNO ×${words.length}`, '#ffb070', 46, '#5a1000');
    });
    ev.on('wordsShocked', ({ words, links }) => {
      const pos = new Map(words.map((w) => [w.id, this.posOf(w)]));
      // D-086: lightning rises from the Ward floor into the three nearest words.
      for (const w of words.slice(0, 3)) {
        const p = pos.get(w.id)!;
        this.bolt({ x: p.x + (Math.random() - 0.5) * 80, y: WARD_Y + 30 }, p, 0xfff27a, true);
      }
      for (const l of links ?? []) {
        const a = pos.get(l.from);
        const b = pos.get(l.to);
        if (a && b) this.time.delayedCall(l.depth * 90, () => (this.bolt(a, b, 0xfff27a, true), sound.shockArc(l.depth)));
      }
      for (const w of words) {
        this.stopTrail(w.id);
        this.collectView(w.id, true);
      }
      if (!this.reduced) this.cameras.main.flash(90, 255, 250, 180, false);
      this.floorFlash(0xfff27a);
      this.callout(cx, 420, words.length > 3 ? `CHAIN ×${words.length}!` : 'ZAP!', '#fff27a', 52, '#3a3000');
    });
    ev.on('wordsHarvested', ({ words, points, volley, allIn }) => {
      words.forEach((w, i) => this.time.delayedCall(i * 45, () => (this.stopTrail(w.id), this.collectView(w.id, true))));
      const parts = [`HARVEST +${points}`, allIn && allIn > 1 ? `ALL-IN ×${allIn}` : '', volley && volley > 1 ? `RUSH ×${volley.toFixed(1)} SPENT` : ''].filter(Boolean);
      this.callout(cx, 400, parts.join('  ·  '), '#ffd35a', 44, '#4a2a00');
      this.confetti(60);
      if (!this.reduced) this.cameras.main.flash(180, 255, 200, 80, false);
    });
    ev.on('wordsTransmuted', ({ words }) => {
      for (const w of words) {
        const v = this.views.get(w.id);
        if (!v) continue;
        this.burst(v.x, v.y, 0xff5fa8, 12);
        this.stopTrail(w.id);
        v.destroy();
        this.views.delete(w.id);
        this.addView(w);
      }
    });
    ev.on('windCast', ({ outcome, cap, scar, endedAllIn }) => {
      this.gust(outcome === 'wager' ? 1 : 0.6);
      if (outcome === 'wager') {
        sound.wager();
        this.callout(cx, 360, `ALL IN!  ×${this.engine.wardInfo.allInMultiplier}`, '#ffd35a', 72, '#6a0010');
        this.callout(cx, 440, `The Ward is scarred −${scar}  ·  max ${cap}%`, '#ffb0b0', 26, '#3a0010');
        this.wizard.cheer();
      } else if (outcome === 'heal') {
        sound.gust(0.7);
        sound.heal();
        this.callout(cx, 400, cap < 100 ? `WARD MENDED · ${cap}%` : 'WARD MENDED', '#7dffb5', 44, '#0a3a1a');
        if (endedAllIn) this.callout(cx, 456, 'All-In released', '#ffffff', 24, '#1a0630');
      } else {
        sound.gust(0.6);
        this.callout(cx, 400, 'A calm breeze · too scarred to wager', '#e0ffe8', 30, '#1a0630');
      }
    });
    ev.on('allInChanged', ({ active, reason }) => {
      this.tweens.add({ targets: this.allInVeil, fillAlpha: active ? 0.14 : 0, duration: 400 });
      if (!active && (reason === 'breach' || reason === 'mistake')) this.callout(cx, 400, 'ALL-IN BROKEN', '#ff8080', 46, '#3a0010');
      if (!active && reason === 'expired') this.callout(cx, 400, 'All-In fades', '#ffffff', 30, '#1a0630');
    });
    ev.on('runeAwarded', ({ id, name, points }) => {
      const tier = RUNE_BY_ID.get(id)?.tier ?? 1;
      sound.rune(tier);
      prefs.noteRune(id);
      this.runeToast(name, points, tier);
    });
    ev.on('gameOver', ({ result }) => {
      this.ended = true;
      if (result === 'won') {
        sound.levelClear();
        this.wizard.cheer();
        this.confetti(90);
      } else sound.defeat();
      this.time.delayedCall(result === 'won' ? 900 : 1300, () => this.finish(result));
    });
  }

  private posOf(w: WordState): { x: number; y: number } {
    const v = this.views.get(w.id);
    return { x: v?.x ?? toX(w.x), y: v?.y ?? toY(w.y) };
  }

  private finish(result: GameResult): void {
    const s = this.engine.state;
    const w = this.engine.wardInfo;
    this.setup.onEnd(result, this.engine.stats(), {
      spells: { ...s.spells },
      instability: s.instability,
      ward: { cap: w.cap, wagers: w.wagers },
      combo: s.combo,
      words: s.words.map((x) => ({ ...x })),
    });
  }

  // ───────────────────────── input ─────────────────────────

  private bindInput(): void {
    const kb = this.input.keyboard!;
    kb.addCapture('BACKSPACE,ENTER,SPACE,TAB');
    kb.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!this.ended) this.pause();
        return;
      }
      if (this.paused || this.ended || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') return this.erase();
      if (e.key === 'Enter') return this.engine.submit();
      if (/^[1-8]$/.test(e.key) && !this.setup.hardcore) {
        const spell = SPELL_ORDER[Number(e.key) - 1]!;
        if (this.setup.spells.includes(spell)) this.engine.quickCast(spell);
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key) && this.engine.typeChar(e.key)) {
        sound.key(e.key);
        this.pressKey(e.key.toLowerCase());
        this.wizard.typed();
      }
    });
    this.input.on('gameobjectdown', (_p: unknown, obj: Phaser.GameObjects.GameObject) => {
      const id = obj.getData('wordId') as number | undefined;
      if (typeof id === 'number' && !this.paused && !this.ended) this.engine.selectTarget(id);
    });
  }

  /**
   * Backspace (D-086): as satisfying as typing. The letter un-inks from the
   * scroll and the paper and drips away; the carriage clicks back.
   */
  private erase(): void {
    const before = this.engine.state.input;
    if (!this.engine.backspace()) return;
    sound.erase(before.length);
    this.wizard.typed();
    this.inkDrop(PAPER.x + this.paper.width / 2, PAPER.y, before.at(-1) ?? '', '#2b1606');
    for (const v of this.views.values()) {
      const off = v.setTyped(v.word.typed);
      if (off) this.inkDrop(off.x, v.y, off.ch, RUBRIC);
    }
  }

  private inkDrop(x: number, y: number, ch: string, color: string): void {
    const t = this.text(x, y, ch, 32, color, { fontFamily: FONT_WORD, fontStyle: '700' }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y + 44, scaleX: 0.4, scaleY: 1.6, alpha: 0, duration: 380, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
    const drop = this.add.circle(x, y + 12, 5, hexNum(color), 0.85).setDepth(40);
    this.tweens.add({ targets: drop, y: y + 72, alpha: 0, duration: 520, ease: 'Quad.easeIn', onComplete: () => drop.destroy() });
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.setup.onPause();
  }

  resume(): void {
    this.paused = false;
    this.acc = 0;
  }

  continueEndless(config: DifficultyConfig, title: string): void {
    this.engine.continueIntoEndless(config);
    this.ended = false;
    this.paused = false;
    this.setup = { ...this.setup, boss: false, title, subtitle: 'Endless · the pace keeps rising' };
    this.banner(title, this.setup.subtitle);
    sound.setMood('boss');
  }

  stats(): GameStats {
    return this.engine.stats();
  }

  // ───────────────────────── frame ─────────────────────────

  override update(time: number, delta: number): void {
    this.time0 = time;
    if (!this.paused && !this.ended) {
      this.acc += Math.min(delta, 250);
      while (this.acc >= SIMULATION_STEP_MS && this.engine.status === 'playing') {
        this.engine.step();
        this.acc -= SIMULATION_STEP_MS;
      }
    }
    const alpha = this.acc / SIMULATION_STEP_MS;
    let target: ScrollView | null = null;
    let lowest: ScrollView | null = null;
    for (const v of this.views.values()) {
      const w = v.word;
      v.setPosition(toX(w.x), toY(w.prevY + (w.y - w.prevY) * Math.min(1, alpha)));
      v.setTyped(w.typed);
      if (w.isTarget) target = v;
      if (!lowest || v.y > lowest.y) lowest = v;
      this.trails.get(w.id)?.setPosition(v.x, v.y - 20);
    }
    const look = target ?? lowest;
    if (look) this.wizard.lookAt(look.x, look.y);
    this.wizard.tickFrame(delta);
    this.refreshHud(delta);
  }

  private refreshHud(delta: number): void {
    const e = this.engine;
    const s = e.state;
    const goal = (this.setup.scoreOffset ?? 0) + s.score;
    if (this.shownScore !== goal) {
      this.shownScore += Math.max(1, Math.ceil((goal - this.shownScore) * Math.min(1, delta / 140)));
      if (this.shownScore > goal) this.shownScore = goal;
      this.scoreText.setText(this.shownScore.toLocaleString('en-US'));
    }
    // Combo column: progress to the next multiplier
    const mult = 1 + Math.floor(s.combo / 10);
    const span = COMBO_TUBE.bottom - COMBO_TUBE.top - 16;
    const ch = span * ((s.combo % 10) / 10);
    const cf = this.comboFill.clear();
    if (ch > 0) cf.fillStyle(0x2f8cff, 0.9).fillRoundedRect(COMBO_TUBE.x + 8, COMBO_TUBE.bottom - 8 - ch, COMBO_TUBE.w - 16, ch, Math.min(30, ch / 2));
    for (let i = 1; i < 10; i++) {
      const y = COMBO_TUBE.bottom - 8 - (span * i) / 10;
      cf.lineStyle(2, 0xffffff, i <= s.combo % 10 ? 0.9 : 0.3).lineBetween(COMBO_TUBE.x + 74, y, COMBO_TUBE.x + COMBO_TUBE.w - 10, y);
    }
    this.comboMult.setText(`×${mult}`);
    this.comboCount.setText(`${s.combo}`);
    if (mult > this.lastMult) this.comboUp(mult);
    this.lastMult = mult;
    // Arcane Rush column (internally the Arcane Volley multiplier)
    const v = e.volleyMultiplier;
    const armed = e.volleyArmedProgress;
    const level = v > 1 ? Math.min(1, Math.log(v) / Math.log(6)) : armed * 0.05;
    const rh = (RUSH_TUBE.bottom - RUSH_TUBE.top - 16) * level;
    const hot = v >= 2;
    const rf = this.rushFill.clear();
    if (rh > 0) rf.fillStyle(hot ? 0x7dffb5 : 0x3ddc84, hot ? 0.75 + 0.25 * Math.sin(this.time0 / 90) : 0.85).fillRoundedRect(RUSH_TUBE.x + 8, RUSH_TUBE.bottom - 8 - rh, RUSH_TUBE.w - 16, rh, Math.min(30, rh / 2));
    if (armed > 0) rf.fillStyle(0xffd35a, 1).fillRoundedRect(RUSH_TUBE.x + 10, RUSH_TUBE.top + 2, (RUSH_TUBE.w - 20) * armed, 10, 5);
    this.rushMult.setText(v > 1 ? `×${v.toFixed(1)}` : '×1');
    this.rushMult.setScale(hot && !this.reduced ? 1 + 0.06 * Math.sin(this.time0 / 70) : 1);
    this.rushState.setText(v >= 5 ? 'MASTERY!' : hot ? 'RUSHING!' : v > 1 ? 'BUILDING' : armed > 0 ? 'LINK NEXT!' : '');
    if (v > this.lastRush + 0.05) {
      sound.volleyStep(v);
      if (v >= 2 && this.lastRush < 2) this.ignite('ARCANE RUSH!');
      if (v >= 5 && this.lastRush < 5) this.ignite('RUSH MASTERY!');
    } else if (v === 1 && this.lastRush >= 1.2) {
      sound.volleyBreak();
      if (this.lastRush >= 2) this.callout(300, 380, 'RUSH LOST', '#ffb0b0', 28, '#3a0010');
    }
    this.lastRush = v;
    const edge = hot ? Math.min(0.75, 0.25 + (v - 2) * 0.15) : v > 1 ? 0.1 : 0;
    for (const img of this.edges) img.setAlpha(edge * (0.85 + 0.15 * Math.sin(this.time0 / 110))).setTint(v >= 5 ? 0xffd35a : 0x3ddc84);
    if (!this.reduced) {
      if (v > 1 && !this.rushBubbles.emitting) this.rushBubbles.start();
      if (v <= 1 && this.rushBubbles.emitting) this.rushBubbles.stop();
      this.rushBubbles.frequency = Math.max(20, 120 - v * 18);
      if (hot && !this.rushEruption.emitting) this.rushEruption.start();
      if (!hot && this.rushEruption.emitting) this.rushEruption.stop();
      this.rushEruption.frequency = Math.max(18, 90 - (v - 2) * 20);
    }
    this.wizard.setWonder(hot, v);
    const ward = e.wardInfo;
    this.wizard.setNervous(1 - ward.stability / 100);
    this.drawFloor();
    this.refreshFloorText();
    this.pressureTimer -= delta;
    if (this.pressureTimer <= 0) {
      this.pressureTimer = 400;
      const crowd = s.words.length / Math.max(4, e.config.maxActiveWords);
      const prog = e.config.requiredWords ? s.completed / e.config.requiredWords : 0.6;
      sound.setPressure(crowd * 0.65 + prog * 0.35, 1 - ward.stability / 100, hot ? Math.min(1, (v - 1) / 4) : 0);
    }
  }

  /** The Ward floor: living energy showing health, scars, shields and All-In. */
  private drawFloor(): void {
    const w = this.engine.wardInfo;
    const stab = Math.max(0, w.stability);
    const allIn = w.allInTicks > 0;
    const color = allIn ? 0xe0a030 : stab > 60 ? 0x3a8f86 : stab > 30 ? 0xc88a2a : 0xc0302a;
    const g = this.floor.clear();
    g.fillStyle(0x15111a, 1).fillRect(FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.h);
    const healthy = (FLOOR.w * stab) / 100;
    const capX = FLOOR.x + (FLOOR.w * w.cap) / 100;
    g.fillStyle(color, 0.3).fillRect(FLOOR.x, FLOOR.y, healthy, FLOOR.h);
    g.fillStyle(color, 0.95).fillRect(FLOOR.x, FLOOR.y, healthy, 6);
    const speed = 0.06 + (this.engine.volleyMultiplier - 1) * 0.06;
    for (let i = 0; i < 44; i++) {
      const x = FLOOR.x + ((i * 61 + this.time0 * speed) % FLOOR.w);
      if (x > FLOOR.x + healthy) continue;
      g.fillStyle(0xd8b870, 0.35).fillCircle(x, FLOOR.y + 20 + ((i * 37) % 100), i % 3 === 0 ? 3 : 2);
    }
    if (w.cap < 100) {
      g.fillStyle(0x3a0010, 0.95).fillRect(capX, FLOOR.y, FLOOR.x + FLOOR.w - capX, FLOOR.h);
      g.lineStyle(3, 0xff3a4a, 1).lineBetween(capX, FLOOR.y, capX, FLOOR.y + FLOOR.h);
      g.lineStyle(2, 0x8a1020, 1);
      for (let x = capX + 14; x < FLOOR.x + FLOOR.w - 10; x += 34) g.lineBetween(x, FLOOR.y + 8, x + 18, FLOOR.y + FLOOR.h - 8);
    }
    for (let i = 0; i < this.engine.state.barrier; i++) {
      g.fillStyle(0x8fb8ff, 0.4).fillCircle(FLOOR.x + 40 + i * 44, FLOOR.y - 18, 15);
      g.lineStyle(5, 0xcfe2ff, 0.95).strokeCircle(FLOOR.x + 40 + i * 44, FLOOR.y - 18, 15);
    }
    g.lineStyle(4, color, 0.6 + 0.4 * Math.sin(this.time0 / (stab < 30 ? 90 : 300))).lineBetween(FLOOR.x, WARD_Y, FLOOR.x + FLOOR.w, WARD_Y);
  }

  private refreshFloorText(): void {
    const e = this.engine;
    const rem = e.survivalRemainingMs;
    const progress = rem !== null && isSurvival(e.config)
      ? rem > 0 ? `Survive ${Math.ceil(rem / 1000)}s` : 'Clear the field!'
      : e.config.requiredWords ? `${e.state.completed} / ${e.config.requiredWords} scrolls` : `${e.state.completed} scrolls`;
    this.floorLeft.setText(`${this.setup.title}\n${progress}`);
    const w = e.wardInfo;
    const allIn = w.allInTicks > 0 ? `\nALL-IN ×${w.allInMultiplier} · ${Math.ceil((w.allInTicks * SIMULATION_STEP_MS) / 1000)}s` : '';
    this.floorRight.setText(`WARD ${Math.round(w.stability)}%${w.cap < 100 ? ` / ${w.cap}%` : ''}${allIn}`);
  }

  private refreshRack(): void {
    const s = this.engine.state;
    let held = 0;
    for (const [id, slot] of this.rack) {
      const n = s.spells[id] ?? 0;
      held += n;
      slot.count.setText(String(n));
      if (slot.learned) slot.slot.setAlpha(n > 0 ? 1 : 0.55);
    }
    this.poolText.setText(`charges ${held} / ${this.engine.poolLimit}`);
  }

  private setPaper(input: string, valid: boolean): void {
    this.paper.setText(input).setColor(valid ? INK : '#c4141e');
    this.paper.setScale(1);
    const max = 168;
    if (this.paper.width > max) this.paper.setScale(max / this.paper.width);
    this.caret.setX(PAPER.x + (this.paper.width * this.paper.scaleX) / 2 + 4);
  }

  // ───────────────────────── views and effects ─────────────────────────

  private addView(word: WordState): void {
    if (this.views.has(word.id)) return;
    const v = new ScrollView(this, word);
    if (this.engine.state.freezeTicks > 0) v.setFrozen(true);
    if (word.plunge) v.setPlunge(word.plunge);
    this.views.set(word.id, v);
    if (!this.reduced) {
      v.setScale(0.3).setAlpha(0);
      this.tweens.add({ targets: v, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    }
  }

  private removeView(id: number): void {
    this.views.get(id)?.destroy();
    this.views.delete(id);
  }

  private startTrail(v: ScrollView, tier: number): void {
    this.stopTrail(v.word.id);
    if (this.reduced) return;
    const em = this.add.particles(v.x, v.y - 20, 'typel-spark', {
      lifespan: 380, speedY: { min: -90, max: -30 }, speedX: { min: -30, max: 30 }, scale: { start: 0.5 + tier * 0.15, end: 0 },
      alpha: { start: 0.9, end: 0 }, tint: PLUNGE_COLOR[tier], blendMode: 'ADD', frequency: 40 - tier * 8,
    }).setDepth(9);
    this.trails.set(v.word.id, em);
  }

  private stopTrail(id: number): void {
    const em = this.trails.get(id);
    if (!em) return;
    em.stop();
    this.time.delayedCall(500, () => em.destroy());
    this.trails.delete(id);
  }

  /** A captured scroll is swept into the typewriter. */
  private collectView(id: number, spellish: boolean): void {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    v.setDepth(35);
    this.tweens.add({ targets: v, x: PAPER.x, y: PAPER.y - 20, scale: 0.15, alpha: 0.3, angle: spellish ? 180 : 0, duration: spellish ? 420 : 260, ease: 'Cubic.easeIn', onComplete: () => v.destroy() });
  }

  /** Capture: a burst of stars; the word's letters fly into the arcade counter. */
  private captureBurst(x: number, y: number, text: string, combo: number): void {
    const tints = combo >= 30 ? [0xff5fa8, 0xffd35a, 0x26d9e8, 0x3ddc84] : combo >= 10 ? [0xffd35a, 0x26d9e8] : [0xffd35a];
    const em = this.add.particles(x, y, 'typel-star', {
      lifespan: 650, speed: { min: 120, max: 360 }, scale: { start: 0.55, end: 0 }, rotate: { min: 0, max: 360 }, tint: tints, blendMode: 'ADD', emitting: false,
    }).setDepth(36);
    em.explode(this.reduced ? 6 : 14 + Math.min(16, combo));
    this.time.delayedCall(800, () => em.destroy());
    if (this.reduced) return;
    [...text.slice(0, 10)].forEach((ch, i) => {
      const t = this.text(x - text.length * 9 + i * 18, y, ch.toUpperCase(), 26, '#ffe08a', { fontFamily: FONT_ARCADE, stroke: '#5a1a00', strokeThickness: 4 }).setOrigin(0.5).setDepth(50);
      this.tweens.add({
        targets: t, x: { value: COUNTER.x, ease: 'Sine.easeIn' }, y: { value: COUNTER.y, ease: 'Back.easeIn' }, scale: 0.5, delay: 120 + i * 35, duration: 520,
        onComplete: () => {
          t.destroy();
          this.tweens.add({ targets: this.scoreText, scale: 1.08, duration: 50, yoyo: true });
        },
      });
    });
  }

  /** Balatro-style tally: BASE × COMBO × RUSH (× ALL-IN) = points, chip by chip. */
  private tally(base: number, combo: number, rush: number, allIn: number, points: number): void {
    this.equation.removeAll(true);
    const chips: [string, string, number][] = [[`${base}`, 'BASE', 0x7a2a00], [`×${combo}`, 'COMBO', 0x0b3aa0], [`×${rush.toFixed(1)}`, 'RUSH', 0x0b7a3a]];
    if (allIn > 1) chips.push([`×${allIn}`, 'ALL-IN', 0x8a0018]);
    chips.push([`${points}`, 'POINTS', 0x5a0090]);
    const gap = 360 / chips.length;
    chips.forEach(([val, label, c], i) => {
      const x = -180 + gap * (i + 0.5);
      const box = this.add.rectangle(x, 0, gap - 8, 46, c, 1).setStrokeStyle(2, 0xffd35a);
      const t = this.add.text(x, -5, val, { fontFamily: FONT_ARCADE, fontSize: val.length > 5 ? '17px' : '22px', color: '#ffffff' }).setOrigin(0.5);
      const l = this.add.text(x, 15, label, { fontFamily: FONT_BODY, fontSize: '11px', color: '#ffe9b0' }).setOrigin(0.5);
      const chip = this.add.container(0, 0, [box, t, l]).setScale(0);
      this.equation.add(chip);
      this.tweens.add({ targets: chip, scale: 1, delay: i * 70, duration: 160, ease: 'Back.easeOut', onStart: () => (i > 0 ? sound.tick(i) : undefined) });
    });
  }

  private floatPoints(x: number, y: number, points: number): void {
    const size = points >= 1000 ? 48 : points >= 300 ? 38 : 30;
    const color = points >= 1000 ? '#ff5fa8' : points >= 300 ? '#ffd35a' : '#ffffff';
    const t = this.text(x, y - 10, `+${points}`, size, color, { fontFamily: FONT_ARCADE, stroke: '#2a0040', strokeThickness: 6 }).setOrigin(0.5).setDepth(45);
    this.tweens.add({ targets: t, y: y - 80, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private callout(x: number, y: number, s: string, color: string, size: number, stroke = '#1a0630'): void {
    const t = this.text(x, y, s, size, color, { fontFamily: FONT_ARCADE, stroke, strokeThickness: Math.max(6, size / 6) }).setOrigin(0.5).setDepth(55).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: y - 40, delay: 850, duration: 600, onComplete: () => t.destroy() });
  }

  private comboUp(mult: number): void {
    sound.comboUp(mult);
    this.callout(FIELD_RECT.x + FIELD_RECT.w / 2, 300, `COMBO ×${mult}!`, '#8fd0ff', 64, '#0b2a7a');
    this.tweens.add({ targets: this.comboMult, scale: 1.5, duration: 140, yoyo: true });
    this.burst(100, 300, 0x8fd0ff, 30);
    if (mult >= 3) this.confetti(30 + mult * 6);
    this.wizard.cheer();
  }

  private ignite(label: string): void {
    sound.ignite();
    this.callout(FIELD_RECT.x + FIELD_RECT.w / 2, 240, label, '#7dffb5', 76, '#0b4a1a');
    this.burst(300, 260, 0x7dffb5, 40);
    if (!this.reduced) {
      this.cameras.main.flash(160, 120, 255, 170, false);
      const ring = this.add.circle(FIELD_RECT.x + FIELD_RECT.w / 2, FIELD_RECT.h / 2, 40, 0x7dffb5, 0).setStrokeStyle(10, 0x7dffb5, 0.9).setDepth(50);
      this.tweens.add({ targets: ring, radius: 900, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    }
    this.confetti(70);
  }

  private confetti(n: number): void {
    if (this.reduced) n = Math.ceil(n / 4);
    const em = this.add.particles(0, 0, 'typel-star', {
      x: { min: FIELD_RECT.x, max: FIELD_RECT.x + FIELD_RECT.w }, y: -20, lifespan: 1800, speedY: { min: 160, max: 380 }, speedX: { min: -80, max: 80 },
      rotate: { min: 0, max: 360 }, scale: { start: 0.45, end: 0.2 }, tint: [0xff5fa8, 0xffd35a, 0x26d9e8, 0x3ddc84, 0xa259ff], emitting: false,
    }).setDepth(54);
    em.explode(n);
    this.time.delayedCall(2000, () => em.destroy());
  }

  private runeToast(name: string, points: number, tier: number): void {
    const color = tier >= 3 ? '#ff9ad0' : tier === 2 ? '#d8e6ff' : '#ffe08a';
    const c = this.add.container(FIELD_RECT.x + FIELD_RECT.w / 2, -60).setDepth(58);
    const bg = this.add.rectangle(0, 0, 460, 74, 0x2a0040, 0.92).setStrokeStyle(4, hexNum(color));
    const t1 = this.add.text(0, -14, `RUNE · ${name}`, { fontFamily: FONT_ARCADE, fontSize: '28px', color }).setOrigin(0.5);
    const t2 = this.add.text(0, 20, `+${points}`, { fontFamily: FONT_ARCADE, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    c.add([bg, t1, t2]);
    this.tweens.add({ targets: c, y: 70, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, y: -60, delay: 1700, duration: 300, onComplete: () => c.destroy() });
    if (tier >= 2) this.confetti(25 * tier);
  }

  /** Claimed spell swishes to the rack and knocks into its shelf. */
  private claimSpell(spell: SpellId, stored: boolean, x: number, y: number): void {
    const slot = this.rack.get(spell);
    const tx = RACK_X + 52;
    const ty = (slot?.y ?? 500) + 6;
    const orb = this.add.container(x, y).setDepth(56);
    orb.add([
      this.add.image(0, 0, 'typel-glow-gold').setTint(hexNum(SPELL_HUE[spell])).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD),
      this.add.text(0, 0, SPELL_GLYPH[spell], { fontSize: '30px', color: '#ffffff' }).setOrigin(0.5),
    ]);
    sound.swish();
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x, y),
      new Phaser.Math.Vector2((x + tx) / 2, Math.min(y, ty) - 220),
      new Phaser.Math.Vector2(tx, ty),
    );
    const path = { t: 0 };
    this.tweens.add({
      targets: path, t: 1, duration: 520, ease: 'Sine.easeIn',
      onUpdate: () => {
        const p = curve.getPoint(path.t);
        orb.setPosition(p.x, p.y).setAngle(path.t * 540);
      },
      onComplete: () => {
        orb.destroy();
        if (!slot) return;
        if (stored) {
          sound.thunk();
          this.burst(tx, ty + 30, 0xc27a3e, 12);
          const baseX = RACK_X + 16;
          this.tweens.add({ targets: slot.slot, angle: { from: -7, to: 0 }, x: { from: baseX + 10, to: baseX }, duration: 420, ease: 'Elastic.easeOut' });
          this.tweens.add({ targets: slot.count, scale: 1.6, duration: 120, yoyo: true });
        } else {
          sound.overflow();
          this.callout(RACK_X + 134, ty, 'RACK FULL', '#ffb0b0', 24, '#3a0010');
        }
        this.refreshRack();
      },
    });
  }

  private burst(x: number, y: number, tint: number, n: number): void {
    if (this.reduced) n = Math.ceil(n / 3);
    const em = this.add.particles(x, y, 'typel-spark', {
      lifespan: 560, speed: { min: 80, max: 280 }, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 }, tint, blendMode: 'ADD', emitting: false,
    }).setDepth(36);
    em.explode(n);
    this.time.delayedCall(700, () => em.destroy());
  }

  private fire(x: number, y: number): void {
    const em = this.add.particles(x, y, 'typel-flame', {
      lifespan: 760, speedY: { min: -200, max: -50 }, speedX: { min: -70, max: 70 }, scale: { start: 1.4, end: 0.2 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', emitting: false,
    }).setDepth(36);
    em.explode(this.reduced ? 6 : 20);
    this.burst(x, y, 0xffa040, 12);
    this.time.delayedCall(950, () => em.destroy());
  }

  private bolt(a: { x: number; y: number }, b: { x: number; y: number }, color: number, jagged: boolean): void {
    const g = this.add.graphics().setDepth(37).setBlendMode(Phaser.BlendModes.ADD);
    const pts: { x: number; y: number }[] = [a];
    const n = jagged ? 8 : 4;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const off = jagged ? (Math.random() - 0.5) * 50 : Math.sin(t * Math.PI) * 22;
      pts.push({ x: a.x + (b.x - a.x) * t + off, y: a.y + (b.y - a.y) * t + off * 0.4 });
    }
    pts.push(b);
    for (const [w, al, c] of [[16, 0.3, color], [5, 1, 0xffffff]] as const) {
      g.lineStyle(w, c, al).beginPath();
      g.moveTo(pts[0]!.x, pts[0]!.y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.strokePath();
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 340, onComplete: () => g.destroy() });
  }

  private floorFlash(color: number): void {
    const r = this.add.rectangle(FLOOR.x + FLOOR.w / 2, FLOOR.y + FLOOR.h / 2, FLOOR.w, FLOOR.h, color, 0.6).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: r, alpha: 0, duration: 460, onComplete: () => r.destroy() });
  }

  private mood(kind: 'slow' | 'ice' | null): void {
    const color = kind === 'ice' ? 0x26d9e8 : kind === 'slow' ? 0xa259ff : 0x000000;
    this.overlay.setFillStyle(color, 1);
    this.tweens.add({ targets: this.overlay, alpha: kind ? 0.16 : 0, duration: 300 });
  }

  /** Wind gust: cosmetic tilt and streaks only (D-081). */
  private gust(strength: number): void {
    if (this.reduced) return;
    let i = 0;
    for (const v of this.views.values()) {
      const lean = (i++ % 2 ? 0.7 : 1) * 8 * strength;
      this.tweens.chain({ targets: v, tweens: [
        { angle: lean, duration: 220, ease: 'Sine.easeOut' },
        { angle: -lean * 0.4, duration: 360, ease: 'Sine.easeInOut' },
        { angle: 0, duration: 420, ease: 'Sine.easeOut' },
      ] });
    }
    for (let k = 0; k < 18; k++) {
      const y = 40 + Math.random() * (FIELD_RECT.h - 80);
      const streak = this.add.rectangle(FIELD_RECT.x - 100, y, 160 + Math.random() * 200, 3, 0xbfffd8, 0.55).setDepth(36);
      this.tweens.add({ targets: streak, x: FIELD_RECT.x + FIELD_RECT.w + 150, duration: 600 + Math.random() * 400, delay: Math.random() * 300, onComplete: () => streak.destroy() });
    }
  }
}
