import type Phaser from 'phaser';
import type { GameResult } from '../core/GameEvents';
import type { LevelManager } from '../difficulty/LevelManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import { WORDS } from '../data/wordList';
import { audio } from '../audio/Audio';
import { isSurvival } from '../difficulty/DifficultyConfig';
import { knownSpells, spellsOfStage, STAGE_COUNT, STAGE_LEVELS, stageLevel } from '../difficulty/Stages';
import { SPELL_IDS, type SpellCharges } from '../gameplay/SpellManager';
import { recordLevel, startRun, summarizeRun, type CampaignMode, type CampaignRun } from '../modes/CampaignMode';
import { practiceConfig, type ModifierFilter } from '../modes/PracticeMode';
import { BackdropScene } from '../scenes/BackdropScene';
import { GameScene, type GameSceneData } from '../scenes/GameScene';
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
  spellIntroScreen,
  stageSelectScreen,
} from '../ui/screens';
import type { UIRoot } from '../ui/UIRoot';
import { journeyStrip, statsScreen } from '../ui/wizardScreens';

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
        },
        this.save.bestScore(),
        this.save.persistent,
      ),
    );
  }

  showOptions(focus: 'music' | 'sfx' | null = null): void {
    this.showBackdrop();
    this.ui.show(
      optionsScreen(
        this.save.audio,
        {
          onMusic: () => {
            this.toggleAudio('music');
            this.showOptions('music');
          },
          onSfx: () => {
            this.toggleAudio('sfx');
            this.showOptions('sfx');
          },
          onBack: () => this.showMainMenu(),
        },
        focus,
      ),
    );
  }

  /** Flip music or sound effects, save it, and apply it at once. */
  private toggleAudio(which: 'music' | 'sfx'): void {
    const next = this.save.setAudio({ [which]: !this.save.audio[which] });
    audio.setMusic(next.music);
    audio.setSfx(next.sfx);
  }

  /** Words for Campaign and Practice. */
  private get words(): string[] {
    return [...WORDS];
  }

  showStats(): void {
    this.showBackdrop();
    this.ui.show(statsScreen(this.save.lifetime, () => this.showMainMenu(), false));
  }

  showCredits(): void {
    this.showBackdrop();
    this.ui.show(creditsScreen(() => this.showMainMenu()));
  }

  // ───────────────────────── Campaign ─────────────────────────

  /** Campaign: choose a mode and a stage, or continue a run in progress (D-047). */
  showCampaignModes(): void {
    this.run = null;
    this.showBackdrop();
    this.ui.show(
      stageSelectScreen(
        (mode, stage) => ({ records: this.save.records(mode, stage), unlocked: this.save.stageUnlocked(mode, stage) }),
        this.save.savedRun,
        this.save.takeResetNotice(),
        {
          onStart: (mode, stage) => this.startNewRun(mode, stage),
          onContinue: () => this.continueRun(),
          onBack: () => this.showMainMenu(),
        },
      ),
    );
  }

  /** A fresh run of one stage. Starting it replaces any saved run. */
  startNewRun(mode: CampaignMode, stage: number): void {
    if (!this.save.stageUnlocked(mode, stage)) return this.showCampaignModes();
    this.run = startRun(mode, stage);
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
      initialCombo: run.combo,
      initialCleanStreak: run.cleanStreak,
      knownSpells: SPELL_IDS.filter((id) => known.includes(id) || held.includes(id)),
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
        onGameOver: (result, stats, spells, instability) => this.onLevelEnd(result, stats, spells, instability),
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

  private onLevelEnd(result: GameResult, stats: GameStats, spells: SpellCharges, instability: number): void {
    const run = this.run;
    if (!run) return;
    const clearedLevel = stageLevel(run.mode, run.stage, run.level);
    this.save.recordLevelStats(stats, result, { mode: 'campaign', boss: isSurvival(clearedLevel) });
    const { runOver, victory } = recordLevel(run, result, stats, spells, instability);
    const journey = journeyStrip(run.stage, victory);

    if (!runOver) {
      this.save.setSavedRun(run);
      this.ui.show(
        levelClearScreen(clearedLevel, stageLevel(run.mode, run.stage, run.level), stats, run, () => this.playCurrentLevel(), journey),
      );
      return;
    }

    this.save.setSavedRun(null);
    const summary = summarizeRun(run, victory);
    const outcome = this.save.recordRun(summary, run.mode);
    this.run = null;
    const nextStage = victory && run.stage < STAGE_COUNT ? run.stage + 1 : null;
    this.ui.show(
      runOverScreen(summary, outcome, clearedLevel, {
        onNewRun: () => this.startNewRun(run.mode, run.stage),
        onNextStage: nextStage ? () => this.startNewRun(run.mode, nextStage) : undefined,
        spellWon: victory ? spellsOfStage(run.stage).fromBoss : null,
        extra: journey,
        onMenu: () => this.showMainMenu(),
        mode: run.mode,
      }),
    );
  }

  // ───────────────────────── Endless Practice ─────────────────────────

  /** Highest level reached in a stage, or 0 if the stage isn't open yet. */
  private reached(mode: CampaignMode, stage: number): number {
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
    this.save.recordLevelStats(stats, fell ? 'lost' : 'won', { mode: 'practice' });
    this.ui.show(
      practiceResultsScreen(where, filter, stats, outcome, fell, {
        onAgain: () => this.startPractice(pick, filter),
        onChangeLevel: () => this.showPracticeSetup(),
        onMenu: () => this.showMainMenu(),
      }),
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
