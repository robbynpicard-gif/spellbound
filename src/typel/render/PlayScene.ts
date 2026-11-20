/**
 * Typel play scene (prototype, D-085): the Arcane Renaissance workstation.
 * Rendering only reacts to engine events; it never feeds back into the
 * deterministic simulation (cosmetic effects never move hitboxes).
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
import { FIELD_RECT, GOLD, INK, paintScroll, RUBRIC, SPELL_GLYPH, SPELL_HUE, WARD_Y } from './paint';
import { ensureTextures, FONT_TITLE, FONT_WORD, buildStudy, hexNum } from './study';

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
  /** Spells shown on the shelf (learned so far). */
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
const WORD_STYLE = { fontFamily: FONT_WORD, fontSize: '30px', fontStyle: '700', color: INK };

class ScrollView extends Phaser.GameObjects.Container {
  private readonly img: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly done: Phaser.GameObjects.Text;
  private readonly rest: Phaser.GameObjects.Text;
  private typedCount = -1;
  frozen = false;

  constructor(scene: Phaser.Scene, readonly word: WordState) {
    super(scene, toX(word.x), toY(word.y));
    this.rest = scene.add.text(0, 0, word.text, WORD_STYLE).setOrigin(0, 0.5);
    this.done = scene.add.text(0, 0, '', { ...WORD_STYLE, color: RUBRIC }).setOrigin(0, 0.5);
    const w = Math.ceil((this.rest.width + 68 + (word.spell ? 30 : 0)) / 16) * 16;
    this.glow = scene.add.image(0, 0, 'typel-glow-gold').setDisplaySize(w + 60, 110).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.img = scene.add.image(0, 0, scrollKey(scene, w, word.spell));
    this.add([this.glow, this.img, this.done, this.rest]);
    this.img.setInteractive({ useHandCursor: true }).setData('wordId', word.id);
    this.setText(word.text);
    scene.add.existing(this);
    this.setDepth(10);
  }

  setText(text: string): void {
    this.rest.setText(text);
    this.typedCount = -1;
    this.setTyped(this.word.typed);
  }

  setTyped(n: number): void {
    if (n === this.typedCount) return;
    this.typedCount = n;
    const full = this.word.text;
    const shift = this.word.spell ? -15 : 0;
    this.done.setText(full.slice(0, n));
    this.rest.setText(full.slice(n));
    const total = this.done.width + this.rest.width;
    this.done.setX(-total / 2 + shift);
    this.rest.setX(-total / 2 + this.done.width + shift);
  }

  setTarget(on: boolean): void {
    this.glow.setAlpha(on ? 0.55 : 0);
    this.setScale(on ? 1.06 : 1);
    this.setDepth(on ? 12 : 10);
  }

  setFrozen(on: boolean): void {
    this.frozen = on;
    if (on) this.img.setTint(0xbfe6e2);
    else this.img.clearTint();
  }
}

