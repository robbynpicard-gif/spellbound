import { triumphProgress } from '../gameplay/Triumphs';
import { codexScreen } from '../ui/codexScreen';
import type { WordState } from '../gameplay/Word';
import type Phaser from 'phaser';
import type { GameResult } from '../core/GameEvents';
import type { LevelManager } from '../difficulty/LevelManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import { WORDS } from '../data/wordList';
import { audio } from '../audio/Audio';
import { isSurvival } from '../difficulty/DifficultyConfig';
import { endlessConfig, INTRO_LEVEL, knownSpells, SPELL_LEVEL, spellsOfStage, STAGE_COUNT, STAGE_LEVELS, stageLevel } from '../difficulty/Stages';
import { SPELL_IDS, type SpellCharges, type SpellId } from '../gameplay/SpellManager';
import { recordLevel, startRun, summarizeRun, type CampaignMode, type CampaignRun } from '../modes/CampaignMode';
import { practiceConfig, type ModifierFilter } from '../modes/PracticeMode';
import { BackdropScene } from '../scenes/BackdropScene';
import { GameScene, type GameSceneData, type GameSceneHooks } from '../scenes/GameScene';
import type { LevelPick, SaveManager } from '../storage/SaveManager';
import { FILTER_LABELS, practiceResultsScreen, practiceSetupScreen } from '../ui/practiceScreens';
import {
  creditsScreen,
  levelClearScreen,
  audioToggleLabels,
  mainMenuScreen,
  optionsScreen,
  pauseScreen,
  runOverScreen,
  levelPickScreen,
  spellIntroScreen,
  stageSelectScreen,
} from '../ui/screens';
import type { UIRoot } from '../ui/UIRoot';
import { CAMPAIGN_UNLOCK_ALL, PRACTICE_UNLOCK_ALL } from './flags';
import { journeyStrip, statsScreen } from '../ui/statsScreens';
import { spellbookScreen } from '../ui/spellbookScreen';
import { trophyCaseScreen } from '../ui/trophyCaseScreen';
import { triumphUnlockAnnouncement } from '../ui/triumphUnlocks';

/**
 * Top-level flow between screens.
 * - Campaign (D-047): choose Normal or Hardcore and a stage; a run is one stage
 *   of 20 levels: Level 1 → Level cleared → … → boss → Stage cleared (new spell).
 *   The run is saved between levels and can be continued.
 * - Endless Practice (D-023): choose a level → play until the wards fall or
 *   you end the session → results with personal bests.
 * Game rules stay in the engine; saving stays in SaveManager.
 */
export class App {
  private run: CampaignRun | null = null;

  constructor(
    private readonly game: Phaser.Game,
    private readonly ui: UIRoot,
    private readonly save: SaveManager,
    readonly campaign: LevelManager,
  ) {}

  showMainMenu(): void {
    this.run = null;
    this.showBackdrop();
    this.ui.show(
      mainMenuScreen(
        {
          onCampaign: () => this.showCampaignModes(),
          onPractice: () => this.showPracticeSetup(),
          onCredits: () => this.showCredits(),
          onOptions: () => this.showOptions(),
          onStats: () => this.showStats(),
          onSpellbook: () => this.showSpellbook(),
          onTrophyCase: () => this.showTrophyCase(),
          onCodex: () => {
            this.showBackdrop();
            this.ui.show(codexScreen(() => this.showMainMenu()));
          },
        },
        this.progressLine(),
        this.save.persistent,
        this.save.featuredTriumph ? (triumphProgress(this.save.lifetime).find((t) => t.id === this.save.featuredTriumph && t.tier > 0)?.title ?? null) : null,
        this.save.featuredRune ? ({ volley: { glyph: '✦', name: 'Volley Rune' }, precision: { glyph: '❖', name: 'Precision Rune' }, chain: { glyph: '✧', name: 'Chain Rune' }, scribe: { glyph: '✳', name: 'Scribe Rune' } } as Record<string, { glyph: string; name: string }>)[this.save.featuredRune] ? { ...({ volley: { glyph: '✦', name: 'Volley Rune' }, precision: { glyph: '❖', name: 'Precision Rune' }, chain: { glyph: '✧', name: 'Chain Rune' }, scribe: { glyph: '✳', name: 'Scribe Rune' } } as Record<string, { glyph: string; name: string }>)[this.save.featuredRune], finish: this.save.runeFinish } : null : null,
      ),
    );

  }

