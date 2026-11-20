import type { WordState } from '../gameplay/Word';
import { classifyWord, emptyWordClassCounts } from '../gameplay/WordClasses';
import { PhraseTracker } from '../gameplay/PhraseTracker';
import Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { GameEngine } from '../core/GameEngine';
import type { GameResult } from '../core/GameEvents';
import { FONTS, PALETTE, SIMULATION_STEP_MS } from '../core/GameConfig';
import { createSeed } from '../core/Random';
import { WORDS } from '../data/wordList';
import { isSurvival, type DifficultyConfig } from '../difficulty/DifficultyConfig';
import { streakTierOf, VOLLEY_TICKS, type GameStats } from '../gameplay/ScoringSystem';
import { precisionComboMultiplier } from '../gameplay/PrecisionComboPrototype';
import { SPELL_IDS, totalCharges, type SpellCharges, type SpellId } from '../gameplay/SpellManager';
import { Intake } from '../render/Intake';
import { Effects } from '../render/Effects';
import { Celebrations } from '../render/Celebrations';
import { FieldBackground } from '../render/FieldBackground';
import { hex, LAYOUT, screenX, screenY, SPELL_COLORS } from '../render/layout';
import { SpellEffects } from '../render/SpellEffects';
import { WordView } from '../render/WordView';
import { SPELLS } from '../spells/SpellRegistry';
import { GameHUD } from '../ui/GameHUD';
import { instabilityStage } from '../gameplay/InstabilityManager';
import { STAGE_NAMES } from '../difficulty/Stages';
import { StreakFeedback } from '../render/StreakFeedback';

/** How the scene reports back to the app (menus are HTML, outside Phaser). */
export interface GameSceneHooks {
  onPauseChanged(paused: boolean): void;
  /** `instability` is the final value (Hardcore carries it to the next level). */
  onGameOver(result: GameResult, stats: GameStats, spells: SpellCharges, instability: number, words: WordState[]): void;
  /**
   * Campaign: show the pop-up introducing a new spell. The level waits
   * until `begin` is called.
   */
  onSpellIntro?(spell: SpellId, begin: () => void): void;
}

export interface GameSceneData {
  config: DifficultyConfig;
  hooks: GameSceneHooks;
  seed?: number;
  /** Spell charges carried in from earlier in the run. */
  initialSpells?: SpellCharges;
  /** Run score from earlier levels (shown in the HUD). */
  scoreOffset?: number;
  /** Hardcore campaign (instability carries over; Arcane Purge halves it). */
  hardcore?: boolean;
  /** Instability carried in (Hardcore). */
  initialInstability?: number;
  /** Combo carried from the previous Campaign level. */
  initialCombo?: number;
  /** Campaign: Clean Streak carried in from the previous level of the chapter (D-046). */
  initialCleanStreak?: number;
  /** Words carried over from the previous level (D-055). */
  initialWords?: readonly WordState[];
  /** Spells to show in the HUD (default: those this level can drop, plus any held). */
  knownSpells?: readonly SpellId[];
  /** The player's number-key layout (index 0 = key 1). */
  spellSlots?: readonly SpellId[];
  /** Normal: number keys cast spells directly. */
  quickCast?: boolean;
  /** Campaign: introduce this spell with a pop-up before the level starts. */
  spellIntro?: SpellId | null;
  /** Words to play with (the player's chosen banks). Duels always use the default list. */
  words?: readonly string[];
  /** Present only in a Wizard Duel. */
  duel?: DuelOptions;
}

/**
 * Wizard Duel mode (decisions.md D-024). The game follows a shared clock
 * instead of frame time, cannot pause, and streams commands to the server.
 */
export interface DuelOptions {
  /** performance.now() at which tick 0 begins (end of the countdown). */
  startPerf: number;
  durationMs: number;
  rivalName: string;
  /** Called every frame (used to stream commands to the server). */
  onFrame(engine: GameEngine, now: number): void;
  /** Esc: open the duel menu. */
  onMenu(): void;
}

/** Most ticks a duel catches up in one frame (e.g. after the tab was hidden). */
const MAX_CATCH_UP_TICKS = 600;

/** Longest real-time gap simulated in one frame (avoids a burst after a stall). */
const MAX_FRAME_MS = 250;
/** Time the level-intro banner holds before words start falling. */
const INTRO_MS = 1400;
/** Pause after the last word so the final effect is seen before results. */
const RESULTS_DELAY_MS = 700;
/** Keys the game uses that the browser would otherwise act on. */
const CAPTURED_KEYS = 'BACKSPACE,SPACE,ENTER,DELETE';

/**
 * Connects the GameEngine (rules) to the screen and keyboard. The scene owns
 * no game rules: it forwards input to the engine, steps it at a fixed rate
 * and draws what the engine reports.
 */
export class GameScene extends Phaser.Scene {
  static readonly KEY = 'GameScene';

  private engine!: GameEngine;
  private wordClassCounts = emptyWordClassCounts();
  private phraseTracker = new PhraseTracker();
  private phraseBanner: Phaser.GameObjects.Text | null = null;