function scrollKey(scene: Phaser.Scene, w: number, spell: SpellId | null): string {
  const key = `typel-scroll-${w}-${spell ?? 'plain'}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, w, 52)!;
    paintScroll(tex.getContext(), w, 52, spell);
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

  // HUD
  private paper!: Phaser.GameObjects.Text;
  private caret!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private shownScore = 0;
  private comboNeedle!: Phaser.GameObjects.Graphics;
  private comboMult!: Phaser.GameObjects.Text;
  private comboCount!: Phaser.GameObjects.Text;
  private volleyFill!: Phaser.GameObjects.Graphics;
  private volleyText!: Phaser.GameObjects.Text;
  private volleySparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastVolley = 1;
  private wardLiquid!: Phaser.GameObjects.Graphics;
  private wardText!: Phaser.GameObjects.Text;
  private rail!: Phaser.GameObjects.Graphics;
  private plaqueTitle!: Phaser.GameObjects.Text;
  private plaqueSub!: Phaser.GameObjects.Text;
  private plaqueProgress!: Phaser.GameObjects.Text;
  private mentorName!: Phaser.GameObjects.Text;
  private mentorText!: Phaser.GameObjects.Text;
  private mentorBox!: Phaser.GameObjects.Container;
  private runeText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Rectangle;
  private allInVeil!: Phaser.GameObjects.Image;
  private rack = new Map<SpellId, { count: Phaser.GameObjects.Text; vial: Phaser.GameObjects.Container; dim: boolean }>();
  private poolText!: Phaser.GameObjects.Text;
  private keys = new Map<string, Phaser.GameObjects.Container>();
  private candles: Phaser.GameObjects.Image[] = [];
  private pressureTimer = 0;
  private wardDirty = true;

  constructor() {
    super(TypelPlayScene.KEY);
  }

  init(setup: PlaySetup): void {
    this.setup = setup;
    this.views = new Map();
    this.rack = new Map();
    this.keys = new Map();
    this.candles = [];
    this.acc = 0;
    this.paused = false;
    this.ended = false;
    this.lastVolley = 1;
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
  }

  create(): void {
    ensureTextures(this);
    this.candles = buildStudy(this, true);
    this.buildHud();
    this.bindEvents();
    this.bindInput();
    for (const w of this.engine.state.words) this.addView(w);
    this.refreshAll();
    sound.setMood(this.setup.boss ? 'boss' : 'play');
    if (this.setup.boss) sound.bossStart();
    if (this.setup.lines?.length) this.showLines(this.setup.lines);
    (window as unknown as { typelEngine?: GameEngine }).typelEngine = this.engine;
  }

  // ───────────────────────── HUD ─────────────────────────

  private text(x: number, y: number, s: string, size: number, color: string, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, { fontFamily: FONT_WORD, fontSize: `${size}px`, color, ...opts }).setDepth(30);
  }

  private buildHud(): void {
    const s = this.setup;
    // Top-left plaque
    const plaque = this.add.graphics().setDepth(29);
    plaque.fillStyle(0x1b120c, 0.85).fillRoundedRect(18, 18, 296, 120, 10).lineStyle(2, hexNum(GOLD), 0.6).strokeRoundedRect(18, 18, 296, 120, 10);
    this.plaqueTitle = this.text(34, 26, s.title, 19, '#f1d9a6', { fontFamily: FONT_TITLE, fontStyle: '700', fixedWidth: 266 });
    this.fitTitle();
    this.plaqueSub = this.text(34, 58, s.subtitle, 16, '#c9b48a', { wordWrap: { width: 264 } });
    this.plaqueProgress = this.text(34, 100, '', 22, '#f6e7c4', { fontStyle: '700' });

    // Mentor letter (left column), never over the battlefield
    this.mentorBox = this.add.container(18, 150).setDepth(29).setAlpha(0);
    const mb = this.add.graphics();
    mb.fillStyle(0xe9d8b0, 0.96).fillRoundedRect(0, 0, 296, 300, 8).lineStyle(3, 0x8a6a34, 1).strokeRoundedRect(0, 0, 296, 300, 8);
    const seal = this.add.graphics();
    seal.fillStyle(0x8e1d1a, 1).fillCircle(36, 38, 22).fillStyle(0xb8322a, 1).fillCircle(32, 34, 9);
    this.mentorName = this.add.text(68, 22, '', { fontFamily: FONT_TITLE, fontSize: '20px', fontStyle: '700', color: '#5a2a14' });
    this.mentorText = this.add.text(18, 72, '', { fontFamily: FONT_WORD, fontSize: '19px', color: '#2a1a10', wordWrap: { width: 262 }, lineSpacing: 4 });
    this.mentorBox.add([mb, seal, this.mentorName, this.mentorText]);

    // Paper on the platen: live transcription with caret (D-068)
    const sheet = this.add.graphics().setDepth(27);
    sheet.fillStyle(0xf3e7c8, 1).fillRect(780, 706, 360, 108).fillStyle(0x000000, 0.12).fillRect(780, 800, 360, 14);
    sheet.lineStyle(1, 0xb48c58, 0.5);
    for (let y = 734; y < 800; y += 22) sheet.lineBetween(796, y, 1124, y);
    this.paper = this.text(960, 762, '', 34, INK, { fontStyle: '700' }).setOrigin(0.5).setDepth(31);
    this.caret = this.add.rectangle(960, 762, 3, 34, hexNum(RUBRIC)).setDepth(31);
    this.tweens.add({ targets: this.caret, alpha: 0.15, duration: 520, yoyo: true, repeat: -1 });

    // Score counter wheels
    this.scoreText = this.text(530, 769, '0', 38, '#f6d58a', { fontStyle: '700', fontFamily: '"Courier Prime", "Courier New", monospace' }).setOrigin(0.5);
    this.text(530, 820, 'SCORE', 13, '#c9a45a', { fontStyle: '700', letterSpacing: 3 }).setOrigin(0.5);

    // Combo dial
    this.comboNeedle = this.add.graphics().setDepth(30);
    this.comboMult = this.text(530, 892, '×1', 30, '#5a1a12', { fontFamily: FONT_TITLE, fontStyle: '700' }).setOrigin(0.5).setDepth(31);
    this.comboCount = this.text(530, 972, 'COMBO 0', 14, '#5a3a1a', { fontStyle: '700' }).setOrigin(0.5).setDepth(31);

    // Volley tube
    this.volleyFill = this.add.graphics().setDepth(28);
    this.volleyText = this.text(1371, 1048, 'VOLLEY', 15, '#e8c77a', { fontStyle: '700' }).setOrigin(0.5);
    this.volleySparks = this.add.particles(1371, 760, 'typel-spark', {
      lifespan: 900, speedY: { min: -180, max: -60 }, speedX: { min: -50, max: 50 }, scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [0xffd27a, 0xffffff, 0xf2a03a], blendMode: 'ADD', frequency: 120, emitting: false,
    }).setDepth(32);

    // Ward vessel and rail
    this.wardLiquid = this.add.graphics().setDepth(26);
    this.wardText = this.text(1509, 1050, '', 15, '#f1c6c6', { fontStyle: '700' }).setOrigin(0.5);
    this.rail = this.add.graphics().setDepth(9);

    // Rune carousel (brass drum beside the paper)
    const drum = this.add.graphics().setDepth(27);
    drum.fillStyle(0x6e4f1f, 1).fillRoundedRect(1160, 712, 150, 92, 10).fillStyle(0x140d08, 1).fillRoundedRect(1170, 726, 130, 64, 6);
    this.text(1235, 718, 'RUNES', 11, '#e2bd6a', { fontStyle: '700', letterSpacing: 3 }).setOrigin(0.5, 0);
    this.runeText = this.text(1235, 760, '—', 16, '#e8d5a8', { fontFamily: FONT_TITLE, fontStyle: '700', align: 'center', wordWrap: { width: 122 } }).setOrigin(0.5);

    // Overlays (spell moods)
    this.overlay = this.add.rectangle(FIELD_RECT.x + FIELD_RECT.w / 2, FIELD_RECT.y + FIELD_RECT.h / 2, FIELD_RECT.w, FIELD_RECT.h, 0x000000, 0).setDepth(8);
    this.allInVeil = this.add.image(960, 400, 'typel-veil').setDisplaySize(2400, 1500).setDepth(8).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);

    this.buildRack();
    this.buildKeys();
  }

  private buildRack(): void {
    const g = this.add.graphics().setDepth(26);
    g.fillStyle(0x24170e, 0.92).fillRoundedRect(1630, 30, 274, 990, 12).lineStyle(3, 0x8a6a34, 0.8).strokeRoundedRect(1630, 30, 274, 990, 12);
    this.text(1767, 44, 'SPELL SHELF', 15, '#e2bd6a', { fontStyle: '700', letterSpacing: 3 }).setOrigin(0.5, 0);
    this.poolText = this.text(1767, 68, '', 14, '#c9b48a').setOrigin(0.5, 0);
    SPELL_ORDER.forEach((id, i) => {
      const y = 140 + i * 110;
      const learned = this.setup.spells.includes(id);
      const c = this.add.container(1650, y).setDepth(30).setAlpha(learned ? 1 : 0.28);
      const hue = hexNum(SPELL_HUE[id]);
      const board = this.add.graphics();
      board.fillStyle(0x3a2516, 1).fillRect(0, 38, 234, 8);
      const vial = this.add.graphics();
      vial.fillStyle(hue, 0.35).fillCircle(34, 10, 30).fillStyle(hue, 0.95).fillCircle(34, 16, 22).lineStyle(2, 0xe8f2f4, 0.55).strokeCircle(34, 10, 30);
      vial.fillStyle(0xd9b060, 1).fillRect(28, -26, 12, 10);
      const glyph = this.add.text(34, 12, SPELL_GLYPH[id], { fontFamily: 'serif', fontSize: '24px', color: '#fff8e8' }).setOrigin(0.5);
      const name = this.add.text(76, -18, id.toUpperCase(), { fontFamily: FONT_TITLE, fontSize: '22px', fontStyle: '700', color: '#f1e2c0' });
      const key = this.add.text(76, 10, this.setup.hardcore ? 'type the name' : `key ${i + 1}`, { fontFamily: FONT_WORD, fontSize: '14px', color: '#b8a27a' });
      const count = this.add.text(222, -4, '0', { fontFamily: FONT_TITLE, fontSize: '30px', fontStyle: '700', color: '#ffe7b0' }).setOrigin(1, 0.5);
      c.add([board, vial, glyph, name, key, count]);
      this.rack.set(id, { count, vial: c, dim: !learned });
    });
  }

  private buildKeys(): void {
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    rows.forEach((row, r) => {
      const y = 912 + r * 48;
      const x0 = 960 - ((row.length - 1) * 48) / 2 + r * 10;
      [...row].forEach((ch, i) => {
        const c = this.add.container(x0 + i * 48, y).setDepth(27);
        c.add([this.add.image(0, 0, 'typel-key'), this.add.text(0, 0, ch.toUpperCase(), { fontFamily: FONT_TITLE, fontSize: '17px', fontStyle: '700', color: '#3a2410' }).setOrigin(0.5)]);
        this.keys.set(ch, c);
      });
    });
  }

  private pressKey(ch: string): void {
    const k = this.keys.get(ch);
    if (!k) return;
    this.tweens.killTweensOf(k);
    k.y = Math.round(k.y);
    const base = k.getData('y') ?? k.y;
    k.setData('y', base);
    k.y = base + 4;
    this.tweens.add({ targets: k, y: base, duration: 90, ease: 'Quad.easeOut' });
  }

  /** Shrink long titles to one line on the plaque. */
  private fitTitle(): void {
    let size = 19;
    this.plaqueTitle.setFixedSize(0, 0).setFontSize(size);
    while (this.plaqueTitle.width > 266 && size > 13) this.plaqueTitle.setFontSize(--size);
  }

  // ───────────────────────── mentor lines ─────────────────────────

  showLines(lines: readonly Line[]): void {
    let i = 0;
    const next = () => {
      const line = lines[i++];
      if (!line) {
        this.tweens.add({ targets: this.mentorBox, alpha: 0, duration: 600 });
        return;
      }
      this.mentorName.setText(line.who);
      this.mentorText.setText(line.text);
      const bg = this.mentorBox.list[0] as Phaser.GameObjects.Graphics;
      const h = Math.max(120, this.mentorText.height + 92);
      bg.clear().fillStyle(0xe9d8b0, 0.96).fillRoundedRect(0, 0, 296, h, 8).lineStyle(3, 0x8a6a34, 1).strokeRoundedRect(0, 0, 296, h, 8);
      this.tweens.add({ targets: this.mentorBox, alpha: 1, duration: 300 });
      this.time.delayedCall(Math.max(5200, line.text.length * 65), next);
    };
    next();
  }

  // ───────────────────────── engine events ─────────────────────────

  private bindEvents(): void {
    const ev = this.engine.events;
    ev.on('wordSpawned', ({ word }) => this.addView(word));
    ev.on('wordProgress', ({ word }) => this.views.get(word.id)?.setTyped(word.typed));
    ev.on('targetChanged', ({ previousId, currentId }) => {
      if (previousId !== null) this.views.get(previousId)?.setTarget(false);
      if (currentId !== null) this.views.get(currentId)?.setTarget(true);
    });
    ev.on('inputChanged', ({ input, valid }) => this.setPaper(input, valid));
    ev.on('wordCompleted', ({ word, points, combo, perfect, volley }) => {
      this.collectView(word.id, false);
      sound.capture(combo, volley ?? 1, perfect === true);
      this.floatPoints(points);
      this.burst(toX(word.x), toY(word.y), 0xe8c06a, 12);
    });
    ev.on('typingError', ({ wordId }) => {
      sound.typo();
      const v = wordId !== null ? this.views.get(wordId) : null;
      if (v && !this.reduced) this.tweens.add({ targets: v, x: v.x + 6, duration: 40, yoyo: true, repeat: 2 });
      this.cameras.main.flash(60, 120, 20, 10, false);
    });
    ev.on('submitMissed', () => {
      sound.wrongEntry();
      if (!this.reduced) this.tweens.add({ targets: this.paper, x: 966, duration: 40, yoyo: true, repeat: 3, onComplete: () => this.paper.setX(960) });
    });
    ev.on('wordMissed', ({ word }) => {
      const v = this.views.get(word.id);
      if (v) this.burst(v.x, WARD_Y, 0xd04040, 22);
      this.removeView(word.id);
      sound.breach();
      if (!this.reduced) this.cameras.main.shake(180, 0.004);
      this.flashRail(0xd04040);
      this.wardDirty = true;
    });
    ev.on('wordBlocked', ({ word }) => {
      const v = this.views.get(word.id);
      if (v) this.burst(v.x, WARD_Y, 0xbfd2e6, 18);
      this.removeView(word.id);
      sound.spell('barrier');
      this.flashRail(0xbfd2e6);
    });
    ev.on('instabilityChanged', () => (this.wardDirty = true));
    ev.on('barrierChanged', () => (this.wardDirty = true));
    ev.on('progressChanged', () => this.refreshPlaque());
    ev.on('scoreChanged', () => undefined);
    ev.on('spellCollected', ({ spell, stored, x, y }) => {
      const sx = toX(x);
      const sy = toY(y);
      const slot = this.rack.get(spell);
      if (stored && slot) {
        const orb = this.add.image(sx, sy, 'typel-glow-gold').setTint(hexNum(SPELL_HUE[spell])).setScale(0.5).setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: orb, x: 1684, y: slot.vial.y + 14, duration: 520, ease: 'Cubic.easeIn', onComplete: () => orb.destroy() });
        sound.collect();
      } else {
        sound.overflow();
        this.callout(1767, 96, 'Shelf full', '#e8a0a0', 16);
      }
      this.refreshRack();
    });
    ev.on('manaPoolChanged', () => this.refreshRack());
    ev.on('spellCast', ({ spell }) => {
      if (spell !== 'wind') sound.spell(spell);
      this.refreshRack();
      const slot = this.rack.get(spell);
      if (slot) this.tweens.add({ targets: slot.vial, scale: 1.12, duration: 110, yoyo: true });
    });
    ev.on('spellFizzled', ({ spell }) => {
      sound.fizzle();
      const slot = this.rack.get(spell);
      if (slot && !this.reduced) this.tweens.add({ targets: slot.vial, x: slot.vial.x + 6, duration: 40, yoyo: true, repeat: 2 });
    });
    ev.on('slowChanged', ({ stacks }) => this.mood(stacks > 0 ? 'slow' : null));
    ev.on('freezeChanged', ({ ticks }) => {
      this.mood(ticks > 0 ? 'ice' : null);
      for (const v of this.views.values()) v.setFrozen(ticks > 0);
      if (ticks > 0) for (const v of this.views.values()) this.burst(v.x, v.y, 0xcfeeea, 6);
    });
    ev.on('spellEnded', ({ spell }) => {
      if (spell === 'ice') for (const v of this.views.values()) v.setFrozen(false);
      if (spell === 'ice' || spell === 'slow') this.mood(this.engine.state.slowStacks.length > 0 ? 'slow' : null);
    });
    ev.on('iceFocus', ({ gain }) => {
      sound.focus(gain);
      this.callout(530, 860, `FOCUS +${gain}`, '#a8e6df', 22);
    });
    ev.on('scoreInsured', () => {
      sound.spell('barrier');
      this.callout(530, 860, 'COMBO SAVED', '#cfe0f0', 22);
      this.flashRail(0xbfd2e6);
    });
    ev.on('wordsBurned', ({ words, depths, links }) => {
      const pos = new Map(words.map((w) => [w.id, { x: this.views.get(w.id)?.x ?? toX(w.x), y: this.views.get(w.id)?.y ?? toY(w.y) }]));
      words.forEach((w, i) => {
        const delay = (depths?.[i] ?? 0) * 130;
        const p = pos.get(w.id)!;
        const v = this.views.get(w.id);
        this.views.delete(w.id);
        this.time.delayedCall(delay, () => {
          this.fire(p.x, p.y);
          v?.destroy();
        });
      });
      for (const l of links ?? []) {
        const a = pos.get(l.from);
        const b = pos.get(l.to);
        if (a && b) this.time.delayedCall(l.depth * 130 - 60, () => this.bolt(a, b, 0xf08a3a, false));
      }
    });
    ev.on('wordsShocked', ({ words, links }) => {
      const pos = new Map(words.map((w) => [w.id, { x: this.views.get(w.id)?.x ?? toX(w.x), y: this.views.get(w.id)?.y ?? toY(w.y) }]));
      const first = pos.get(words[0]!.id)!;
      this.bolt({ x: first.x + 40, y: FIELD_RECT.y }, first, 0xfff2a0, true);
      for (const l of links ?? []) {
        const a = pos.get(l.from);
        const b = pos.get(l.to);
        if (a && b) this.time.delayedCall(l.depth * 80, () => (this.bolt(a, b, 0xfff2a0, true), sound.shockArc(l.depth)));
      }
      for (const w of words) this.collectView(w.id, true);
      if (words.length >= 5) this.callout(960, 300, `CHAIN ×${words.length}`, '#fff0a0', 34);
    });
    ev.on('wordsHarvested', ({ words, volley, allIn }) => {
      words.forEach((w, i) => this.time.delayedCall(i * 40, () => this.collectView(w.id, true)));
      const notes = [allIn && allIn > 1 ? `ALL-IN ×${allIn}` : '', volley && volley > 1 ? `VOLLEY ×${volley} SPENT` : ''].filter(Boolean);
      this.callout(960, 300, ['HARVEST', ...notes].join('  ·  '), '#f2d27a', 30);
      if (!this.reduced) this.cameras.main.flash(160, 90, 70, 20, false);
    });
    ev.on('wordsTransmuted', ({ words }) => {
      for (const w of words) {
        const v = this.views.get(w.id);
        if (!v) continue;
        this.burst(v.x, v.y, 0xc4708a, 10);
        v.destroy();
        this.views.delete(w.id);
        this.addView(w);
      }
    });
    ev.on('windCast', ({ outcome, cap, scar, endedAllIn }) => {
      this.gust(outcome === 'wager' ? 1 : 0.6);
      if (outcome === 'wager') {
        sound.wager();
        this.callout(960, 280, `ALL IN  ·  ×${this.engine.wardInfo.allInMultiplier}`, '#ffd27a', 46);
        this.callout(960, 334, `Ward scarred −${scar}  ·  max ${cap}%`, '#e89a9a', 22);
      } else if (outcome === 'heal') {
        sound.gust(0.7);
        sound.heal();
        this.callout(960, 300, cap < 100 ? `WARD MENDED  ·  to ${cap}%` : 'WARD MENDED', '#b8e0a0', 30);
        if (endedAllIn) this.callout(960, 340, 'All-In released', '#d8d0c0', 20);
      } else {
        sound.gust(0.6);
        this.callout(960, 300, 'Calm gust  ·  too scarred to wager', '#d8d0c0', 24);
      }
      this.wardDirty = true;
    });
    ev.on('allInChanged', ({ active, reason }) => {
      this.tweens.add({ targets: this.allInVeil, alpha: active ? 0.55 : 0, duration: 400 });
      if (!active && (reason === 'breach' || reason === 'mistake')) this.callout(960, 300, 'ALL-IN BROKEN', '#f08080', 30);
      if (!active && reason === 'expired') this.callout(960, 300, 'All-In fades', '#d8d0c0', 22);
      this.wardDirty = true;
    });
    ev.on('runeAwarded', ({ id, name, points }) => {
      const tier = RUNE_BY_ID.get(id)?.tier ?? 1;
      sound.rune(tier);
      prefs.noteRune(id);
      this.tweens.add({
        targets: this.runeText, y: 730, alpha: 0, duration: 140,
        onComplete: () => {
          this.runeText.setText(`${name}\n+${points}`).setY(790).setAlpha(1);
          this.tweens.add({ targets: this.runeText, y: 760, duration: 220, ease: 'Back.easeOut' });
        },
      });
    });
    ev.on('windDown', () => this.plaqueProgress.setText('Clear the field!'));
    ev.on('gameOver', ({ result }) => {
      this.ended = true;
      if (result === 'won') sound.levelClear();
      else sound.defeat();
      this.time.delayedCall(result === 'won' ? 700 : 1200, () => this.finish(result));
    });
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
      if (e.key === 'Backspace') {
        if (this.engine.backspace()) sound.backspace();
        return;
      }
      if (e.key === 'Enter') return this.engine.submit();
      if (/^[1-8]$/.test(e.key) && !this.setup.hardcore) {
        const spell = SPELL_ORDER[Number(e.key) - 1]!;
        if (this.setup.spells.includes(spell)) this.engine.quickCast(spell);
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key) && this.engine.typeChar(e.key)) {
        sound.key(e.key);
        this.pressKey(e.key.toLowerCase());
      }
    });
    this.input.on('gameobjectdown', (_p: unknown, obj: Phaser.GameObjects.GameObject) => {
      const id = obj.getData('wordId') as number | undefined;
      if (typeof id === 'number' && !this.paused && !this.ended) this.engine.selectTarget(id);
    });
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
    this.plaqueTitle.setText(title);
    this.fitTitle();
    this.plaqueSub.setText(this.setup.subtitle);
    sound.setMood('boss');
  }

  stats(): GameStats {
    return this.engine.stats();
  }

  // ───────────────────────── frame ─────────────────────────

  override update(_time: number, delta: number): void {
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
    }
    this.refreshHud(delta);
  }

  private refreshAll(): void {
    this.refreshPlaque();
    this.refreshRack();
    this.wardDirty = true;
    this.setPaper('', true);
  }

  private refreshHud(delta: number): void {
    const e = this.engine;
    const s = e.state;
    // score roll-up
    const target = (this.setup.scoreOffset ?? 0) + s.score;
    if (this.shownScore !== target) {
      this.shownScore += Math.max(1, Math.ceil((target - this.shownScore) * Math.min(1, delta / 120)));
      if (this.shownScore > target) this.shownScore = target;
      this.scoreText.setText(this.shownScore.toLocaleString('en-US'));
    }
    // combo dial
    const mult = 1 + Math.floor(s.combo / 10);
    const a = Math.PI * 0.75 + ((s.combo % 10) / 10) * Math.PI * 1.5;
    this.comboNeedle.clear().lineStyle(4, 0x6a1812, 1).lineBetween(530, 930, 530 + Math.cos(a) * 60, 930 + Math.sin(a) * 60).fillStyle(0x3a2410, 1).fillCircle(530, 930, 6);
    this.comboMult.setText(`×${mult}`);
    this.comboCount.setText(`COMBO ${s.combo}`);
    // volley tube
    const v = e.volleyMultiplier;
    const armed = e.volleyArmedProgress;
    const level = v > 1 ? Math.min(1, Math.log(v) / Math.log(5)) : armed * 0.06;
    const hot = v >= 2;
    const top = 1008 - level * 258;
    this.volleyFill.clear().fillStyle(hot ? 0xffd27a : 0xe09a3a, hot ? 0.95 : 0.8).fillRoundedRect(1350, top, 42, 1008 - top, Math.min(18, (1008 - top) / 2));
    if (hot) this.volleyFill.fillStyle(0xffffff, 0.35).fillRect(1358, top + 4, 6, Math.max(0, 1000 - top - 8));
    this.volleyText.setText(v > 1 ? `VOLLEY ×${v.toFixed(1)}` : armed > 0 ? 'LINK NEXT!' : 'VOLLEY');
    if (v > this.lastVolley + 0.05) {
      sound.volleyStep(v);
      if (v >= 2 && this.lastVolley < 2) this.ignite();
    } else if (v === 1 && this.lastVolley >= 1.2) sound.volleyBreak();
    this.lastVolley = v;
    if (hot && !this.reduced) {
      if (!this.volleySparks.emitting) this.volleySparks.start();
      this.volleySparks.frequency = Math.max(25, 140 - (v - 2) * 35);
    } else if (this.volleySparks.emitting) this.volleySparks.stop();
    // survival timer
    if (isSurvival(e.config)) this.refreshPlaque();
    if (this.wardDirty) this.drawWard();
    if (e.wardInfo.allInTicks > 0) this.wardText.setText(`ALL-IN ×${e.wardInfo.allInMultiplier} · ${Math.ceil((e.wardInfo.allInTicks * SIMULATION_STEP_MS) / 1000)}s`);
    // candles breathe
    for (const c of this.candles) if (Math.random() < 0.1) c.setAlpha(0.75 + Math.random() * 0.25);
    // music pressure
    this.pressureTimer -= delta;
    if (this.pressureTimer <= 0) {
      this.pressureTimer = 400;
      const crowd = s.words.length / Math.max(4, e.config.maxActiveWords);
      const prog = e.config.requiredWords ? s.completed / e.config.requiredWords : 0.6;
      sound.setPressure(crowd * 0.65 + prog * 0.35, 1 - e.wardInfo.stability / 100, v >= 2 ? 1 : 0);
    }
  }

  private refreshPlaque(): void {
    const e = this.engine;
    const rem = e.survivalRemainingMs;
    if (rem !== null && isSurvival(e.config)) this.plaqueProgress.setText(rem > 0 ? `Survive ${Math.ceil(rem / 1000)}s` : 'Clear the field!');
    else if (e.config.requiredWords) this.plaqueProgress.setText(`${e.state.completed} / ${e.config.requiredWords} scrolls`);
    else this.plaqueProgress.setText(`${e.state.completed} scrolls`);
  }

  private refreshRack(): void {
    const s = this.engine.state;
    let held = 0;
    for (const [id, slot] of this.rack) {
      const n = s.spells[id] ?? 0;
      held += n;
      slot.count.setText(String(n));
      if (!slot.dim) slot.vial.setAlpha(n > 0 ? 1 : 0.55);
    }
    this.poolText.setText(`charges ${held} / ${this.engine.poolLimit}`);
  }

  private drawWard(): void {
    this.wardDirty = false;
    const w = this.engine.wardInfo;
    const stab = Math.max(0, w.stability);
    const g = this.wardLiquid.clear();
    // flask interior: map 0–100 to y 1026 → 772
    const yOf = (p: number) => 1026 - (p / 100) * 254;
    const allIn = w.allInTicks > 0;
    const color = allIn ? 0xf2c24a : stab > 50 ? 0xc0407a : stab > 25 ? 0xd06a3a : 0xd03030;
    const fillTo = yOf(stab);
    for (let y = 1026; y > fillTo; y -= 3) {
      const half = y > 868 ? Math.sqrt(Math.max(0, 80 * 80 - (y - 945) * (y - 945))) : 16;
      g.fillStyle(color, 0.85).fillRect(1509 - half, y - 3, half * 2, 3);
    }
    if (w.cap < 100) {
      // scarred capacity: cracked dark glass that healing cannot reach
      for (let y = yOf(w.cap); y > yOf(100); y -= 3) {
        const half = y > 868 ? Math.sqrt(Math.max(0, 80 * 80 - (y - 945) * (y - 945))) : 16;
        g.fillStyle(0x2a0a0e, 0.85).fillRect(1509 - half, y - 3, half * 2, 3);
      }
      g.lineStyle(2, 0xe05a5a, 0.9).lineBetween(1490, yOf(w.cap), 1528, yOf(w.cap));
      g.lineStyle(1, 0x8a2a2a, 0.9);
      for (let i = 0; i < 4; i++) g.lineBetween(1495 + i * 9, yOf(w.cap) - 4, 1500 + i * 9 - 6, yOf(100) + 8);
    }
    if (!allIn) this.wardText.setText(w.cap < 100 ? `WARD ${Math.round(stab)}% / ${w.cap}%` : `WARD ${Math.round(stab)}%`);
    // rail across the battlefield
    const rail = this.rail.clear();
    const railColor = allIn ? 0xf2c24a : stab > 50 ? 0xc0407a : stab > 25 ? 0xd06a3a : 0xe03a3a;
    rail.fillStyle(railColor, 0.22).fillRect(FIELD_RECT.x, WARD_Y - 10, FIELD_RECT.w, 20);
    rail.lineStyle(3, railColor, 0.55 + 0.45 * (stab / 100)).lineBetween(FIELD_RECT.x, WARD_Y, FIELD_RECT.x + FIELD_RECT.w, WARD_Y);
    for (let i = 0; i < this.engine.state.barrier; i++) {
      rail.lineStyle(3, 0xd6e4f2, 0.9).strokeCircle(FIELD_RECT.x + 40 + i * 34, WARD_Y - 22, 11);
    }
  }

  private setPaper(input: string, valid: boolean): void {
    this.paper.setText(input).setColor(valid ? INK : '#a3261c');
    this.caret.setX(960 + this.paper.width / 2 + 4);
  }

  // ───────────────────────── views and effects ─────────────────────────

  private addView(word: WordState): void {
    if (this.views.has(word.id)) return;
    const v = new ScrollView(this, word);
    if (this.engine.state.freezeTicks > 0) v.setFrozen(true);
    this.views.set(word.id, v);
    if (!this.reduced) {
      v.setAlpha(0);
      this.tweens.add({ targets: v, alpha: 1, duration: 160 });
    }
  }

  private removeView(id: number): void {
    this.views.get(id)?.destroy();
    this.views.delete(id);
  }

  /** A captured scroll is swept into the typewriter. */
  private collectView(id: number, spellish: boolean): void {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    v.setDepth(35);
    this.tweens.add({
      targets: v, x: 960, y: 760, scale: 0.2, alpha: 0.2, duration: spellish ? 380 : 220, ease: 'Cubic.easeIn',
      onComplete: () => v.destroy(),
    });
  }

  private floatPoints(points: number): void {
    const t = this.text(960, 704, `+${points}`, 26, '#f6d58a', { fontStyle: '700' }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: 660, alpha: 0, duration: 750, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  private callout(x: number, y: number, s: string, color: string, size: number): void {
    const t = this.text(x, y, s, size, color, { fontFamily: FONT_TITLE, fontStyle: '700', stroke: '#1a0f08', strokeThickness: 6 }).setOrigin(0.5).setDepth(45).setScale(0.7);
    this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: y - 30, delay: 900, duration: 700, onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, tint: number, n: number): void {
    if (this.reduced) n = Math.ceil(n / 3);
    const em = this.add.particles(x, y, 'typel-spark', {
      lifespan: 520, speed: { min: 60, max: 240 }, scale: { start: 0.45, end: 0 }, alpha: { start: 1, end: 0 }, tint, blendMode: 'ADD', emitting: false,
    }).setDepth(36);
    em.explode(n);
    this.time.delayedCall(700, () => em.destroy());
  }

  private fire(x: number, y: number): void {
    const em = this.add.particles(x, y, 'typel-flame', {
      lifespan: 700, speedY: { min: -160, max: -40 }, speedX: { min: -60, max: 60 }, scale: { start: 1.1, end: 0.2 },
      alpha: { start: 1, end: 0 }, blendMode: 'ADD', emitting: false,
    }).setDepth(36);
    em.explode(this.reduced ? 6 : 16);
    this.burst(x, y, 0xf09040, 10);
    this.time.delayedCall(900, () => em.destroy());
  }

  private bolt(a: { x: number; y: number }, b: { x: number; y: number }, color: number, jagged: boolean): void {
    const g = this.add.graphics().setDepth(37).setBlendMode(Phaser.BlendModes.ADD);
    const pts: { x: number; y: number }[] = [a];
    const n = jagged ? 7 : 4;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const off = jagged ? (Math.random() - 0.5) * 36 : Math.sin(t * Math.PI) * 18;
      pts.push({ x: a.x + (b.x - a.x) * t + off, y: a.y + (b.y - a.y) * t + off * 0.5 });
    }
    pts.push(b);
    for (const [w, al] of [[10, 0.25], [4, 0.9]] as const) {
      g.lineStyle(w, w > 5 ? color : 0xffffff, al).beginPath();
      g.moveTo(pts[0]!.x, pts[0]!.y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.strokePath();
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });
  }

  private flashRail(color: number): void {
    const r = this.add.rectangle(FIELD_RECT.x + FIELD_RECT.w / 2, WARD_Y, FIELD_RECT.w, 26, color, 0.6).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: r, alpha: 0, duration: 420, onComplete: () => r.destroy() });
  }

  private ignite(): void {
    sound.ignite();
    this.callout(1371, 700, 'SURGE!', '#ffe08a', 34);
    this.burst(1371, 760, 0xffd27a, 40);
    if (!this.reduced) this.cameras.main.flash(120, 120, 90, 30, false);
  }

  /** Field mood for Slow (amber time) and Ice (teal stillness). */
  private mood(kind: 'slow' | 'ice' | null): void {
    const color = kind === 'ice' ? 0x3aa4a0 : kind === 'slow' ? 0x9b6fb0 : 0x000000;
    this.overlay.setFillStyle(color, 1);
    this.tweens.add({ targets: this.overlay, alpha: kind ? 0.14 : 0, duration: 300 });
  }

  /** Wind gust: cosmetic tilt and streaks only (D-081). */
  private gust(strength: number): void {
    if (this.reduced) return;
    let i = 0;
    for (const v of this.views.values()) {
      const lean = (i++ % 2 ? 0.7 : 1) * 7 * strength;
      this.tweens.chain({ targets: v, tweens: [
        { angle: lean, duration: 220, ease: 'Sine.easeOut' },
        { angle: -lean * 0.4, duration: 360, ease: 'Sine.easeInOut' },
        { angle: 0, duration: 420, ease: 'Sine.easeOut' },
      ] });
    }
    for (let k = 0; k < 14; k++) {
      const y = FIELD_RECT.y + 40 + Math.random() * (FIELD_RECT.h - 80);
      const streak = this.add.rectangle(FIELD_RECT.x - 100, y, 140 + Math.random() * 160, 2, 0xdfeedd, 0.35).setDepth(36);
      this.tweens.add({ targets: streak, x: FIELD_RECT.x + FIELD_RECT.w + 150, duration: 600 + Math.random() * 400, delay: Math.random() * 300, onComplete: () => streak.destroy() });
    }
    for (const c of this.candles) this.tweens.add({ targets: c, angle: 18 * strength, duration: 200, yoyo: true, hold: 300 });
  }
}