  showOptions(focus: 'music' | 'sfx' | 'voice' | null = null): void {
    this.showBackdrop();
    this.ui.show(
      optionsScreen(
        this.save.audio,
        {
          onToggle: (ch) => {
            this.toggleAudio(ch);
            this.showOptions(ch);
          },
          onVolume: (ch, value) => {
            const key = ch === 'master' ? 'masterVolume' : ch === 'music' ? 'musicVolume' : ch === 'sfx' ? 'sfxVolume' : 'voiceVolume';
            audio.applySettings(this.save.setAudio({ [key]: value }));
          },
          onBack: () => this.showMainMenu(),
        },
        focus,
      ),
    );
  }

  /** Flip music or sound effects, save it, and apply it at once. */
  private toggleAudio(which: 'music' | 'sfx' | 'voice'): void {
    audio.applySettings(this.save.setAudio({ [which]: !this.save.audio[which] }));
  }

  /** Words for Campaign and Practice. */
  private get words(): string[] {
    return [...WORDS];
  }

  showStats(): void {
    this.showBackdrop();
    this.ui.show(statsScreen(this.save.lifetime, () => this.showMainMenu()));
  }

  showTrophyCase(): void {
    this.showBackdrop();
    this.ui.show(trophyCaseScreen(this.save.runeCounts, this.save.lifetime, this.save.featuredTriumph, (id) => { this.save.setFeaturedTriumph(id); this.showTrophyCase(); }, this.save.featuredRune, this.save.runeFinish, (id) => { this.save.setFeaturedRune(id); this.showTrophyCase(); }, (finish) => { this.save.setRuneFinish(finish); this.showTrophyCase(); }, () => this.showMainMenu()));
  }

  showCredits(): void {
    this.showBackdrop();
    this.ui.show(creditsScreen(() => this.showMainMenu()));
  }

  /** "Normal: 2 of 5 stages cleared · Hardcore: …", or null before any run. */
  private progressLine(): string | null {
    const modes: CampaignMode[] = ['normal', 'hardcore'];
    const played = modes.some((m) => this.save.records(m, 1).runsStarted > 0);
    if (!played) return null;
    const cleared = (m: CampaignMode) => [1, 2, 3, 4, 5].filter((st) => this.save.records(m, st).runsCompleted > 0).length;
    return `Normal: ${cleared('normal')} of ${STAGE_COUNT} stages cleared · Hardcore: ${cleared('hardcore')} of ${STAGE_COUNT}`;
  }

  showSpellbook(): void {
    this.showBackdrop();
    this.ui.show(
      spellbookScreen(this.save.spellSlots, (id) => this.discovered(id), {
        onSave: (slots) => this.save.setSpellSlots(slots),
        onBack: () => this.showMainMenu(),
      }),
    );
  }

  /** A spell counts as discovered once any Campaign run has reached the level that teaches it. */
  private discovered(spell: SpellId): boolean {
    if (PRACTICE_UNLOCK_ALL) return true; // testing build: everything is open
    const modes: CampaignMode[] = ['normal', 'hardcore'];
    for (let stage = 1; stage <= STAGE_COUNT; stage++) {
      const { atLevel2, atLevel10, fromBoss } = spellsOfStage(stage);
      for (const mode of modes) {
        const r = this.save.records(mode, stage);
        if (atLevel2 === spell && r.highestReached >= INTRO_LEVEL) return true;
        if (atLevel10 === spell && r.highestReached >= SPELL_LEVEL) return true;
        if (fromBoss === spell && r.runsCompleted > 0) return true;
      }
    }
    return false;
  }

  // ───────────────────────── Campaign ─────────────────────────

  /** Campaign: choose a mode and a stage, or continue a run in progress (D-047). */
  showCampaignModes(): void {
    this.run = null;
    this.showBackdrop();
    this.ui.show(
      stageSelectScreen(
        (mode, stage) => ({ records: this.save.records(mode, stage), unlocked: this.stageOpen(mode, stage) }),
        this.save.savedRun,
        this.save.takeResetNotice(),
        {
          onStart: (mode, stage) => (this.unlockAll ? this.showLevelPick(mode, stage) : this.startNewRun(mode, stage)),
          testing: {
            unlockAll: this.unlockAll,
            onToggleUnlock: () => {
              this.setUnlockAll(!this.unlockAll);
              this.showCampaignModes();
            },
            onReset: () => {
              this.save.resetCampaign();
              this.setUnlockAll(false);
              this.showCampaignModes();
            },
          },
          onContinue: () => this.continueRun(),
          onBack: () => this.showMainMenu(),
        },
      ),
    );
  }