  /** A single short-lived, noninteractive callout; replaces rather than stacks banners. */
  private showPhraseBanner(id: 'awakening' | 'illumination' | 'incantation', glyph: string, title: string): void {
    if (this.phraseBanner) {
      this.tweens.killTweensOf(this.phraseBanner);
      this.phraseBanner.destroy();
    }
    const banner = this.add.text(LAYOUT.width / 2, 165, `${glyph}  ${title.toUpperCase()}  ${glyph}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: { awakening: '#ffc18b', illumination: '#d9e8a9', incantation: '#c9c5ff' }[id],
      stroke: '#3b251b',
      strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5).setDepth(85).setAlpha(1);
    this.phraseBanner = banner;
    this.tweens.add({
      targets: banner,
      y: 137,
      alpha: 0,
      duration: 1150,
      ease: 'Cubic.Out',
      onComplete: () => {
        if (this.phraseBanner === banner) this.phraseBanner = null;
        banner.destroy();
      },
    });
  }


  private config!: DifficultyConfig;
  private hooks!: GameSceneHooks;
  private scoreOffset = 0;
  private readonly views = new Map<number, WordView>();
  private background!: FieldBackground;
  private effects!: Effects;
  private celebrate!: Celebrations;
  private intake!: Intake;
  private spellFx!: SpellEffects;
  private hud!: GameHUD;
  private accumulator = 0;
  private introRemainingMs = 0;
  private paused = false;
  /** Waiting for the player to dismiss the new-spell pop-up. */
  private awaitingIntro = false;
  private spellIntro: SpellId | null = null;
  private knownSpells: readonly SpellId[] = SPELL_IDS;
  private spellSlots: readonly SpellId[] = SPELL_IDS;
  private quickCast = false;
  private duel: DuelOptions | null = null;
  private duelMenuOpen = false;
  private countdownText: Phaser.GameObjects.Text | null = null;
  /** A brief freeze of game time when a spell is cast, so the moment lands (D-045). */
  private hitStopMs = 0;
  private streakFx!: StreakFeedback;
  private prototypeCombo!: Phaser.GameObjects.Text;
  private prototypeMeter!: Phaser.GameObjects.Graphics;
  private prototypeKey!: Phaser.GameObjects.Rectangle;
  private volleyIndicator!: Phaser.GameObjects.Text;
  private typebar!: Phaser.GameObjects.Rectangle;
  private carriage!: Phaser.GameObjects.Rectangle;
  private volleyCallout!: Phaser.GameObjects.Text;
  private lastTierUpAt = -1000;
  private lastArcaneVolleySound = 1;
  private readonly workshopCandles: Array<(lit: boolean) => void> = [];
  private readonly scrollSeals: Phaser.GameObjects.Arc[] = [];
  /** Last elemental spell lingering in the workshop, for visible spell reactions. */

  constructor() {
    super(GameScene.KEY);
  }

  init(data: GameSceneData): void {
    this.config = data.config;
    this.hooks = data.hooks;
    this.duel = data.duel ?? null;
    this.duelMenuOpen = false;
    this.countdownText = null;
    this.scoreOffset = data.scoreOffset ?? 0;
    this.engine = new GameEngine({
      config: this.config,
      seed: data.seed ?? createSeed(),
      // A duel must use the shared default list so the server can check it.
      words: data.duel ? WORDS : (data.words ?? WORDS),
      initialSpells: data.initialSpells,
      hardcore: data.hardcore,
      // Development preview only. Duel/replay rules remain unchanged.
      experimentalScoring: !data.duel,
      initialInstability: data.initialInstability,
      initialCombo: data.initialCombo,
      initialCleanStreak: data.initialCleanStreak,
      initialWords: data.initialWords,
    });
    this.wordClassCounts = emptyWordClassCounts();
    this.phraseTracker = new PhraseTracker();
    this.phraseBanner = null;
    this.views.clear();
    this.workshopCandles.length = 0;
    this.scrollSeals.length = 0;
    this.accumulator = 0;
    this.introRemainingMs = this.duel ? 0 : INTRO_MS;
    this.paused = false;
    this.spellIntro = this.duel ? null : (data.spellIntro ?? null);
    this.awaitingIntro = false;
    const held = SPELL_IDS.filter((id) => (data.initialSpells?.[id] ?? 0) > 0);
    this.spellSlots = data.spellSlots ?? SPELL_IDS;
    this.quickCast = !data.duel && data.quickCast === true;
    this.knownSpells =
      data.knownSpells ?? SPELL_IDS.filter((id) => this.config.availableSpells.includes(id) || held.includes(id));
  }

  /** Music drive (D-054): how far through the stage and this level we are, 0–1. */
  private drive(): number {
    const c = this.config;
    const stagePos = Math.min(1, Math.max(0, ((c.stageLevel ?? c.level) - 1) / 19));
    const s = this.engine.state;
    const inLevel = c.requiredWords
      ? s.completed / c.requiredWords
      : c.survivalMs
        ? this.engine.elapsedMs / c.survivalMs
        : c.rampWords
          ? (s.completed % c.rampWords) / c.rampWords
          : 0;
    return 0.55 * stagePos + 0.45 * Math.min(1, inLevel);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.midnight);
    // The chapter's scene; weather builds level by level, and bosses get their own scene.
    const chapter = this.config.chapter ?? Math.ceil(this.config.level / 5);
    const boss = isSurvival(this.config);
    audio.setMood(boss ? 'boss' : 'calm');
    audio.setStress(instabilityStage(this.engine.state.instability));
    audio.setHeat(Math.min(4, Math.floor(this.engine.state.combo / 10)));
    audio.setDrive(this.drive());
    audio.levelStart();
    this.background = new FieldBackground(this, chapter, boss ? 4 : Math.min(3, Math.floor(((this.config.stageLevel ?? this.config.level) - 1) / 5)), boss);

    this.effects = new Effects(this);
    this.celebrate = new Celebrations(this);
    this.intake = new Intake(this);
    this.spellFx = new SpellEffects(this);
    this.hud = new GameHUD(
      this,
      this.duel ? this.duelTitle(this.duel.durationMs) : `Level ${this.config.level} · ${this.config.name}`,
      this.config.requiredWords,
      this.scoreOffset,
      this.duel?.rivalName,
      this.knownSpells,
      this.spellSlots,
      this.quickCast,
    );
    this.hud.setSpells(this.engine.state.spells);
    this.hud.setMana(totalCharges(this.engine.state.spells), this.engine.poolLimit);
    this.streakFx = new StreakFeedback(this, this.hud.streakAnchor);
    this.hud.setStreak(this.engine.state.cleanStreak);
    // Candles and wax seals frame the combat window without obscuring words.
    for (const x of [80, 1215]) {
      this.add.ellipse(x, 477, 56, 12, 0x160f0b, 0.75).setDepth(28);
      this.add.rectangle(x, 452, 19, 49, 0xd9c39a).setStrokeStyle(2, 0x8b673d).setDepth(29);
      const outerFlame = this.add.ellipse(x, 429, 15, 21, 0xffd47e, 0.85).setDepth(30);
      const flame = this.add.ellipse(x, 425, 7, 15, 0xfff3b2).setDepth(31);
      const glow = this.add.ellipse(x, 421, 42, 55, 0xffb759, 0.08)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(27);
      this.tweens.add({ targets: flame, scaleX: 0.68, scaleY: 1.2,
        yoyo: true, repeat: -1, duration: 550 + (x % 130), ease: 'Sine.InOut' });
      // The desk is a place, not a static HUD: candles are tangible objects.
      // Click to snuff or rekindle them; they never consume spell charges.
      let lit = true;
      const setLit = (next: boolean) => {
        lit = next;
        outerFlame.setVisible(lit);
        flame.setVisible(lit);
        glow.setVisible(lit);
      };
      this.workshopCandles.push(setLit);
      const candle = this.add.zone(x, 449, 48, 85).setInteractive({ useHandCursor: true });
      candle.setDepth(32);
      candle.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        setLit(!lit);
        if (lit) audio.key();
      });
    }
    // Apprentice's workstation: decorative materials stay below the ward,
    // while instruments remain outside the falling-word lanes.
    const desk = this.add.graphics().setDepth(34);
    desk.fillStyle(0x25160e, 0.95).fillRoundedRect(356, 510, 610, 130, 14);
    desk.lineStyle(4, 0x9b7040).strokeRoundedRect(356, 510, 610, 130, 14);
    desk.fillStyle(0x48301b, 1).fillRoundedRect(366, 520, 590, 112, 10);
    desk.lineStyle(2, 0xd0a05b, 0.7).strokeRoundedRect(366, 520, 590, 112, 10);
    desk.fillStyle(0x1b120d, 0.9).fillRoundedRect(386, 575, 360, 43, 8);
    desk.lineStyle(2, 0x947047).strokeRoundedRect(386, 575, 360, 43, 8);
    // Brass typebar teeth: a visual rhythm behind the existing parchment input.
    for (let i = 0; i < 14; i++) {
      this.add.rectangle(407 + i * 23, 598, 15, 19, i % 2 ? 0x8b6943 : 0xb58b52)
        .setStrokeStyle(1, 0x24170e).setDepth(35);
    }
    this.add.rectangle(568, 532, 218, 8, 0xd6b780).setStrokeStyle(1, 0x49301d).setDepth(35);
    this.carriage = this.add.rectangle(568, 532, 36, 9, 0xf1d29a).setDepth(37);
    this.typebar = this.add.rectangle(402, 585, 6, 26, 0xe3b878).setDepth(38);
    this.add.text(565, 626, 'THE ARCANE PRESS  ·  BRASS & INK', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#e5c48b',
    }).setOrigin(0.5).setDepth(39);

    // Small, high-contrast instruments at the side of the battlefield.
    this.add.rectangle(78, 111, 142, 114, 0x23170f, 0.94).setStrokeStyle(3, 0xb58a4c).setDepth(95);
    this.add.text(78, 72, 'ARCANE LEDGER', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#d4b37c',
    }).setOrigin(0.5).setDepth(96);
    this.prototypeCombo = this.add.text(78, 100, 'CHAIN 0', {
      fontFamily: 'Georgia, serif', fontSize: '19px', color: '#f1d5a1',
    }).setOrigin(0.5).setDepth(96);
    this.volleyIndicator = this.add.text(78, 125, 'VOLLEY  0 / 3', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#bda580',
    }).setOrigin(0.5).setDepth(96);
    this.prototypeMeter = this.add.graphics().setDepth(96);
    this.add.rectangle(399, 598, 30, 28, 0x382516, 1).setStrokeStyle(2, 0xc39a60).setDepth(38);
    this.prototypeKey = this.add.rectangle(399, 593, 19, 11, 0xc9a36b, 1).setDepth(39);
    this.volleyCallout = this.add.text(635, 230, '', {
      fontFamily: 'Georgia, serif', fontSize: '40px', fontStyle: 'bold',
      color: '#f6d287', stroke: '#2b170d', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0).setDepth(120);
    this.add.text(1194, 630, 'SCROLLS & SIGILS', { fontFamily: 'Georgia, serif', fontSize: '13px', color: '#f0c98e' }).setOrigin(0.5).setDepth(45);
    // Eight wax seals provide a physical glanceable inventory below the rack.
    // Their colours are the actual spell colours, dimmed when no scroll is held.
    this.spellSlots.forEach((spell, i) => {
      const x = 1121 + (i % 4) * 43;
      const y = 654 + Math.floor(i / 4) * 32;
      this.add.circle(x, y, 13, 0x39271b).setStrokeStyle(1.5, 0x8e6c45).setDepth(45);
      const seal = this.add.circle(x, y, 9, SPELL_COLORS[spell], 0.2).setDepth(46);
      this.scrollSeals.push(seal);
      this.add.text(x, y, String(i + 1), {
        fontFamily: 'Georgia, serif', fontSize: '11px',
        color: '#f8e5c5', stroke: '#2d1c12', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(47);
    });
    this.refreshScrollSeals(this.engine.state.spells);
    this.refreshPrototypeInstruments();
    if (this.engine.state.barrier > 0) {
      this.background.setShield(true);
      this.hud.setShield(this.engine.state.barrier);
    }
    const startInstability = this.engine.state.instability;
    if (startInstability > 0) {
      const stage = instabilityStage(startInstability);
      this.hud.setInstability(startInstability, stage);
      this.background.setStage(stage);
    }
    if (isSurvival(this.config)) this.hud.setSurvival(this.config.survivalMs!, this.config.survivalMs!);
    if (this.duel) this.showCountdown();
    else if (this.spellIntro && this.hooks.onSpellIntro) {
      this.awaitingIntro = true;
      this.hooks.onSpellIntro(this.spellIntro, () => {
        if (!this.awaitingIntro || !this.scene.isActive()) return;
        this.awaitingIntro = false;
        this.input.keyboard?.enableGlobalCapture();
        this.showIntro();
      });
    } else this.showIntro();

    this.wireEngineEvents();

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown', this.onKeyDown, this);
    keyboard.addCapture(CAPTURED_KEYS);
    keyboard.enableGlobalCapture();
    // Let Enter/Space reach the pop-up's HTML button until it is dismissed.
    if (this.awaitingIntro) keyboard.disableGlobalCapture();
    this.input.on('pointerdown', this.onPointerDown, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', this.onKeyDown, this);
      keyboard.removeCapture(CAPTURED_KEYS);
      this.input.off('pointerdown', this.onPointerDown, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.onBlur, this);
      this.engine.events.clear();
      this.views.clear();
    });

    if (import.meta.env.DEV) {
      (window as unknown as { wizzyEngine: GameEngine }).wizzyEngine = this.engine;
    }
  }

  override update(_time: number, delta: number): void {
    // The score counter keeps rolling through the finale.
    if (!this.paused) this.hud.update(Math.min(delta, MAX_FRAME_MS));
    if (this.engine.status === 'playing') audio.setDrive(this.drive());
    if (this.duel) return this.updateDuel(this.duel);
    if (this.paused || this.awaitingIntro || this.engine.status !== 'playing') return;

    const frame = Math.min(delta, MAX_FRAME_MS);
    if (this.introRemainingMs > 0) {
      this.introRemainingMs -= frame;
      return;
    }

    if (this.hitStopMs > 0) {
      this.hitStopMs -= frame;
      for (const view of this.views.values()) view.sync(1);
      return;
    }
    this.accumulator += frame;
    while (this.accumulator >= SIMULATION_STEP_MS && this.engine.status === 'playing') {
      this.engine.step();
      this.accumulator -= SIMULATION_STEP_MS;
    }

    const alpha = this.accumulator / SIMULATION_STEP_MS;
    for (const view of this.views.values()) view.sync(alpha);
    this.hud.updateStats(this.engine.stats(), this.engine.state.combo, !this.duel);
    this.refreshPrototypeInstruments();
    const left = this.engine.survivalRemainingMs;
    if (left !== null) this.hud.setSurvival(this.config.survivalMs!, left);
  }

  private refreshScrollSeals(charges: SpellCharges): void {
    this.spellSlots.forEach((spell, i) => {
      const seal = this.scrollSeals[i];
      if (!seal) return;
      const count = charges[spell] ?? 0;
      seal.setAlpha(count > 0 ? 1 : 0.2);
      seal.setScale(count > 1 ? 1.14 : 1);
    });
  }

  /** The scroll physically unrolls from its rack before its magic disperses. */
  private animateScrollCast(spell: SpellId): void {
    const x = LAYOUT.rack.x + LAYOUT.rack.width / 2;
    const y = LAYOUT.rack.y + 68;
    const color = SPELL_COLORS[spell];
    const scroll = this.add.container(x, y).setDepth(116);
    const parchment = this.add.rectangle(0, 0, 30, 26, 0xe7c99a)
      .setStrokeStyle(2, 0x76502c);
    const rollTop = this.add.ellipse(0, -13, 35, 8, 0xc69d67);
    const rollBottom = this.add.ellipse(0, 13, 35, 8, 0xc69d67);
    const glyph = this.add.text(0, 0, '✦', {
      fontFamily: 'Georgia, serif', fontSize: '18px',
      color: '#5b3b20', align: 'center',
    }).setOrigin(0.5);
    scroll.add([parchment, rollTop, rollBottom, glyph]);
    this.tweens.add({
      targets: scroll, x: x - 85, y: y - 78, angle: -14,
      scaleX: 1.7, scaleY: 2.1, duration: 240, ease: 'Cubic.Out',
      onComplete: () => {
        this.spellFx.burst(x - 85, y - 78, color, 18);
        this.tweens.add({
          targets: scroll, alpha: 0, y: y - 115, scale: 2.5,
          duration: 240, ease: 'Cubic.In',
          onComplete: () => scroll.destroy(),
        });
      },
    });
  }

  private refreshPrototypeInstruments(): void {
    if (!this.prototypeCombo || !this.prototypeMeter) return;
    const combo = this.engine.state.combo;
    const tier = Math.floor(combo / 10);
    this.prototypeCombo.setText('COMBO ' + combo + '  ·  ×' + precisionComboMultiplier(combo));
    const recent = this.engine.state.recentCaptures;
    const volley = recent.filter((tick) => this.engine.state.tick - tick <= VOLLEY_TICKS).length;
    const volleyMult = this.engine.volleyMultiplier;
    if (!this.duel) this.hud.setVolley(volleyMult, combo);
    this.volleyIndicator.setText(volleyMult >= 5 ? 'VOLLEY ×' + volleyMult.toFixed(1) + ' · MASTERY' : volleyMult >= 2 ? 'VOLLEY ×' + volleyMult.toFixed(1) + ' · ARCANE SURGE' : 'VOLLEY ×' + volleyMult.toFixed(1) + ' · KINDLING');
    this.volleyIndicator.setColor(volleyMult >= 5 ? '#cf9dff' : volleyMult >= 2 ? '#f6d287' : '#bda580');
    this.prototypeMeter.clear();
    // Two physical brass gauges: chain strength above, Volley time remaining below.
    // Both read the engine clock, so pauses and hit-stop never desynchronise them.
    this.prototypeMeter.fillStyle(0x100c09, 1).fillRoundedRect(22, 148, 112, 7, 2);
    this.prototypeMeter.fillStyle(tier >= 3 ? 0x8dd8c2 : 0xd9a75f, 1);
    if (combo > 0) this.prototypeMeter.fillRoundedRect(22, 148, Math.max(4, 112 * Math.min(1, combo / 25)), 7, 2);
    this.prototypeMeter.fillStyle(0x100c09, 1).fillRoundedRect(22, 160, 112, 5, 2);
    if (recent.length > 0 && volley > 0) {
      const oldest = recent.find((tick) => this.engine.state.tick - tick <= VOLLEY_TICKS);
      if (oldest !== undefined) {
        const remaining = Math.max(0, 1 - (this.engine.state.tick - oldest) / VOLLEY_TICKS);
        this.prototypeMeter.fillStyle(volley >= 3 ? 0xf6d287 : 0x9cc8bd, 1);
        this.prototypeMeter.fillRoundedRect(22, 160, Math.max(2, 112 * remaining), 5, 2);
      }
    }
  }

  /** Swap rules and callbacks without recreating the Phaser scene or engine. */
  continueIntoEndless(config: DifficultyConfig, hooks: GameSceneHooks): void {
    // The victory screen is gone; remove its Phaser text and score overlays too.
    this.celebrate.clearFinale();
    this.engine.continueIntoEndless(config);
    this.config = config;
    this.hooks = hooks;
    this.hud.setEndlessMode(`Endless · ${config.name}`);
    this.introRemainingMs = 0;
    this.accumulator = 0;
    this.input.keyboard?.enableGlobalCapture();
    audio.setMood('calm');
  }

  /** Called by the app's Resume button. */
  resumeGame(): void {
    this.setPaused(false);
  }

  // ───────────────────────── Wizard Duel ─────────────────────────

  /**
   * Duel time follows the shared clock: the engine is stepped until its tick
   * matches the time since the start, so both players' games (and the
   * server's copies) advance at the same rate. If the tab was hidden, the
   * game catches up rather than pausing — a duel cannot be paused.
   */
  private updateDuel(duel: DuelOptions): void {
    const now = performance.now();
    const elapsed = now - duel.startPerf;
    this.updateCountdown(elapsed);

    if (elapsed >= 0 && this.engine.status === 'playing') {
      const target = Math.floor(elapsed / SIMULATION_STEP_MS);
      let steps = 0;
      while (this.engine.state.tick < target && this.engine.status === 'playing' && steps++ < MAX_CATCH_UP_TICKS) {
        this.engine.step();
      }
      const alpha = Phaser.Math.Clamp(elapsed / SIMULATION_STEP_MS - this.engine.state.tick, 0, 1);
      for (const view of this.views.values()) view.sync(alpha);
      this.hud.updateStats(this.engine.stats(), this.engine.state.combo, !this.duel);
      this.hud.setTitle(this.duelTitle(duel.durationMs - elapsed));
    }
    duel.onFrame(this.engine, now);
  }

  private duelTitle(remainingMs: number): string {
    const s = Math.max(0, Math.ceil(remainingMs / 1000));
    return `Duel · Level ${this.config.level} · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  private showCountdown(): void {
    this.countdownText = this.add
      .text(LAYOUT.width / 2, LAYOUT.spawnY + 230, '', {
        fontFamily: FONTS.heading,
        fontSize: '96px',
        color: hex(PALETTE.gold),
        align: 'center',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, hex(PALETTE.arcane), 24, false, true)
      .setDepth(40);
    this.add
      .text(LAYOUT.width / 2, LAYOUT.spawnY + 330, `vs ${this.duel!.rivalName}`, {
        fontFamily: FONTS.heading,
        fontSize: '28px',
        color: hex(PALETTE.parchment),
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setName('rival-banner');
  }

  private updateCountdown(elapsed: number): void {
    const text = this.countdownText;
    if (!text) return;
    if (elapsed < 0) {
      text.setText(String(Math.ceil(-elapsed / 1000)));
    } else if (elapsed < 700) {
      text.setText('Duel!');
    } else {
      text.destroy();
      this.children.getByName('rival-banner')?.destroy();
      this.countdownText = null;
    }
  }

  /** The app's "Keep fighting" button. */
  closeDuelMenu(): void {
    this.duelMenuOpen = false;
  }

  /** Live rival state from the server. */
  setRival(score: number, instability: number, alive: boolean): void {
    this.hud?.setRival(score, instability, alive);
  }

  /** Current results, for ending a Practice session from the pause menu. */
  snapshot(): { stats: GameStats; spells: SpellCharges } {
    return { stats: { ...this.engine.stats(), wordClassCounts: { ...this.wordClassCounts }, phraseCounts: { ...this.phraseTracker.counts } }, spells: { ...this.engine.state.spells } };
  }

  // ───────────────────────── engine → screen ─────────────────────────

  private wireEngineEvents(): void {
    const ev = this.engine.events;

    ev.on('wordMissed', () => this.phraseTracker.breakChain());
    ev.on('wordSpawned', ({ word }) => {
      this.views.set(
        word.id,
        new WordView(this, word),
      );
    });

    // ── Clean Streak (D-046) ──
    ev.on('cleanStreakChanged', ({ count, previous, tier, multiplier, previousMultiplier, reason }) => {
      if (!this.duel) return; // Preview: Clean Streak is internal compatibility tracking only.
      this.hud.setStreak(count);
      const tierBefore = streakTierOf(previous);
      if (reason === 'capture') {
        if (tier > tierBefore) {
          // The combo's ×2 and Clean Streak I both arrive on the 5th word: let the
          // combo proclamation have its moment, then the streak's.
          const clash = this.time.now - this.lastTierUpAt < 100;
          this.streakFx.milestone(tier, multiplier, clash ? 750 : 0);
          if (clash) this.time.delayedCall(750, () => audio.streakMilestone(tier));
          else audio.streakMilestone(tier);
        }
      } else if (reason === 'typo') {
        this.streakFx.typo(previousMultiplier, multiplier, previous - count);
        this.hud.shakeStreak(1);
        audio.streakTypo(multiplier !== previousMultiplier);
      } else if (previous > 0) {
        if (reason === 'wrongEntry') {
          this.streakFx.lost(previous);
          this.hud.shakeStreak(2);
          audio.streakLost();
        } else {
          this.streakFx.broken(previous);
          this.hud.shakeStreak(3);
          audio.streakBroken(previous);
        }
      }
    });

    ev.on('wordCompleted', ({ word, points, combo, multiplier, bonuses }) => {
      const wordClass = classifyWord(word.text);
      if (wordClass) this.wordClassCounts[wordClass]++;
      const phrase = this.phraseTracker.capture(word.text);
      if (phrase) this.showPhraseBanner(phrase.id, phrase.glyph, phrase.title);
      audio.capture(combo, bonuses.map((b) => b.id));
      const volley = bonuses.find((b) => b.id === 'volley');
      if (!this.duel) {
        const currentVolley = this.engine.volleyMultiplier;
        audio.arcaneVolley(this.lastArcaneVolleySound, currentVolley);
        this.lastArcaneVolleySound = currentVolley;
      }
      if (volley && this.volleyCallout) {
        if (this.duel) audio.volley(volley.count);
        this.tweens.killTweensOf(this.volleyCallout);
        this.volleyCallout.setText('VOLLEY!  ×' + this.engine.volleyMultiplier).setY(230).setScale(0.8).setAlpha(1);
        this.tweens.add({ targets: this.volleyCallout, y: 184, scale: 1.15, alpha: 0, duration: 780, ease: 'Cubic.Out' });
      }
      const { x, y } = this.viewPosition(word.id, word.x, word.y);
      this.removeView(word.id);
      // The burst stays on the field; the points and bonuses are read out at the
      // desk instead, so nothing is written over a falling word (D-057).
      this.effects.wordDestroyed(x, y, word.text.length, points, multiplier, word.text, false);
      this.intake.claim(x, y, word.text, points, multiplier, bonuses);
      this.hud.console.flash(PALETTE.gold);
      if (combo > 1) this.hud.pulseCombo();
    });

    ev.on('wordsBurned', ({ words, points }) => {
      for (const word of words) {
        const { x, y } = this.viewPosition(word.id, word.x, word.y);
        this.removeView(word.id);
        this.spellFx.burnWord(x, y);
      }
      if (points > 0) this.effects.floatText(LAYOUT.width / 2, LAYOUT.spawnY + 300, `+${points}`, PALETTE.fire, 30);
    });

    ev.on('wordsShocked', ({ words, points }) => {
      const at = words.map((w) => this.viewPosition(w.id, w.x, w.y));
      for (const word of words) this.removeView(word.id);
      this.spellFx.lightning(at);
      if (points > 0) this.effects.floatText(LAYOUT.width / 2, LAYOUT.spawnY + 300, `+${points}`, PALETTE.lightning, 30);
    });

    ev.on('wordsHarvested', ({ words, points }) => {
      for (const word of words) {
        const { x, y } = this.viewPosition(word.id, word.x, word.y);
        this.removeView(word.id);
        this.spellFx.burst(x, y, PALETTE.harvest, 24);
      }
      if (points > 0) this.effects.floatText(LAYOUT.width / 2, LAYOUT.spawnY + 300, `+${points}`, PALETTE.harvest, 30);
    });

    ev.on('wordsTransmuted', ({ words }) => {
      for (const word of words) {
        const view = this.views.get(word.id);
        if (!view) continue;
        view.refreshText();
        this.spellFx.burst(view.x, view.y, PALETTE.transmute, 14);
      }
    });

    ev.on('wordBlocked', ({ word }) => {
      audio.blocked();
      this.removeView(word.id);
      this.spellFx.burst(screenX(word.x), LAYOUT.wardY - 10, PALETTE.shield, 26);
      this.background.flashBlocked();
    });

    ev.on('barrierChanged', ({ remaining }) => {
      this.background.setShield(remaining > 0);
      this.hud.setShield(remaining);
    });

    ev.on('slowChanged', ({ stacks }) => this.spellFx.setSlowStacks(stacks));

    ev.on('wordMissed', ({ word }) => {
      audio.miss();
      this.removeView(word.id);
      this.effects.wordBrokeThrough(screenX(word.x), LAYOUT.wardY);
      this.background.flashMiss();
    });

    ev.on('typingError', ({ wordId }) => {
      audio.typo();
      if (wordId !== null) this.views.get(wordId)?.flashError();
    });

    ev.on('inputChanged', () => this.refreshConsole());

    ev.on('submitMissed', ({ wordId }) => {
      audio.wrongEntry();
      this.hud.console.reject();
      if (wordId !== null) this.views.get(wordId)?.flashError();
    });

    ev.on('instabilityChanged', ({ value, stage }) => {
      this.hud.setInstability(value, stage);
      this.background.setStage(stage);
      audio.setStress(stage);
    });

    ev.on('progressChanged', ({ completed }) => this.hud.setProgress(completed));

    ev.on('spellCollected', ({ spell, stored, charges, overflowPoints, x, y }) => {
      this.hud.setSpells(charges, stored ? spell : undefined);
      this.refreshScrollSeals(charges);
      this.hud.setMana(totalCharges(charges), this.engine.poolLimit);
      if (stored) {
        audio.pickup();
        // A captured spell becomes a physical parchment scroll that flies into
        // the rack. It is purely presentational; the engine already banked it.
        const sx = screenX(x);
        const sy = screenY(y);
        audio.scrollFlight(Math.hypot(LAYOUT.rack.x + LAYOUT.rack.width / 2 - sx, LAYOUT.rack.y + 68 - sy) / 700);
        const scroll = this.add.container(sx, sy).setDepth(115);
        const paper = this.add.rectangle(0, 0, 34, 23, 0xe7c99a)
          .setStrokeStyle(2, 0x694426);
        const leftRoll = this.add.ellipse(-17, 0, 7, 27, 0xc69d67);
        const rightRoll = this.add.ellipse(17, 0, 7, 27, 0xc69d67);
        const seal = this.add.circle(0, 0, 7, SPELL_COLORS[spell]);
        scroll.add([paper, leftRoll, rightRoll, seal]);
        this.tweens.add({
          targets: scroll, x: LAYOUT.rack.x + LAYOUT.rack.width / 2,
          y: LAYOUT.rack.y + 68, scale: 0.55, angle: 340,
          duration: 620, ease: 'Cubic.In', onComplete: () => scroll.destroy(),
        });
        this.effects.floatText(LAYOUT.width / 2, LAYOUT.panelY - 24, `+1 ${SPELLS[spell].book} mana`, SPELL_COLORS[spell], 20);
        return;
      }
      // Pool full: the scroll fizzles to grey smoke where it was claimed (owner decision, 2026-11-17).
      audio.overflow();
      const sx = screenX(x);
      const sy = screenY(y);
      this.spellFx.burst(sx, sy, 0x9a948a, 40);
      this.spellFx.burst(sx, sy - 12, 0x5a5650, 24);
      this.effects.floatText(sx, sy - 34, `MANA FULL · +${overflowPoints}`, 0xd8d0c0, 26);
      this.hud.rackFull();
    });
    ev.on('manaPoolChanged', ({ size, lost, charges }) => {
      this.hud.setSpells(charges);
      this.refreshScrollSeals(charges);
      this.hud.setMana(totalCharges(charges), size, lost > 0 ? 'lost' : 'grew');
      if (lost > 0) {
        audio.overflow();
        this.hud.rackFull();
        this.effects.floatText(LAYOUT.rack.x + LAYOUT.rack.width / 2, LAYOUT.rack.y + 40, `−${lost} MANA`, PALETTE.crimson, 22);
      }
    });
    ev.on('surgeChanged', ({ active }) => {
      this.hud.setSurge(active);
      if (active) audio.tierDown(1);
    });

    ev.on('elementalReaction', ({ reaction, incoming, damageMultiplier }) => {
      const color = incoming === 'fire' ? PALETTE.fire : incoming === 'shock' ? PALETTE.lightning : PALETTE.parchment;
      const label = reaction.toUpperCase() + (damageMultiplier !== 1 ? '  ×' + damageMultiplier.toFixed(2) : '');
      this.effects.floatText(LAYOUT.width / 2, LAYOUT.spawnY + 175, label, color, 32);
      this.spellFx.burst(LAYOUT.width / 2, LAYOUT.spawnY + 225, color, 26);
      // Layered over the existing spell sound; avoids adding an untested audio API.
      audio.tierUp(1);
    });

    ev.on('spellCast', ({ spell, charges }) => {
      audio.cast(spell);
      if (!this.duel) this.hitStopMs = 140;
      this.hud.setSpells(charges, spell);
      this.refreshScrollSeals(charges);
      this.hud.setMana(totalCharges(charges), this.engine.poolLimit);
      this.hud.console.flash(SPELL_COLORS[spell]);
      this.spellFx.cast(spell);
      this.animateScrollCast(spell);
      // World rules: cold and wind extinguish exposed flames; fire relights them.
      // These are ambient interactions, not extra combat damage or mana costs.
      if (spell === 'ice' || spell === 'wind') this.workshopCandles.forEach((setLit) => setLit(false));
      else if (spell === 'fire') this.workshopCandles.forEach((setLit) => setLit(true));
      if (spell === 'ice') for (const view of this.views.values()) view.setFrozen(true);
    });

    ev.on('spellEnded', ({ spell }) => {
      this.spellFx.ended(spell);
      if (spell === 'ice') for (const view of this.views.values()) view.setFrozen(false);
    });

    ev.on('spellFizzled', ({ spell }) => {
      audio.error();
      this.hud.denySpell(spell);
      this.hud.console.reject();
    });

    // Charges change the console's "↵ cast" hint.
    ev.on('spellCollected', () => this.refreshConsole());

    ev.on('tierChanged', ({ tier, multiplier, up }) => {
      this.hud.tierChanged(up);
      if (up) {
        this.lastTierUpAt = this.time.now;
        audio.tierUp(tier);
        this.celebrate.tierUp(multiplier, tier);
      } else audio.tierDown(tier);
    });

    ev.on('gameOver', ({ result, stats }) => {
      let finaleMs = 0;
      if (result === 'won' && !this.duel) {
        audio.finale(isSurvival(this.config));
        try {
          finaleMs = this.celebrate.finale(isSurvival(this.config), stats.levelBonuses, stats.score, (p) => audio.counterTick(p));
        } catch (err) {
          console.error('Finale failed', err);
        }
      } else if (result === 'won') audio.fanfare();
      else audio.defeat();
      this.hud.updateStats(stats, this.engine.state.combo, !this.duel);
      this.input.keyboard!.disableGlobalCapture();
      if (this.duel) {
        // In a duel the server decides the result; wait for it.
        this.add
          .text(LAYOUT.width / 2, LAYOUT.spawnY + 250, 'Your wards have fallen…\nwaiting for the referee', {
            fontFamily: FONTS.heading,
            fontSize: '34px',
            color: hex(PALETTE.parchment),
            align: 'center',
          })
          .setOrigin(0.5)
          .setDepth(40);
        return;
      }
      const spells = { ...this.engine.state.spells };
      const instability = this.engine.state.instability;
      // Hand over to the results screen once. A browser timer backs up the
      // scene timer, so a rendering error can never leave the player stuck.
      let handed = false;
      const handOver = () => {
        if (handed) return;
        handed = true;
        this.hooks.onGameOver(result, { ...stats, wordClassCounts: { ...this.wordClassCounts }, phraseCounts: { ...this.phraseTracker.counts } }, spells, instability, this.engine.state.words.map((w) => ({ ...w })));
      };
      const delay = Math.max(RESULTS_DELAY_MS, finaleMs);
      this.time.delayedCall(delay, handOver);
      const backup = window.setTimeout(handOver, delay + 2500);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.clearTimeout(backup));
    });
  }

  private refreshConsole(): void {
    const s = this.engine.state;
    this.hud.console.update(s.input, this.engine.validPrefixLength, s.spells, this.engine.inputIsCompleteWord);
  }

  private viewPosition(id: number, fieldX: number, fieldY: number): { x: number; y: number } {
    const view = this.views.get(id);
    return { x: view?.x ?? screenX(fieldX), y: view?.y ?? screenY(fieldY) };
  }

  private removeView(id: number): void {
    this.views.get(id)?.destroy();
    this.views.delete(id);
  }

  /** "Level 3 · Whispering Stacks — Complete 35 words", then fades. */
  private showIntro(): void {
    const cx = LAYOUT.width / 2;
    const cy = LAYOUT.spawnY + 200;
    const title = this.add
      .text(cx, cy, `LEVEL ${this.config.level}\n${this.config.name.toUpperCase()}`, {
        fontFamily: FONTS.heading,
        fontSize: '48px',
        color: hex(PALETTE.gold),
        align: 'center',
        lineSpacing: 2,
      })
      .setOrigin(0.5)
      .setShadow(4, 4, hex(PALETTE.midnight), 0, false, true)
      .setDepth(40);
    const stageNo = this.config.stage ?? this.config.chapter ?? 1;
    if (!this.duel) {
      const where = this.add
        .text(cx, cy - 74, `STAGE ${stageNo} OF ${STAGE_NAMES.length}`, {
          fontFamily: FONTS.gameplay,
          fontSize: '20px',
          fontStyle: '700',
          color: hex(PALETTE.parchment),
        })
        .setShadow(3, 3, hex(PALETTE.midnight), 0, false, true)
        .setOrigin(0.5)
        .setDepth(40);
      this.tweens.add({ targets: where, alpha: 0, delay: INTRO_MS - 300, duration: 500, onComplete: () => where.destroy() });
    }
    const goal = isSurvival(this.config)
      ? `Boss · Survive for ${Math.round(this.config.survivalMs! / 1000)} seconds`
      : this.config.requiredWords === null
        ? 'Endless practice: survive as long as you can'
        : `Complete ${this.config.requiredWords} words`;
    const sub = this.add
      .text(cx, cy + 86, goal, { fontFamily: FONTS.gameplay, fontSize: '26px', fontStyle: '700', color: hex(PALETTE.parchment) })
      .setShadow(3, 3, hex(PALETTE.midnight), 0, false, true)
      .setOrigin(0.5)
      .setDepth(40);
    // The Grand Wizard offers a concise lesson on the first level; the
    // instruction fades with the level proclamation and never blocks typing.
    if (!this.duel && this.config.level === 1) {
      const mentor = this.add.text(cx, cy + 139,
        'GRAND WIZARD: Type the falling words and press Enter.\nBuild a chain to unleash a Volley. Bank spells and cast with 1–8.',
        { fontFamily: 'Georgia, serif', fontSize: '18px', color: '#f0d3a3',
          align: 'center', lineSpacing: 7, stroke: '#24160e', strokeThickness: 3 })
        .setOrigin(0.5).setDepth(41);
      this.tweens.add({ targets: mentor, alpha: 0, delay: INTRO_MS - 300,
        duration: 500, onComplete: () => mentor.destroy() });
    }
    this.tweens.add({
      targets: [title, sub],
      alpha: 0,
      delay: INTRO_MS - 300,
      duration: 500,
      onComplete: () => {
        title.destroy();
        sub.destroy();
      },
    });
  }

  // ───────────────────────── input → engine ─────────────────────────

  /**
   * Keyboard → typing console. Letters type (any case), Backspace deletes
   * one character (held down it repeats, like a normal text box),
   * Ctrl+Backspace or Delete clears, Enter submits, Esc pauses.
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (this.engine.status !== 'playing') return;
    const key = event.key;

    if (this.duel) {
      // A duel can't pause: Esc opens the forfeit menu while the game runs on.
      if (key === 'Escape' && !this.duelMenuOpen) {
        this.duelMenuOpen = true;
        this.duel.onMenu();
      }
      if (this.duelMenuOpen || performance.now() < this.duel.startPerf) return;
    } else {
      // The new-spell pop-up (HTML) has the keyboard until it is dismissed.
      if (this.awaitingIntro) return;
      if (key === 'Escape') return this.setPaused(!this.paused);
      if (this.paused || this.introRemainingMs > 0) return;
    }

    if (key === 'Backspace') {
      if (event.ctrlKey || event.altKey || event.metaKey) this.engine.clearInput();
      else this.engine.backspace();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (key === 'Delete') return this.engine.clearInput();
    if (event.repeat) return; // holding a letter or Enter should not repeat it
    if (key === 'Enter') return this.engine.submit();
    // Normal: number keys 1–8 cast the spell in that slot (words never contain digits).
    if (this.quickCast && key >= '1' && key <= '8') {
      const spell = this.spellSlots[Number(key) - 1];
      if (spell && this.knownSpells.includes(spell)) this.engine.quickCast(spell);
      return;
    }
    if (key.length === 1) {
      audio.key();
      this.prototypeKey?.setY(600);
      this.typebar?.setAngle(-22);
      this.carriage?.setX(568 + Math.min(80, this.engine.state.input.length * 7));
      if (this.typebar) {
        this.tweens.killTweensOf(this.typebar);
        this.tweens.add({ targets: this.typebar, angle: 0, duration: 95, ease: 'Cubic.Out' });
      }
      this.tweens.killTweensOf(this.prototypeKey);
      if (this.prototypeKey) this.tweens.add({ targets: this.prototypeKey, y: 593, duration: 85, ease: 'Cubic.Out' });
      this.engine.typeChar(key);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.paused || this.awaitingIntro || this.duelMenuOpen || this.engine.status !== 'playing') return;
    for (const view of this.views.values()) {
      if (view.hitTest(pointer.worldX, pointer.worldY)) {
        this.engine.selectTarget(view.word.id);
        return;
      }
    }
  }

  private onBlur(): void {
    if (this.duel || this.awaitingIntro) return; // duels never pause; the pop-up already waits
    if (this.engine.status === 'playing') this.setPaused(true);
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused || this.engine.status !== 'playing') return;
    this.paused = paused;
    const keyboard = this.input.keyboard!;
    if (paused) {
      this.tweens.pauseAll();
      // Let Space/Backspace work normally on the HTML pause buttons.
      keyboard.disableGlobalCapture();
    } else {
      this.tweens.resumeAll();
      keyboard.enableGlobalCapture();
      this.accumulator = 0;
    }
    this.hooks.onPauseChanged(paused);
  }
}
