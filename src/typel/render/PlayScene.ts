/**
 * Typel play scene. Rendering only reacts to engine events; cosmetic motion
 * never changes positions, speeds or hit tests.
 *
 * D-093: the scene is built on the owner's key-art painting (see keyart.ts).
 * The painting is the world; every element that shows game state (scrolls,
 * score drums, plates, tubes, keys, paper, shelf, gauge, medals, notes) is a
 * live object placed exactly where it sits in the painting.
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
import { SPELL_GLYPH, SPELL_HUE } from './paint';
import { ensureTextures, FONT_ARCADE, FONT_TITLE, FONT_WORD, FONT_BODY, hexNum } from './study';
import { buildWorld, gaugeAngle, KA, NEEDLE_PAINTED, PaintedHands, placed, preloadKeyart, type World } from './keyart';
import { voice } from '../voice';
import { MOCKERY, PRAISE, RUNE_CALLOUTS, SPECIAL, type VoiceLine } from '../voiceLines';
import type { RuneDef } from '../../gameplay/runes/RuneCatalogue';

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
  /** Practice views only: show the exact points each capture or cash-out earned (D-088). */
  showSequenceScore?: boolean;
  onEnd(result: GameResult, stats: GameStats, carry: Carry): void;
  onPause(): void;
}

/** D-093: the battlefield is the sky between the score engine and the shelf; the paper's top edge is the Ward. */
const FIELD_RECT = KA.field;
const WARD_Y = FIELD_RECT.y + FIELD_RECT.h;
const CX = FIELD_RECT.x + FIELD_RECT.w / 2;
const SX = FIELD_RECT.w / FIELD.width;
const SY = FIELD_RECT.h / FIELD.height;
const toX = (x: number) => FIELD_RECT.x + x * SX;
const toY = (y: number) => FIELD_RECT.y + y * SY;
const INK = '#1e1408';
const RUBRIC = '#b3261e';
/** Typewriter ink on the paper: oxblood, as in the painting. A wrong letter is a black smudge. */
const OXBLOOD = '#7a1410';
const SMUDGE = '#1a1212';
/** D-089: handwritten BLOCK capitals, slightly spaced, for legibility at speed. */
const WORD_STYLE = { fontFamily: FONT_WORD, fontSize: '29px', fontStyle: '700', color: INK, letterSpacing: 1.2 };
const PLUNGE_COLOR = [0, 0xffd60a, 0xff8a1a, 0xff2a3a];
const SCROLL = KA.sprites['scroll_plain']!;
/** D-095: scrolls ~15% larger than D-093 for readability. */
const SCROLL_SCALE = 0.99;
const SCROLL_H = SCROLL.h * SCROLL_SCALE;
const PAPER = { x: KA.paper.strikeX, y: KA.paper.baseline - 20 };
const PAPER_FONT = 56;
const DRUM_TEXT = { fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: '700', fontSize: '66px', color: '#3a140a' };
const DRUM_PITCH = 74;
const COUNTER = { x: (KA.drums.cells[0]![0] + KA.drums.cells[5]![1]) / 2, y: KA.drums.y };
const PLATE_TEXT = { fontFamily: FONT_ARCADE, fontStyle: '700', fontSize: '19px', color: '#2b1a0a' };
const COMBO_TUBE = KA.tubes.combo;
const RUSH_TUBE = KA.tubes.rush;

class ScrollView extends Phaser.GameObjects.Container {
  private readonly img: Phaser.GameObjects.NineSlice;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly done: Phaser.GameObjects.Text;
  private readonly rest: Phaser.GameObjects.Text;
  private readonly ring: Phaser.GameObjects.Image;
  private readonly brackets: Phaser.GameObjects.Graphics;
  private readonly stamp: Phaser.GameObjects.Image;
  private typedCount = -1;
  plunge = 0;
  readonly scrollWidth: number;

  constructor(scene: Phaser.Scene, readonly word: WordState) {
    super(scene, toX(word.x), toY(word.y));
    this.rest = scene.add.text(0, 0, word.text.toUpperCase(), WORD_STYLE).setOrigin(0, 0.5);
    this.done = scene.add.text(0, 0, '', { ...WORD_STYLE, color: RUBRIC, stroke: '#ffe08a', strokeThickness: 2 }).setOrigin(0, 0.5);
    this.scrollWidth = Math.ceil((this.rest.width + 76 + (word.spell ? 36 : 0)) / 8) * 8;
    this.glow = scene.add.image(0, 0, 'typel-glow-gold').setDisplaySize(this.scrollWidth + 90, 130).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    // the CATCH! halo: a red glow behind the falling scroll (as in the painting)
    this.ring = scene.add.image(0, 4, 'typel-glow-gold').setDisplaySize(this.scrollWidth * 1.5, 200).setTint(0xff2a3a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    // the painted parchment, stretched to the word: rolled ends stay as painted
    this.img = scene.add.nineslice(0, 0, 'ka-scroll_plain', undefined, this.scrollWidth / SCROLL_SCALE, SCROLL.h, SCROLL.capL!, SCROLL.capR!, 0, 0).setScale(SCROLL_SCALE);
    this.brackets = scene.add.graphics().setAlpha(0);
    this.drawBrackets();
    this.stamp = scene.add.image(this.scrollWidth / 2 - 6, 26, 'ka-catch').setScale(0.8).setAngle(-8).setAlpha(0);
    this.add([this.glow, this.ring, this.img, this.done, this.rest, this.brackets, this.stamp]);
    this.img.setInteractive({ useHandCursor: true }).setData('wordId', word.id);
    if (word.spell) this.adorn(scene, word.spell);
    this.setTyped(word.typed);
    scene.add.existing(this);
    this.setDepth(10);
  }

  /** The painting's targeting reticle: gold corner brackets and chevrons. */
  private drawBrackets(): void {
    const g = this.brackets.clear();
    const w = this.scrollWidth / 2 + 12;
    const h = SCROLL_H / 2 + 8;
    g.lineStyle(4, 0xffd35a, 1);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      g.beginPath();
      g.moveTo(sx * w, sy * (h - 14));
      g.lineTo(sx * w, sy * h);
      g.lineTo(sx * (w - 16), sy * h);
      g.strokePath();
    }
    g.fillStyle(0xffd35a, 1);
    g.fillTriangle(-w - 20, -8, -w - 20, 8, -w - 8, 0).fillTriangle(w + 20, -8, w + 20, 8, w + 8, 0);
    g.fillTriangle(-8, -h - 18, 8, -h - 18, 0, -h - 7).fillTriangle(-8, h + 18, 8, h + 18, 0, h + 7);
  }