  /** Testing toggle on the Campaign screen (D-055): everything open, or real progress. */
  private get unlockAll(): boolean {
    try {
      const v = localStorage.getItem('spellbound.preview.wizzytype.unlockAll');
      return v === null ? CAMPAIGN_UNLOCK_ALL : v === '1';
    } catch {
      return CAMPAIGN_UNLOCK_ALL;
    }
  }

  private setUnlockAll(on: boolean): void {
    try {
      localStorage.setItem('spellbound.preview.wizzytype.unlockAll', on ? '1' : '0');
    } catch {
      /* storage blocked: the toggle lasts this visit only */
    }
  }

  private stageOpen(mode: CampaignMode, stage: number): boolean {
    return this.unlockAll || this.save.stageUnlocked(mode, stage);
  }

  /** Testing build: choose which level of the stage to start the run at. */
  private showLevelPick(mode: CampaignMode, stage: number): void {
    this.ui.show(
      levelPickScreen(mode, stage, {
        onPick: (level) => this.startNewRun(mode, stage, level),
        onBack: () => this.showCampaignModes(),
      }),
    );
  }

  /** A fresh run of one stage (from `level`, testing only). Starting it replaces any saved run. */
  startNewRun(mode: CampaignMode, stage: number, level = 1): void {
    if (!this.stageOpen(mode, stage)) return this.showCampaignModes();
    this.run = startRun(mode, stage);
    if (level > 1) {
      // Jumping in: start at that level with 1 charge of each spell known there.
      this.run.level = Math.min(STAGE_LEVELS, level);
      for (const id of knownSpells(stage, this.run.level)) this.run.spellCharges[id] = Math.max(1, this.run.spellCharges[id]);
    }
    this.save.noteRunStarted(mode, stage);
    this.save.setSavedRun(this.run);
    this.playCurrentLevel();
  }

  /** Picks up the saved run at the level it stopped on. */
  continueRun(): void {
    const saved = this.save.savedRun;
    if (!saved) return this.showCampaignModes();
    this.run = JSON.parse(JSON.stringify(saved)) as CampaignRun;
    this.playCurrentLevel();
  }

  private playCurrentLevel(): void {
    const run = this.run;
    if (!run) return;
    const config = stageLevel(run.mode, run.stage, run.level);
    this.save.noteLevelReached(run.mode, run.stage, run.level);
    const modeLabel = run.mode === 'hardcore' ? ' · Hardcore' : '';
    const label = `Stage ${run.stage} · Level ${config.level} of ${STAGE_LEVELS} · ${config.name}${modeLabel}`;
    const held = SPELL_IDS.filter((id) => run.spellCharges[id] > 0);
    const known = knownSpells(run.stage, run.level);

    this.startScene({
      config,
      initialSpells: run.spellCharges,
      scoreOffset: run.score,
      hardcore: run.mode === 'hardcore',
      initialInstability: run.instability,
      initialWard: run.wardCap !== undefined ? { cap: run.wardCap, wagers: run.wardWagers ?? 0 } : undefined,
      initialCombo: run.combo,
      initialCleanStreak: run.cleanStreak,
      initialWords: run.carryWords,
      knownSpells: SPELL_IDS.filter((id) => known.includes(id) || held.includes(id)),
      spellSlots: this.save.spellSlots,
      quickCast: run.mode === 'normal',
      spellIntro: config.introducesSpell ?? null,
      words: this.words,
      hooks: {
        onPauseChanged: (paused) =>
          this.onPause(paused, label, [
            { label: 'Restart stage from level 1', onClick: () => this.startNewRun(run.mode, run.stage) },
            { label: 'Save and quit', onClick: () => this.showCampaignModes() },
            {
              label: 'Abandon run',
              onClick: () => {
                this.save.setSavedRun(null);
                this.showMainMenu();
              },
            },
          ], 'Save and quit continues from the start of this level'),
        onGameOver: (result, stats, spells, instability, words) => this.onLevelEnd(result, stats, spells, instability, words),
        onSpellIntro: (spell, begin) =>
          this.ui.show(
            spellIntroScreen(spell, config, () => {
              this.ui.clear();
              begin();
            }),
          ),
      },
    });
  }

  private onLevelEnd(result: GameResult, stats: GameStats, spells: SpellCharges, instability: number, words: WordState[] = []): void {
    const run = this.run;
    if (!run) return;
    const clearedLevel = stageLevel(run.mode, run.stage, run.level);
    const lifetimeBefore = structuredClone(this.save.lifetime);
    this.save.recordLevelStats(stats, result, { mode: 'campaign', boss: isSurvival(clearedLevel) });
    const triumphUnlocks = triumphUnlockAnnouncement(lifetimeBefore, this.save.lifetime);
    if (result === 'won') this.save.recordRunes(stats);
    const { runOver, victory } = recordLevel(run, result, stats, spells, instability);
    const journey = journeyStrip(run.stage, victory);

    if (!runOver) {
      run.carryWords = words;
      this.save.setSavedRun(run);
      this.ui.show(
        levelClearScreen(clearedLevel, stageLevel(run.mode, run.stage, run.level), stats, run, () => this.playCurrentLevel(), journey, triumphUnlocks),
      );
      return;
    }

    this.save.setSavedRun(null);
    const summary = summarizeRun(run, victory);
    const outcome = this.save.recordRun(summary, run.mode);
    // Let the player celebrate the boss victory and choose whether to
    // continue. Preserve the boss field until the Endless button is chosen.
    if (victory && isSurvival(clearedLevel)) run.carryWords = words;
    this.run = victory && isSurvival(clearedLevel) ? run : null;
    const nextStage = victory && run.stage < STAGE_COUNT ? run.stage + 1 : null;
    this.ui.show(
      runOverScreen(summary, outcome, clearedLevel, {
        onNewRun: () => this.startNewRun(run.mode, run.stage),
        onNextStage: nextStage ? () => this.startNewRun(run.mode, nextStage) : undefined,
        onEndless: victory ? () => this.startEndless(run.mode, run.stage) : undefined,
        spellWon: victory ? spellsOfStage(run.stage).fromBoss : null,
        extra: journey,
        triumphUnlocks,
        onMenu: () => this.showMainMenu(),
        mode: run.mode,
      }),
    );
  }

  /**
   * Endless mode (D-057): the stage's finishing pace, climbing without end.
   * The best score is kept per stage (stored as practice level 0).
   */
  startEndless(mode: CampaignMode, stage: number): void {
    const previous = this.run;
    const carry = previous?.mode === mode && previous.stage === stage && previous.level === STAGE_LEVELS ? previous : null;
    this.run = null;
    const pick: LevelPick = { mode, stage, level: 0 };
    const where = `Endless · ${mode === 'hardcore' ? 'Hardcore' : 'Normal'} · Stage ${stage}`;
    const endless = endlessConfig(mode, stage);
    const hooks: GameSceneHooks = {
      onPauseChanged: (paused) =>
        this.onPause(paused, where, [
          { label: 'End run and see your score', onClick: () => this.endPractice(pick, where, 'original', this.gameScene.snapshot().stats, false) },
          { label: 'Start again', onClick: () => this.startEndless(mode, stage) },
          { label: 'Back to the menu', onClick: () => this.showMainMenu() },
        ], 'Starting again or leaving ends this run'),
      onGameOver: (_result, stats) => this.endPractice(pick, where, 'original', stats, true),
    };
    if (carry && this.game.scene.isActive(GameScene.KEY)) {
      this.ui.clear();
      this.gameScene.continueIntoEndless(endless, hooks);
      return;
    }
    this.startScene({
      config: endless,
      hardcore: mode === 'hardcore',
      spellSlots: this.save.spellSlots,
      quickCast: mode === 'normal',
      ...(carry ? {
        initialSpells: carry.spellCharges,
        initialInstability: carry.instability,
        initialWard: carry.wardCap !== undefined ? { cap: carry.wardCap, wagers: carry.wardWagers ?? 0 } : undefined,
        initialCombo: carry.combo,
        initialCleanStreak: carry.cleanStreak,
        initialWords: carry.carryWords,
        scoreOffset: carry.score,
      } : {}),
      words: this.words,
      hooks: {
        onPauseChanged: (paused) =>
          this.onPause(paused, where, [
            {
              label: 'End run and see your score',
              onClick: () => this.endPractice(pick, where, 'original', this.gameScene.snapshot().stats, false),
            },
            { label: 'Start again', onClick: () => this.startEndless(mode, stage) },
            { label: 'Back to the menu', onClick: () => this.showMainMenu() },
          ], 'Starting again or leaving ends this run'),
        onGameOver: (_result, stats) => this.endPractice(pick, where, 'original', stats, true),
      },
    });
  }