  /**
   * Spell scrolls (D-095): calm but unmistakable. A steady, soft glow in the
   * spell's colour and a wax seal bearing its glyph; Fire keeps a small, slow
   * flame and Ice its frosted parchment. Nothing pulses, sweeps or twinkles,
   * so spell scrolls never pull the eye off the word being typed.
   */
  private adorn(scene: Phaser.Scene, spell: SpellId): void {
    const hue = hexNum(SPELL_HUE[spell]);
    const w = this.scrollWidth;
    const aura = scene.add.image(0, 0, 'typel-glow-gold').setDisplaySize(w + 60, SCROLL_H + 54).setTint(hue).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.addAt(aura, 0);
    this.img.setTint(this.parchmentTint());
    if (spell === 'fire') {
      const f = scene.add.image(-w / 2 + 10, -SCROLL_H / 2 + 16, 'ka-flame').setOrigin(0.4, 0.7).setScale(0.7).setBlendMode(Phaser.BlendModes.SCREEN);
      this.add(f);
      scene.tweens.add({ targets: f, scaleY: { from: 0.66, to: 0.76 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // the wax seal: the spell's colour and glyph, pressed onto the parchment's right end
    const sx = w / 2 - 42;
    const seal = scene.add.graphics();
    const dark = Phaser.Display.Color.IntegerToColor(hue).darken(35).color;
    seal.fillStyle(0x000000, 0.25).fillCircle(sx + 1.5, 2.5, 16);
    seal.fillStyle(dark, 1).fillCircle(sx, 1, 16);
    seal.fillStyle(hue, 1).fillCircle(sx, 0, 13);
    seal.lineStyle(1.5, 0xffffff, 0.35).strokeCircle(sx - 2, -2, 10);
    const glyph = scene.add.text(sx, 0, SPELL_GLYPH[spell], { fontFamily: 'serif', fontSize: '17px', color: '#fff8e8', stroke: Phaser.Display.Color.IntegerToColor(dark).rgba, strokeThickness: 2 }).setOrigin(0.5);
    this.add([seal, glyph]);
  }

  /** Returns where a letter was un-inked if the typed count went down. */
  setTyped(n: number): { x: number; ch: string } | null {
    if (n === this.typedCount) return null;
    const prev = this.typedCount;
    this.typedCount = n;
    const full = this.word.text.toUpperCase();
    const shift = this.word.spell ? -20 : 0;
    this.done.setText(full.slice(0, n));
    this.rest.setText(full.slice(n));
    const total = this.done.width + this.rest.width;
    this.done.setX(-total / 2 + shift);
    this.rest.setX(-total / 2 + this.done.width + shift);
    if (prev > n && prev > 0) return { x: this.x + this.rest.x + 9, ch: full[n] ?? '' };
    return null;
  }

  setTarget(on: boolean): void {
    this.glow.setAlpha(on ? 0.6 : 0);
    this.brackets.setAlpha(on ? 1 : 0);
    this.setScale(on ? 1.06 : 1);
    this.setDepth(on ? 12 : this.plunge ? 11 : 10);
  }

  /** Spell scrolls' parchment is lightly washed in the spell's colour (D-095); plain scrolls stay plain. */
  private parchmentTint(): number {
    const spell = this.word.spell;
    if (!spell) return 0xffffff;
    if (spell === 'ice') return 0xd6f3ff;
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(hexNum(SPELL_HUE[spell])), 100, 30);
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
  }

  setFrozen(on: boolean): void {
    if (on) this.img.setTint(0xbff6ff);
    else if (this.word.spell) this.img.setTint(this.parchmentTint());
    else this.img.clearTint();
  }

  setPlunge(tier: number): void {
    this.plunge = tier;
    const c = PLUNGE_COLOR[tier] ?? 0xffffff;
    this.ring.setTint(c).setAlpha(0.8 + tier * 0.07);
    // the red rubber stamp slaps down; harder the more urgent the fall
    this.stamp.setAlpha(1).setScale(1.6).setAngle(-8 - tier * 3);
    this.scene.tweens.add({ targets: this.stamp, scale: 0.72 + tier * 0.1, duration: 140, ease: 'Back.easeIn' });
  }
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
  private world!: World;
  /** The apprentice's painted hands at the keys (D-093). */
  private wizard!: PaintedHands;
  private trayMedals: Phaser.GameObjects.Container[] = [];
  private trayQueue: RuneDef[] = [];
  private trayBusy = false;
  private trayName!: Phaser.GameObjects.Text;

  private paper!: Phaser.GameObjects.Text;
  private caret!: Phaser.GameObjects.Rectangle;
  private hammer!: Phaser.GameObjects.Image;
  private shownScore = 0;
  private drums: { strip: Phaser.GameObjects.Container; texts: Phaser.GameObjects.Text[]; digit: number; mask: Phaser.GameObjects.Graphics; shade: Phaser.GameObjects.Graphics }[] = [];
  private comma!: Phaser.GameObjects.Text;
  private plates!: { base: Phaser.GameObjects.Text; combo: Phaser.GameObjects.Text; rush: Phaser.GameObjects.Text };
  private comboLiquid!: Phaser.GameObjects.TileSprite;
  private comboSurface!: Phaser.GameObjects.Image;
  private comboCount!: Phaser.GameObjects.Text;
  private rushLiquid!: Phaser.GameObjects.TileSprite;
  private rushState!: Phaser.GameObjects.Text;
  private rushBubbles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private rushEruption!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastRush = 1;
  private lastMult = 1;
  private levelPlate!: Phaser.GameObjects.Text;
  private needle!: Phaser.GameObjects.Image;
  private needleAngle = 0;
  private gaugeMarks!: Phaser.GameObjects.Graphics;
  private gaugeGlow!: Phaser.GameObjects.Image;
  private gaugeText!: Phaser.GameObjects.Text;
  private allInText!: Phaser.GameObjects.Text;
  private wardLine!: Phaser.GameObjects.Graphics;
  private archFlash = 0;
  private note!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Image;
  private allInVeil!: Phaser.GameObjects.Image;
  private rack = new Map<SpellId, { sprite: Phaser.GameObjects.Image; count: Phaser.GameObjects.Text; learned: boolean; home: { x: number; y: number } }>();
  private poolText!: Phaser.GameObjects.Text;
  private keys = new Map<string, Phaser.GameObjects.Image>();
  private trails = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();
  private lastInput = '';
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
    this.drums = [];
    this.acc = 0;
    this.paused = false;
    this.ended = false;
    this.lastRush = 1;
    this.archFlash = 0;
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

  preload(): void {
    preloadKeyart(this);
  }

  create(): void {
    ensureTextures(this);
    this.world = buildWorld(this, this.reduced);
    this.wizard = new PaintedHands(this, this.reduced);
    this.trayMedals = [];
    this.trayQueue = [];
    this.trayBusy = false;
    this.buildHud();
    this.bindEvents();
    this.bindInput();
    for (const w of this.engine.state.words) this.addView(w);
    this.refreshRack();
    this.setDrums(this.shownScore, true);
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
    this.buildDrums(6);
    const P = KA.plates;
    this.plates = {
      base: this.text(P.base[0], P.base[1], 'BASE: 0', 0, '', PLATE_TEXT).setOrigin(0.5).setDepth(22),
      combo: this.text(P.combo[0], P.combo[1], '×COMBO: 1', 0, '', PLATE_TEXT).setOrigin(0.5).setDepth(22),
      rush: this.text(P.rush[0], P.rush[1], '×RUSH: 1.0', 0, '', PLATE_TEXT).setOrigin(0.5).setDepth(22),
    };
    for (const t of Object.values(this.plates)) this.fit(t, 19, (t === this.plates.combo ? 98 : 84));

    // Combo tube: painted empty glass above, painted blue liquid rising from the bottom
    const ct = COMBO_TUBE;
    this.add.tileSprite(ct.x, ct.top, ct.w, ct.bottom - ct.top, 'ka-combo_empty').setOrigin(0).setDepth(21);
    this.comboLiquid = this.add.tileSprite(ct.x, ct.bottom, ct.w, 0, 'ka-combo_liquid').setOrigin(0, 1).setDepth(21.1);
    this.comboSurface = this.add.image(ct.x + ct.w / 2, ct.bottom, 'ka-combo_surface').setDepth(21.2).setVisible(false);
    this.comboCount = this.text(ct.x + ct.w / 2, ct.bottom - 22, '0', 20, '#eaf6ff', { fontFamily: FONT_ARCADE, fontStyle: '700', stroke: '#0b2a5a', strokeThickness: 4 }).setOrigin(0.5).setDepth(21.3);
    // Arcane Rush tube: drained green glass, filling with the painted swirling liquid
    const rt = RUSH_TUBE;
    this.add.tileSprite(rt.x, rt.top, rt.w, rt.bottom - rt.top, 'ka-rush_empty').setOrigin(0).setDepth(21);
    this.rushLiquid = this.add.tileSprite(rt.x, rt.bottom, rt.w, 0, 'ka-rush_liquid').setOrigin(0, 1).setDepth(21.1);
    placed(this, 'rush_band', 21.4);
    this.rushState = this.text(rt.x + rt.w / 2, rt.bottom + 36, '', 17, '#d6ffe6', { fontFamily: FONT_ARCADE, fontStyle: '700', stroke: '#0b3a1a', strokeThickness: 5 }).setOrigin(0.5).setDepth(22);
    this.rushBubbles = this.add.particles(0, 0, 'typel-spark', {
      x: { min: rt.x + 8, max: rt.x + rt.w - 8 }, y: rt.bottom - 8, lifespan: 1400, speedY: { min: -160, max: -60 },
      scale: { start: 0.3, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0x7dffb5, 0xffffff, 0xffe08a], blendMode: 'ADD', frequency: 90, emitting: false,
    }).setDepth(21.5);
    this.rushEruption = this.add.particles(rt.x + rt.w / 2, rt.top - 30, 'typel-spark', {
      lifespan: 1100, speedY: { min: -320, max: -120 }, speedX: { min: -120, max: 120 }, gravityY: 260, scale: { start: 0.5, end: 0 },
      tint: [0x4fbf78, 0xffc46a, 0xfff0c8], blendMode: 'ADD', frequency: 60, emitting: false,
    }).setDepth(31);

    // the level plate, engraved at the plate's slant
    this.levelPlate = this.text(KA.plates.level[0], KA.plates.level[1], '', 15, '#2b1a0a', { fontFamily: FONT_ARCADE, fontStyle: '700', align: 'center', lineSpacing: -2 })
      .setOrigin(0.5).setAngle(KA.plates.levelAngle).setDepth(22);
    this.trayName = this.text(KA.tray[1]![0], KA.tray[1]![1] + 78, '', 17, '#ffe7a8', { fontFamily: FONT_TITLE, fontStyle: '700', align: 'center', stroke: '#2a0a04', strokeThickness: 4 }).setOrigin(0.5).setDepth(31);

    // the paper: letters stamp at the strike point and the line slides left (D-088)
    const pp = KA.paper;
    this.paper = this.text(PAPER.x, PAPER.y, '', PAPER_FONT, OXBLOOD, { fontFamily: '"Courier Prime", "Courier New", monospace', fontStyle: '700' }).setOrigin(1, 0.5).setDepth(22);
    const clip = this.make.graphics({}, false).fillRect(pp.left + 8, pp.top, pp.right - pp.left - 16, pp.bottom - pp.top);
    this.paper.setMask(clip.createGeometryMask());
    this.caret = this.add.rectangle(PAPER.x + 6, PAPER.y, 4, PAPER_FONT * 0.8, hexNum(OXBLOOD)).setDepth(22);
    this.tweens.add({ targets: this.caret, alpha: 0.15, duration: 520, yoyo: true, repeat: -1 });
    const hb = KA.sprites['hammer']!;
    this.hammer = this.add.image(hb.x + hb.pivotX!, hb.y + hb.pivotY!, 'ka-hammer').setOrigin(hb.pivotX! / hb.w, hb.pivotY! / hb.h).setDepth(22.6).setAngle(-55);

    // the Ward: a faint line along the paper's top edge, and the brass gauge
    this.wardLine = this.add.graphics().setDepth(9);
    const n = KA.sprites['needle']!;
    this.gaugeGlow = this.add.image(KA.gauge.x, KA.gauge.y, 'typel-glow-gold').setDisplaySize(KA.gauge.r * 3.4, KA.gauge.r * 3.4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(20.5);
    this.gaugeMarks = this.add.graphics().setDepth(21);
    this.needle = this.add.image(KA.gauge.x, KA.gauge.y, 'ka-needle').setOrigin(n.pivotX! / n.w, n.pivotY! / n.h).setDepth(21.5);
    this.needleAngle = gaugeAngle(this.engine.wardInfo.stability);
    this.gaugeText = this.text(KA.gauge.x, KA.gauge.y - KA.gauge.r * 0.42, '', 15, '#3a2410', { fontFamily: FONT_ARCADE, fontStyle: '700' }).setOrigin(0.5).setDepth(21.6);
    this.allInText = this.text(KA.gauge.x - 20, KA.gauge.y - KA.gauge.r - 22, '', 20, '#ffd35a', { fontFamily: FONT_ARCADE, fontStyle: '700', stroke: '#4a1000', strokeThickness: 5, align: 'center' }).setOrigin(0.5, 1).setDepth(31);

    // the Master's note, pinned to the desk (the painting's own words until a lesson begins)
    this.note = this.text(KA.note.x, KA.note.y, 'NO SMUDGES!\nAnd spell it right this time.\n— M.', 18, '#2a1a10', { fontFamily: FONT_WORD, fontStyle: '700', align: 'center', wordWrap: { width: KA.note.w }, lineSpacing: -2 })
      .setOrigin(0.5).setAngle(KA.note.angle).setDepth(21);

    // spell moods and All-In wash the sky inside the arch with soft light, never a hard box
    const veil = () => this.add.image(CX, FIELD_RECT.y + FIELD_RECT.h * 0.55, 'typel-glow-gold').setDisplaySize(FIELD_RECT.w * 1.25, FIELD_RECT.h * 1.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(7);
    this.overlay = veil();
    this.allInVeil = veil().setTint(0xffb020);

    this.buildRack();
    this.buildKeys();
  }

  /** Shrink a text until it fits its engraved space. */
  private fit(t: Phaser.GameObjects.Text, size: number, width: number): void {
    t.setFontSize(size);
    while (t.width > width && size > 10) t.setFontSize(--size);
  }

  /**
   * The score drums: brass wheels that roll to each new digit, the neighbours
   * peeking above and below as in the painting. Six drums and a comma; more
   * drums squeeze in if the score outgrows them.
   */
  private buildDrums(count: number): void {
    for (const d of this.drums) {
      d.strip.destroy();
      d.mask.destroy();
      d.shade.destroy();
    }
    this.drums = [];
    this.comma?.destroy();
    const D = KA.drums;
    const cells: [number, number][] = count === 6 ? D.cells.map((c) => [c[0], c[1]]) : Array.from({ length: count }, (_, i) => {
      const a = D.cells[0]![0];
      const w = (D.cells[5]![1] - a) / count;
      return [a + i * w + 1, a + (i + 1) * w - 1];
    });
    const size = count === 6 ? 66 : Math.floor(66 * 6 / count);
    for (const [x0, x1] of cells) {
      const cx = (x0 + x1) / 2;
      const texts = [-1, 0, 1].map((k) => this.add.text(0, k * DRUM_PITCH, '0', { ...DRUM_TEXT, fontSize: `${size}px` }).setOrigin(0.5));
      const strip = this.add.container(cx, D.y, texts).setDepth(21);
      const mask = this.make.graphics({}, false).fillRect(x0, D.top, x1 - x0, D.bottom - D.top);
      strip.setMask(mask.createGeometryMask());
      // the drum's curve: darker towards its top and bottom
      const shade = this.add.graphics().setDepth(21.1);
      const h = (D.bottom - D.top) * 0.32;
      shade.fillGradientStyle(0x1a0a02, 0x1a0a02, 0x1a0a02, 0x1a0a02, 0.7, 0.7, 0, 0).fillRect(x0, D.top, x1 - x0, h);
      shade.fillGradientStyle(0x1a0a02, 0x1a0a02, 0x1a0a02, 0x1a0a02, 0, 0, 0.7, 0.7).fillRect(x0, D.bottom - h, x1 - x0, h);
      this.drums.push({ strip, texts, digit: -1, mask, shade });
    }
    this.comma = this.add.text(D.comma[0], D.comma[1], ',', { ...DRUM_TEXT, fontSize: '54px' }).setOrigin(0.5).setDepth(21.2).setVisible(count === 6);
  }

  private setDrums(value: number, instant = false): void {
    const s = String(Math.max(0, Math.floor(value)));
    const count = Math.max(6, s.length);
    if (count !== this.drums.length) this.buildDrums(count);
    const digits = s.padStart(count, '0');
    this.drums.forEach((d, i) => {
      const n = Number(digits[i]);
      if (n === d.digit) return;
      const rolledUp = d.digit >= 0 && !instant && !this.reduced;
      d.digit = n;
      [n - 1, n, n + 1].forEach((k, j) => d.texts[j]!.setText(String((k + 10) % 10)));
      this.tweens.killTweensOf(d.strip);
      if (rolledUp) {
        d.strip.y = KA.drums.y + DRUM_PITCH;
        this.tweens.add({ targets: d.strip, y: KA.drums.y, duration: 140, ease: 'Back.easeOut' });
      } else d.strip.y = KA.drums.y;
    });
  }

  private buildRack(): void {
    this.poolText = this.text(1742, 112, '', 16, '#ffe7b8', { fontFamily: FONT_ARCADE, fontStyle: '700', stroke: '#1a0a02', strokeThickness: 4 }).setOrigin(0.5).setDepth(31);
    SPELL_ORDER.forEach((id, i) => {
      const learned = this.setup.spells.includes(id);
      const sprite = placed(this, `rack_${id}`, 21).setVisible(learned);
      const [cx, cy] = KA.rackCount[id]!;
      const count = this.text(cx, cy, '', 30, '#ffffff', { fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif', fontStyle: '900', stroke: '#140a04', strokeThickness: 6 }).setOrigin(0.5).setDepth(22).setVisible(learned);
      if (learned && !this.setup.hardcore) {
        const b = sprite.getBounds();
        this.text(b.left + 2, b.top + 4, String(i + 1), 16, '#ffe7b8', { fontFamily: FONT_ARCADE, fontStyle: '700', stroke: '#140a04', strokeThickness: 4 }).setOrigin(0, 0).setDepth(22);
      }
      this.rack.set(id, { sprite, count, learned, home: { x: sprite.x, y: sprite.y } });
    });
  }

  /** Each painted key presses into the typewriter: it sinks into its well under a fixed rim. */
  private buildKeys(): void {
    const r = 24;
    for (const [ch, [x, y]] of Object.entries(KA.keys)) {
      const img = this.add.image(0, 0, 'ka-plate').setOrigin(0).setCrop(x - r, y - r, 2 * r, 2 * r).setDepth(22.5).setVisible(false);
      const m = this.make.graphics({}, false).fillCircle(x, y, r);
      img.setMask(m.createGeometryMask());
      this.keys.set(ch, img);
    }
  }

  private pressKey(ch: string): void {
    const k = this.keys.get(ch);
    if (!k) return;
    this.tweens.killTweensOf(k);
    k.setVisible(true).setY(5).setTint(0xb8a890);
    this.tweens.add({ targets: k, y: 0, duration: 90, ease: 'Quad.easeOut', onComplete: () => k.setVisible(false).clearTint() });
  }

  /** Level title card that sweeps in over the field and away. */
  private banner(title: string, sub: string): void {
    const t = this.text(CX, 320, title, 60, '#ffe9a8', { fontFamily: FONT_TITLE, fontStyle: '700', stroke: '#2a0040', strokeThickness: 10 }).setOrigin(0.5).setDepth(60);
    const s = this.text(CX, 390, sub, 28, '#ffffff', { fontFamily: FONT_ARCADE, stroke: '#2a0040', strokeThickness: 6 }).setOrigin(0.5).setDepth(60);
    for (const o of [t, s]) {
      this.fit(o, Number(o.style.fontSize.toString().replace('px', '')), FIELD_RECT.w - 40);
      o.setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: o, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
      this.tweens.add({ targets: o, alpha: 0, y: o.y - 40, delay: 1500, duration: 500, onComplete: () => o.destroy() });
    }
  }

  /** The Master's lesson lines, handwritten on the note pinned to the desk. */
  showLines(lines: readonly Line[]): void {
    let i = 0;
    const next = () => {
      const line = lines[i++];
      if (!line) return;
      this.note.setText(`${line.text}\n— ${line.who}`);
      this.fit(this.note, 18, KA.note.w + 6);
      this.note.setAlpha(0);
      this.tweens.add({ targets: this.note, alpha: 1, duration: 250 });
      if (!this.reduced) this.tweens.add({ targets: this.note, angle: { from: KA.note.angle - 3, to: KA.note.angle }, duration: 300, ease: 'Back.easeOut' });
      this.time.delayedCall(Math.max(4800, line.text.length * 60), next);
    };
    this.time.delayedCall(1600, next);
  }

  // ───────────────────────── engine events ─────────────────────────

  private bindEvents(): void {
    const ev = this.engine.events;
    const cx = CX;
    const gw = this.world.wizard;
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
      if (this.setup.showSequenceScore) this.floatPoints(at.x, at.y, points);
      this.wizard.captured(points >= 300);
      if (points >= 1000) gw.impressed();
      if (word.plunge) {
        this.callout(at.x, at.y - 60, word.plunge === 3 ? 'DARING RESCUE!' : 'SAVED!', '#ffffff', 30, '#d0002a');
        gw.nod();
      }
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
      if (tier >= 2) gw.harrumph();
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
      gw.harrumph();
      if (!this.reduced) this.cameras.main.shake(200, 0.006);
      this.wardFlash(0xff3a4a);
      this.kickNeedle(10);
    });
    ev.on('wordBlocked', ({ word }) => {
      const v = this.views.get(word.id);
      this.stopTrail(word.id);
      if (v) this.burst(v.x, WARD_Y - 6, 0x8fb8ff, 20);
      this.removeView(word.id);
      sound.spell('barrier');
      this.wardFlash(0x8fb8ff);
    });
    ev.on('spellCollected', ({ spell, stored, x, y }) => this.claimSpell(spell, stored, toX(x), toY(y)));
    ev.on('manaPoolChanged', () => this.refreshRack());
    ev.on('spellCast', ({ spell }) => {
      if (spell !== 'wind') sound.spell(spell);
      this.refreshRack();
      const tip = this.wizard.cast();
      this.burst(tip.x, tip.y, hexNum(SPELL_HUE[spell]), 18);
      this.castFromShelf(spell);
      this.callout(cx, 140, spell.toUpperCase(), SPELL_HUE[spell], 44, '#1a0630');
    });
    ev.on('spellFizzled', ({ spell }) => {
      sound.fizzle();
      const slot = this.rack.get(spell);
      if (slot && !this.reduced) this.tweens.add({ targets: slot.sprite, x: slot.home.x + 6, duration: 40, yoyo: true, repeat: 2, onComplete: () => slot.sprite.setPosition(slot.home.x, slot.home.y) });
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
      this.callout(COMBO_TUBE.x + COMBO_TUBE.w / 2, COMBO_TUBE.top + 60, `FOCUS +${gain}`, '#bff6ff', 30, '#0a3a5a');
    });
    ev.on('scoreInsured', () => {
      sound.spell('barrier');
      this.callout(COMBO_TUBE.x + COMBO_TUBE.w / 2, COMBO_TUBE.top + 60, 'COMBO SAVED', '#cfe2ff', 26, '#0b2a7a');
      this.wardFlash(0x8fb8ff);
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
      // D-086: lightning rises from the Ward into the three nearest words.
      for (const w of words.slice(0, 3)) {
        const p = pos.get(w.id)!;
        this.bolt({ x: p.x + (Math.random() - 0.5) * 80, y: WARD_Y + 10 }, p, 0xfff27a, true);
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
      this.wardFlash(0xfff27a);
      this.callout(cx, 420, words.length > 3 ? `CHAIN ×${words.length}!` : 'ZAP!', '#fff27a', 52, '#3a3000');
    });
    ev.on('wordsHarvested', ({ words, points, volley, allIn }) => {
      words.forEach((w, i) => this.time.delayedCall(i * 45, () => (this.stopTrail(w.id), this.collectView(w.id, true))));
      const parts = [this.setup.showSequenceScore ? `HARVEST +${points}` : 'HARVEST', allIn && allIn > 1 ? `ALL-IN ×${allIn}` : '', volley && volley > 1 ? `RUSH ×${volley.toFixed(1)} SPENT` : ''].filter(Boolean);
      this.callout(cx, 400, parts.join('  ·  '), '#ffd35a', 44, '#4a2a00');
      this.confetti(60);
      if (!this.reduced) this.cameras.main.flash(180, 255, 200, 80, false);
      gw.impressed();
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
        gw.impressed();
        this.kickNeedle(-14);
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
      this.tweens.add({ targets: this.allInVeil, alpha: active ? 0.3 : 0, duration: 400 });
      if (!active && (reason === 'breach' || reason === 'mistake')) this.callout(cx, 400, 'ALL-IN BROKEN', '#ff8080', 46, '#3a0010');
      if (!active && reason === 'expired') this.callout(cx, 400, 'All-In fades', '#ffffff', 30, '#1a0630');
    });
    ev.on('runeAwarded', ({ id, name, points }) => {
      const tier = RUNE_BY_ID.get(id)?.tier ?? 1;
      sound.rune(tier);
      prefs.noteRune(id);
      const def = RUNE_BY_ID.get(id);
      if (def) this.trayQueue.push(def);
      void name;
      void points;
      this.runTray();
    });
    ev.on('gameOver', ({ result }) => {
      this.ended = true;
      if (result === 'won') {
        sound.levelClear();
        this.wizard.cheer();
        gw.nod();
        this.confetti(90);
      } else {
        sound.defeat();
        gw.harrumph();
      }
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
        this.wizard.typed(e.key);
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
    this.wizard.typed(before.at(-1) ?? '');
    this.inkDrop(PAPER.x - 18, PAPER.y, (before.at(-1) ?? '').toUpperCase(), OXBLOOD);
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
    for (const v of this.views.values()) {
      const w = v.word;
      v.setPosition(toX(w.x), toY(w.prevY + (w.y - w.prevY) * Math.min(1, alpha)));
      v.setTyped(w.typed);
      this.trails.get(w.id)?.setPosition(v.x, v.y - 20);
    }
    this.wizard.tickFrame(delta);
    this.world.wizard.tick(delta);
    this.refreshHud(delta);
  }

  private refreshHud(delta: number): void {
    const e = this.engine;
    const s = e.state;
    const goal = (this.setup.scoreOffset ?? 0) + s.score;
    if (this.shownScore !== goal) {
      this.shownScore += Math.max(1, Math.ceil((goal - this.shownScore) * Math.min(1, delta / 140)));
      if (this.shownScore > goal) this.shownScore = goal;
      this.setDrums(this.shownScore);
    }
    // Combo tube: the blue liquid rises toward the next multiplier
    const mult = 1 + Math.floor(s.combo / 10);
    const ct = COMBO_TUBE;
    const ch = (ct.bottom - ct.top - 6) * ((s.combo % 10) / 10);
    this.comboLiquid.height = ch;
    this.comboLiquid.tilePositionY += this.reduced ? 0 : delta * 0.02;
    this.comboSurface.setVisible(ch > 4).setY(ct.bottom - ch);
    this.comboCount.setText(`${s.combo}`);
    this.plates.combo.setText(`×COMBO: ${mult}`);
    if (mult > this.lastMult) this.comboUp(mult);
    this.lastMult = mult;
    // Arcane Rush tube (internally the Arcane Volley multiplier)
    const v = e.volleyMultiplier;
    const armed = e.volleyArmedProgress;
    const level = v > 1 ? Math.min(1, Math.log(v) / Math.log(6)) : armed * 0.06;
    const rt = RUSH_TUBE;
    const hot = v >= 2;
    this.rushLiquid.height = (rt.bottom - rt.top - 4) * level;
    this.rushLiquid.tilePositionY -= this.reduced ? 0 : delta * (0.03 + (v - 1) * 0.05);
    this.rushLiquid.setAlpha(hot ? 0.85 + 0.15 * Math.sin(this.time0 / 90) : 1);
    this.plates.rush.setText(`×RUSH: ${v.toFixed(1)}`);
    this.rushState.setText(v >= 5 ? 'MASTERY!' : hot ? 'RUSHING!' : v > 1 ? 'BUILDING' : armed > 0 ? 'LINK NEXT!' : '');
    if (v > this.lastRush + 0.05) {
      sound.volleyStep(v);
      if (v >= 2 && this.lastRush < 2) this.ignite('ARCANE RUSH!');
      if (v >= 5 && this.lastRush < 5) this.ignite('RUSH MASTERY!');
    } else if (v === 1 && this.lastRush >= 1.2) {
      sound.volleyBreak();
      if (this.lastRush >= 2) this.callout(rt.x + rt.w / 2, rt.top + 80, 'RUSH LOST', '#ffb0b0', 28, '#3a0010');
    }
    this.lastRush = v;
    if (!this.reduced) {
      if (v > 1 && !this.rushBubbles.emitting) this.rushBubbles.start();
      if (v <= 1 && this.rushBubbles.emitting) this.rushBubbles.stop();
      this.rushBubbles.frequency = Math.max(20, 120 - v * 18);
      if (hot && !this.rushEruption.emitting) this.rushEruption.start();
      if (!hot && this.rushEruption.emitting) this.rushEruption.stop();
      this.rushEruption.frequency = Math.max(18, 90 - (v - 2) * 20);
    }
    // the painted green wisps around the Ward brighten with Rush; gold at Mastery
    const wisp = v >= 5 ? 0.9 : hot ? 0.45 + (v - 2) * 0.12 : v > 1 ? 0.22 : 0.08;
    this.world.wisps.setAlpha(wisp * (0.85 + 0.15 * Math.sin(this.time0 / 140))).setTint(v >= 5 ? 0xffe08a : 0xffffff);
    // the engine's gear turns faster as power builds
    this.world.gear.rotation += (delta / 1000) * (0.35 + (v - 1) * 0.9 + (s.combo % 10) * 0.04);
    const ward = e.wardInfo;
    this.wizard.setNervous(1 - ward.stability / 100);
    this.drawWard(delta);
    this.refreshPlates();
    this.pressureTimer -= delta;
    if (this.pressureTimer <= 0) {
      this.pressureTimer = 400;
      // D-092: the music relaxes while play goes well and only hurries when the
      // situation demands it: words near the Ward, a crowded field, a hurt Ward.
      const crowd = s.words.length / Math.max(4, e.config.maxActiveWords);
      let lowest = 0;
      for (const w of s.words) lowest = Math.max(lowest, w.y / FIELD.height);
      const near = Math.max(0, Math.min(1, (lowest - 0.5) / 0.42));
      const crowded = Math.max(0, Math.min(1, (crowd - 0.45) / 0.55));
      const hurt = 1 - ward.stability / 100;
      const stress = Math.min(1, Math.max(near * 0.55 + crowded * 0.45, hurt * 1.1));
      sound.setPressure(stress, hurt, hot ? Math.min(1, (v - 1) / 4) : 0);
    }
  }

  /**
   * The Ward made visible: the painted rune arch glows with its state (teal at
   * rest, green in Rush, gold at Mastery, amber in All-In, red and faltering
   * when weak); Barrier adds layered arches; the brass gauge reads strength,
   * with the scar as a dead arc behind a stop pin.
   */
  private drawWard(delta: number): void {
    const w = this.engine.wardInfo;
    const stab = Math.max(0, w.stability);
    const allIn = w.allInTicks > 0;
    const v = this.engine.volleyMultiplier;
    const t = this.time0;
    let tint = 0x9ff8ee;
    let a = 0.2;
    if (v >= 5) (tint = 0xffd35a), (a = 0.55);
    else if (v >= 2) (tint = 0x7dffb5), (a = 0.42);
    if (allIn) (tint = 0xffb040), (a = 0.45 + 0.1 * Math.sin(t / 160));
    if (stab < 30) {
      tint = 0xff4040;
      a = 0.25 + 0.3 * Math.abs(Math.sin(t / 110)) * (Math.random() < 0.1 ? 0.2 : 1);
    }
    this.archFlash = Math.max(0, this.archFlash - delta / 500);
    this.world.arch.setTint(this.archFlash > 0 ? this.archFlashColor : tint).setAlpha(Math.min(1, a + this.archFlash * 0.8));
    this.world.barriers.forEach((b, i) => b.setAlpha(i < this.engine.state.barrier ? 0.35 + 0.1 * Math.sin(t / 300 + i) : 0));
    // a faint glow along the paper's top edge: where the Ward meets the words
    const wl = this.wardLine.clear();
    wl.lineStyle(3, tint, 0.35 + 0.25 * Math.sin(t / (stab < 30 ? 90 : 400))).lineBetween(FIELD_RECT.x + 90, WARD_Y - 2, FIELD_RECT.x + FIELD_RECT.w - 90, WARD_Y - 2);
    // gauge needle: sprung, with a little overshoot
    const target = gaugeAngle(stab);
    this.needleAngle += (target - this.needleAngle) * Math.min(1, delta / 120);
    const jitter = stab < 25 && !this.reduced ? (Math.random() - 0.5) * 2.5 : 0;
    this.needle.setAngle(this.needleAngle + jitter - NEEDLE_PAINTED);
    this.gaugeText.setText(`${Math.round(stab)}%`);
    const g = this.gaugeMarks.clear();
    const G = KA.gauge;
    const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
    if (w.cap < 100) {
      // the scar: a dead, cracked arc the needle can never reach again
      const from = rad(gaugeAngle(100));
      const to = rad(gaugeAngle(w.cap));
      g.lineStyle(G.r * 0.2, 0x2a0606, 0.78).beginPath().arc(G.x, G.y, G.r * 0.82, from, to, false).strokePath();
      g.lineStyle(2, 0xc0302a, 0.9);
      for (let d = gaugeAngle(100) + 6; d < gaugeAngle(w.cap) - 2; d += 11) {
        const r0 = G.r * 0.72;
        const r1 = G.r * 0.92;
        g.lineBetween(G.x + Math.cos(rad(d)) * r0, G.y + Math.sin(rad(d)) * r0, G.x + Math.cos(rad(d + 5)) * r1, G.y + Math.sin(rad(d + 5)) * r1);
      }
      const pin = rad(gaugeAngle(w.cap));
      g.fillStyle(0x8a6a2a, 1).fillCircle(G.x + Math.cos(pin) * G.r * 0.82, G.y + Math.sin(pin) * G.r * 0.82, 6);
      g.fillStyle(0xf0d080, 1).fillCircle(G.x + Math.cos(pin) * G.r * 0.82 - 1.5, G.y + Math.sin(pin) * G.r * 0.82 - 1.5, 2.5);
    }
    this.gaugeGlow.setTint(allIn ? 0xffb040 : 0xff3030).setAlpha(allIn ? 0.45 + 0.15 * Math.sin(t / 150) : stab < 25 ? 0.25 + 0.2 * Math.abs(Math.sin(t / 120)) : 0);
    this.allInText.setText(allIn ? `ALL-IN ×${w.allInMultiplier} · ${Math.ceil((w.allInTicks * SIMULATION_STEP_MS) / 1000)}s` : '');
  }

  private archFlashColor = 0xff3a4a;

  private wardFlash(color: number): void {
    this.archFlash = 1;
    this.archFlashColor = color;
  }

  /** The needle jolts (breach) or strains (a wager) before settling. */
  private kickNeedle(deg: number): void {
    if (!this.reduced) this.needleAngle += deg;
  }

  private refreshPlates(): void {
    const e = this.engine;
    const rem = e.survivalRemainingMs;
    const progress = rem !== null && isSurvival(e.config)
      ? rem > 0 ? `Survive ${Math.ceil(rem / 1000)}s` : 'Clear the field!'
      : e.config.requiredWords ? `${e.state.completed} / ${e.config.requiredWords} scrolls` : `${e.state.completed} scrolls`;
    const label = `${this.setup.title.toUpperCase()}\n${progress}`;
    if (this.levelPlate.text !== label) {
      this.levelPlate.setText(label);
      this.fit(this.levelPlate, 15, 218);
    }
  }

  private refreshRack(): void {
    const s = this.engine.state;
    let held = 0;
    for (const [id, slot] of this.rack) {
      const n = s.spells[id] ?? 0;
      held += n;
      slot.count.setText(slot.learned ? `x${n}` : '');
      if (!slot.learned) continue;
      // an empty spell's scroll greys and sinks into the shelf's shadow
      if (n > 0) slot.sprite.clearTint().setAlpha(1);
      else slot.sprite.setTint(0x6a6a72).setAlpha(0.55);
      slot.count.setAlpha(n > 0 ? 1 : 0.55);
    }
    this.poolText.setText(`charges ${held} / ${this.engine.poolLimit}`);
  }

  /** The cast scroll glows in its colour and jumps on its shelf. */
  private castFromShelf(spell: SpellId): void {
    const slot = this.rack.get(spell);
    if (!slot) return;
    const glow = this.add.image(slot.home.x, slot.home.y, 'typel-glow-gold').setDisplaySize(slot.sprite.displayWidth * 1.3, slot.sprite.displayHeight * 2)
      .setTint(hexNum(SPELL_HUE[spell])).setBlendMode(Phaser.BlendModes.ADD).setDepth(21.5);
    this.tweens.add({ targets: glow, alpha: 0, duration: 520, onComplete: () => glow.destroy() });
    if (this.reduced) return;
    this.tweens.killTweensOf(slot.sprite);
    this.tweens.add({ targets: slot.sprite, y: slot.home.y - 10, duration: 90, yoyo: true, ease: 'Quad.easeOut', onComplete: () => slot.sprite.setPosition(slot.home.x, slot.home.y) });
  }

  /**
   * D-088: the typed word is the star. Each letter is stamped at the strike
   * point by the painted typebar and the line slides left, so the newest
   * letter is always big and central. Wrong letters land as black smudges.
   */
  private setPaper(input: string, valid: boolean): void {
    const grew = input.length > this.lastInput.length && input.startsWith(this.lastInput);
    this.lastInput = input;
    this.paper.setText(input.toUpperCase()).setColor(valid ? OXBLOOD : SMUDGE);
    if (!grew || input.length === 0) return;
    const ch = input.at(-1)!.toUpperCase();
    const stamp = this.text(PAPER.x, PAPER.y, ch, PAPER_FONT, valid ? OXBLOOD : SMUDGE, { fontFamily: '"Courier Prime", "Courier New", monospace', fontStyle: '700' }).setOrigin(1, 0.5).setDepth(22.4);
    if (!this.reduced) {
      stamp.setScale(1.5).setAlpha(0.5);
      this.tweens.add({ targets: stamp, scale: 1, alpha: 0, duration: 140, ease: 'Quad.easeIn', onComplete: () => stamp.destroy() });
      this.tweens.add({ targets: this.paper, y: PAPER.y + 3, duration: 40, yoyo: true });
      // the typebar swings up, strikes and falls back into the basket
      this.tweens.killTweensOf(this.hammer);
      this.tweens.chain({ targets: this.hammer, tweens: [{ angle: 0, duration: 45, ease: 'Quad.easeIn' }, { angle: -55, duration: 110, ease: 'Quad.easeOut' }] });
    } else stamp.destroy();
    this.burst(PAPER.x - 18, PAPER.y + 20, valid ? 0x3a1a1a : 0x101010, this.reduced ? 2 : 5);
    if (!valid) {
      const blot = this.add.ellipse(PAPER.x - 16, PAPER.y + 4, 34, 22, 0x140c0c, 0.35).setDepth(22.3);
      this.tweens.add({ targets: blot, alpha: 0, delay: 600, duration: 900, onComplete: () => blot.destroy() });
    }
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

  /** A captured scroll is swept down into the typewriter's paper. */
  private collectView(id: number, spellish: boolean): void {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    v.setDepth(35);
    this.tweens.add({ targets: v, x: PAPER.x - 60, y: KA.paper.top + 10, scale: 0.15, alpha: 0.3, angle: spellish ? 180 : 0, duration: spellish ? 420 : 260, ease: 'Cubic.easeIn', onComplete: () => v.destroy() });
  }

  /** Capture: a burst of stars; the word's letters fly into the score drums. */
  private captureBurst(x: number, y: number, text: string, combo: number): void {
    const tints = combo >= 30 ? [0xfff0c8, 0xffc46a, 0x8fd0c8] : combo >= 10 ? [0xffc46a, 0xfff0c8] : [0xffc46a];
    const em = this.add.particles(x, y, 'typel-spark', {
      lifespan: 650, speed: { min: 120, max: 340 }, scale: { start: 0.5, end: 0 }, tint: tints, blendMode: 'ADD', emitting: false,
    }).setDepth(36);
    em.explode(this.reduced ? 6 : 14 + Math.min(16, combo));
    this.time.delayedCall(800, () => em.destroy());
    if (this.reduced) return;
    [...text.slice(0, 10)].forEach((ch, i) => {
      const t = this.text(x - text.length * 9 + i * 18, y, ch.toUpperCase(), 26, '#ffe08a', { fontFamily: FONT_ARCADE, stroke: '#5a1a00', strokeThickness: 4 }).setOrigin(0.5).setDepth(50);
      this.tweens.add({
        targets: t, x: { value: COUNTER.x, ease: 'Sine.easeIn' }, y: { value: COUNTER.y, ease: 'Back.easeIn' }, scale: 0.4, delay: 120 + i * 35, duration: 560,
        onComplete: () => t.destroy(),
      });
    });
  }

  /** D-088/D-093: the brass plates flip to this capture's BASE, ×COMBO and ×RUSH. Exact points stay hidden. */
  private tally(base: number, combo: number, rush: number, allIn: number, points: number): void {
    void allIn;
    void points;
    this.plates.base.setText(`BASE: ${base}`);
    this.plates.combo.setText(`×COMBO: ${combo}`);
    this.plates.rush.setText(`×RUSH: ${rush.toFixed(1)}`);
    if (this.reduced) return;
    [this.plates.base, this.plates.combo, this.plates.rush].forEach((p, i) => {
      this.tweens.killTweensOf(p);
      p.setScale(1, 0.1);
      this.tweens.add({ targets: p, scaleY: 1, delay: i * 60, duration: 140, ease: 'Back.easeOut', onStart: () => (i > 0 ? sound.tick(i) : undefined) });
    });
  }

  private floatPoints(x: number, y: number, points: number): void {
    const size = points >= 1000 ? 48 : points >= 300 ? 38 : 30;
    const color = points >= 1000 ? '#ff5fa8' : points >= 300 ? '#ffd35a' : '#ffffff';
    const t = this.text(x, y - 10, `+${points}`, size, color, { fontFamily: FONT_ARCADE, stroke: '#2a0040', strokeThickness: 6 }).setOrigin(0.5).setDepth(45);
    this.tweens.add({ targets: t, y: y - 80, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private callout(x: number, y: number, s: string, color: string, size: number, stroke = '#140c06'): void {
    const t = this.text(x, y, s, size, color, { fontFamily: FONT_ARCADE, stroke, strokeThickness: Math.max(6, size / 6) }).setOrigin(0.5).setDepth(55).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: y - 40, delay: 850, duration: 600, onComplete: () => t.destroy() });
  }

  private comboUp(mult: number): void {
    sound.comboUp(mult);
    this.callout(CX, 280, `COMBO ×${mult}!`, '#8fd0ff', 64, '#0b2a7a');
    if (!this.reduced) this.tweens.add({ targets: this.plates.combo, scale: 1.3, duration: 140, yoyo: true });
    this.burst(COMBO_TUBE.x + COMBO_TUBE.w / 2, COMBO_TUBE.top + 20, 0x8fd0ff, 30);
    if (mult >= 3) this.confetti(30 + mult * 6);
    this.wizard.cheer();
    if (mult >= 4) this.world.wizard.nod();
  }

  private ignite(label: string): void {
    sound.ignite();
    this.callout(CX, 230, label, '#7dffb5', 76, '#0b4a1a');
    this.burst(RUSH_TUBE.x + RUSH_TUBE.w / 2, RUSH_TUBE.top, 0x7dffb5, 40);
    this.world.wizard.chuckle();
    if (!this.reduced) {
      this.cameras.main.flash(160, 120, 255, 170, false);
      const ring = this.add.circle(CX, FIELD_RECT.y + FIELD_RECT.h / 2, 40, 0x7dffb5, 0).setStrokeStyle(10, 0x7dffb5, 0.9).setDepth(50);
      this.tweens.add({ targets: ring, radius: 900, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    }
    this.confetti(70);
  }

  private confetti(n: number): void {
    if (this.reduced) n = Math.ceil(n / 4);
    // rising embers and gold sparks (D-088: a world, not an arcade)
    const em = this.add.particles(0, 0, 'typel-spark', {
      x: { min: FIELD_RECT.x, max: FIELD_RECT.x + FIELD_RECT.w }, y: WARD_Y, lifespan: 1800, speedY: { min: -380, max: -140 }, speedX: { min: -60, max: 60 },
      scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffc46a, 0xff8a3a, 0xfff0c8], blendMode: 'ADD', emitting: false,
    }).setDepth(54);
    em.explode(n);
    this.time.delayedCall(2000, () => em.destroy());
  }

  /**
   * D-089 Rune tray, D-093 painted medals: the velvet tray holds the three
   * latest Runes. Each award clacks in from the right; older medals roll left
   * and drop away. The medal's metal shows the tier (silver, gold, the
   * star-and-ribbon); fumbles arrive tarnished. Awards queue, nothing blocks the field.
   */
  private runTray(): void {
    if (this.trayBusy) return;
    const rune = this.trayQueue.shift();
    if (!rune) return;
    this.trayBusy = true;
    const T = KA.tray;
    const shift = this.reduced ? 0 : 180;
    for (const m of this.trayMedals) {
      const slot = (m.getData('slot') as number) - 1;
      m.setData('slot', slot);
      if (slot < 0) {
        this.tweens.add({ targets: m, x: T[0]![0] - 70, y: T[0]![1] + 60, alpha: 0, duration: shift, ease: 'Quad.easeIn', onComplete: () => m.destroy() });
      } else this.tweens.add({ targets: m, x: T[slot]![0], y: T[slot]![1], duration: shift, ease: 'Back.easeOut' });
    }
    this.trayMedals = this.trayMedals.filter((m) => (m.getData('slot') as number) >= 0);
    const participation = rune.category === 'participation';
    const key = participation ? 'ka-medal_1' : `ka-medal_${Math.min(3, Math.max(1, rune.tier))}`;
    const glow = this.add.image(0, 0, 'typel-glow-gold').setDisplaySize(150, 150).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const medal = this.add.image(0, 0, key);
    if (participation) medal.setTint(0xb07a48);
    const c = this.add.container(T[2]![0], T[2]![1], [glow, medal]).setDepth(31).setData('slot', 2);
    this.trayMedals.push(c);
    if (!this.reduced) {
      c.setScale(0.1, 1.2).setY(T[2]![1] + 40).setAlpha(0);
      this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, y: T[2]![1], alpha: 1, delay: 120, duration: 280, ease: 'Back.easeOut' });
      this.tweens.add({ targets: glow, alpha: { from: 0.9, to: 0 }, delay: 260, duration: 700 });
    }
    // the Rune's name, engraved on the tray's lip; the Grand Wizard's remark in his bubble
    this.trayName.setText(rune.name).setColor(participation ? '#e8b890' : '#ffe7a8');
    this.fit(this.trayName, 17, 300);
    if (!this.reduced) this.tweens.add({ targets: this.trayName, scale: { from: 1.25, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    const remark = this.quip(rune);
    if (remark) this.world.wizard.say(remark);
    if (participation) this.world.wizard.chuckle();
    else if (rune.tier >= 3) {
      this.confetti(40);
      this.world.wizard.impressed();
    }
    this.time.delayedCall(this.reduced ? 300 : 520, () => {
      this.trayBusy = false;
      this.runTray();
    });
  }

  /**
   * The Grand Wizard announces Runes, and only Runes (D-090). Returns the
   * remark shown in his bubble; the spoken callout is the Rune's name.
   */
  private quip(rune: RuneDef): string {
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;
    // he warms up over the apprentice's career: early praise teases, later praise admires
    const career = Object.keys(prefs.data.runes).length;
    const praise = PRAISE.slice(0, career < 8 ? 5 : career < 16 ? 9 : PRAISE.length);
    let remark: VoiceLine | null = null;
    if (rune.id === 'fumble-50') remark = Math.random() < 0.4 ? SPECIAL.haFail : SPECIAL.legacy;
    else if (rune.category === 'participation') remark = Math.random() < 0.5 ? pick(MOCKERY) : null;
    else if (rune.id === 'flawless') remark = SPECIAL.flawless;
    else if (rune.tier >= 2 && Math.random() < 0.3) remark = pick(praise);
    const callout = RUNE_CALLOUTS[rune.id];
    const voiced = rune.tier >= 2 || rune.category === 'participation' || Math.random() < 0.5;
    const priority = rune.id === 'fumble-50' || rune.id === 'flawless' ? 4 : rune.tier;
    const lines = [voiced ? callout : null, remark].filter((x): x is VoiceLine => !!x);
    if (lines.length) voice.say(lines, priority, 1 + (rune.tier - 1) * 0.35);
    return remark ? remark.text : '';
  }

  /** A claimed spell scroll flies to its shelf, as in the painting, and knocks in. */
  private claimSpell(spell: SpellId, stored: boolean, x: number, y: number): void {
    const slot = this.rack.get(spell);
    const tx = slot?.home.x ?? 1740;
    const ty = slot?.home.y ?? 500;
    const flyer = this.add.image(x, y, `ka-rack_${spell}`).setScale(0.45).setDepth(56);
    sound.swish();
    const trail = this.reduced ? null : this.add.particles(0, 0, 'typel-spark', {
      follow: flyer, lifespan: 300, scale: { start: 0.45, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: hexNum(SPELL_HUE[spell]), blendMode: 'ADD', frequency: 16,
    }).setDepth(55);
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x, y),
      new Phaser.Math.Vector2((x + tx) / 2, Math.min(y, ty) - 160),
      new Phaser.Math.Vector2(tx, ty),
    );
    const path = { t: 0 };
    this.tweens.add({
      targets: path, t: 1, duration: 520, ease: 'Sine.easeIn',
      onUpdate: () => {
        const p = curve.getPoint(path.t);
        flyer.setPosition(p.x, p.y).setScale(0.45 + path.t * 0.55);
      },
      onComplete: () => {
        flyer.destroy();
        trail?.stop();
        this.time.delayedCall(400, () => trail?.destroy());
        if (!slot) return;
        if (stored) {
          sound.thunk();
          this.burst(tx - slot.sprite.displayWidth / 2 + 20, ty, 0xffe8a0, 14);
          this.burst(tx, ty + slot.sprite.displayHeight / 2, 0xc27a3e, 10);
          if (!this.reduced) {
            this.tweens.killTweensOf(slot.sprite);
            this.tweens.add({ targets: slot.sprite, angle: { from: -4, to: 0 }, x: { from: slot.home.x + 14, to: slot.home.x }, duration: 420, ease: 'Elastic.easeOut' });
            this.tweens.add({ targets: slot.count, scale: 1.6, duration: 120, yoyo: true });
            // the neighbours rattle on their shelves
            const i = SPELL_ORDER.indexOf(spell);
            for (const j of [i - 1, i + 1]) {
              const n = this.rack.get(SPELL_ORDER[j]!);
              if (n?.learned) this.tweens.add({ targets: n.sprite, angle: { from: j < i ? 2 : -2, to: 0 }, duration: 260, ease: 'Elastic.easeOut' });
            }
          }
        } else {
          sound.overflow();
          this.callout(tx - 40, ty, 'SHELF FULL', '#ffb0b0', 24, '#3a0010');
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

  private mood(kind: 'slow' | 'ice' | null): void {
    if (kind) this.overlay.setTint(kind === 'ice' ? 0x26d9e8 : 0xa259ff);
    this.tweens.add({ targets: this.overlay, alpha: kind ? 0.42 : 0, duration: 300 });
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
    for (const c of this.world.candles) this.tweens.add({ targets: c, angle: { from: 18 * strength, to: 0 }, duration: 700, ease: 'Elastic.easeOut' });
    for (let k = 0; k < 18; k++) {
      const y = FIELD_RECT.y + 40 + Math.random() * (FIELD_RECT.h - 80);
      const streak = this.add.rectangle(FIELD_RECT.x - 100, y, 160 + Math.random() * 200, 3, 0xbfffd8, 0.55).setDepth(36);
      this.tweens.add({ targets: streak, x: FIELD_RECT.x + FIELD_RECT.w + 150, duration: 600 + Math.random() * 400, delay: Math.random() * 300, onComplete: () => streak.destroy() });
    }
  }
}