  // ───────────────────────── Endless Practice ─────────────────────────

  /** Highest level reached in a stage, or 0 if the stage isn't open yet. */
  private reached(mode: CampaignMode, stage: number): number {
    if (PRACTICE_UNLOCK_ALL) return STAGE_LEVELS;
    return this.save.stageUnlocked(mode, stage) ? this.save.records(mode, stage).highestReached : 0;
  }

  showPracticeSetup(): void {
    this.run = null;
    this.showBackdrop();
    const p = this.save.practice;
    this.ui.show(
      practiceSetupScreen(
        (mode, stage) => this.reached(mode, stage),
        p.records,
        { ...p.last, filter: p.lastFilter },
        {
          onStart: (pick, filter) => this.startPractice(pick, filter),
          onBack: () => this.showMainMenu(),
        },
      ),
    );
  }

  startPractice(pick: LevelPick, filter: ModifierFilter): void {
    if (pick.level > this.reached(pick.mode, pick.stage)) return this.showPracticeSetup();
    this.save.notePracticeChoice(pick, filter);
    const base = stageLevel(pick.mode, pick.stage, pick.level);
    const where = `${pick.mode === 'hardcore' ? 'Hardcore' : 'Normal'} · Stage ${pick.stage} · Level ${pick.level}`;
    const label = `Practice · ${where} · ${FILTER_LABELS[filter].title}`;

    this.startScene({
      config: practiceConfig(base, filter),
      spellSlots: this.save.spellSlots,
      quickCast: pick.mode === 'normal',
      words: this.words,
      hooks: {
        onPauseChanged: (paused) =>
          this.onPause(paused, label, [
            {
              label: 'End session and see results',
              onClick: () => {
                const { stats } = this.gameScene.snapshot();
                this.endPractice(pick, where, filter, stats, false);
              },
            },
            { label: 'Restart session', onClick: () => this.startPractice(pick, filter) },
            { label: 'Change level', onClick: () => this.showPracticeSetup() },
          ], 'Restarting or changing level discards this session'),
        // Endless sessions only end by falling (there is no quota to win).
        onGameOver: (_result, stats) => this.endPractice(pick, where, filter, stats, true),
      },
    });
  }

  private endPractice(pick: LevelPick, where: string, filter: ModifierFilter, stats: GameStats, fell: boolean): void {
    // Stop the game (so Esc can't resume it behind the results) and show the sky backdrop.
    this.showBackdrop();
    const outcome = this.save.recordPractice(pick, filter, stats);
    const lifetimeBefore = structuredClone(this.save.lifetime);
    this.save.recordLevelStats(stats, fell ? 'lost' : 'won', { mode: 'practice' });
    const triumphUnlocks = triumphUnlockAnnouncement(lifetimeBefore, this.save.lifetime);
    this.save.recordRunes(stats);
    this.ui.show(
      practiceResultsScreen(where, filter, stats, outcome, fell, {
        onAgain: () => this.startPractice(pick, filter),
        onChangeLevel: () => this.showPracticeSetup(),
        onMenu: () => this.showMainMenu(),
      }, triumphUnlocks),
    );
  }

  // ───────────────────────── shared ─────────────────────────

  private onPause(
    paused: boolean,
    label: string,
    options: { label: string; onClick(): void }[],
    note: string,
  ): void {
    if (!paused) return this.ui.clear();
    const labels = audioToggleLabels(this.save.audio);
    const toggles = [
      { label: labels.music, onClick: () => (this.toggleAudio('music'), this.onPause(true, label, options, note)) },
      { label: labels.sfx, onClick: () => (this.toggleAudio('sfx'), this.onPause(true, label, options, note)) },
    ];
    this.ui.show(pauseScreen(label, () => this.gameScene.resumeGame(), [...options, ...toggles], note));
  }

  private startScene(data: GameSceneData): void {
    this.ui.clear();
    this.game.scene.stop(BackdropScene.KEY);
    // start() restarts the scene if it is already running.
    this.game.scene.start(GameScene.KEY, data);
  }

  private get gameScene(): GameScene {
    return this.game.scene.getScene(GameScene.KEY) as GameScene;
  }

  private showBackdrop(): void {
    audio.setMood('menu');
    audio.setStress(0);
    audio.setHeat(0);
    this.game.scene.stop(GameScene.KEY);
    if (!this.game.scene.isActive(BackdropScene.KEY)) this.game.scene.start(BackdropScene.KEY);
  }
}
