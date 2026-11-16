import type Phaser from 'phaser';
import type { GameResult } from '../core/GameEvents';
import type { LevelManager } from '../difficulty/LevelManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import type { SpellCharges } from '../gameplay/SpellManager';
import { recordLevel, startRun, summarizeRun, type CampaignRun } from '../modes/CampaignMode';
import { BackdropScene } from '../scenes/BackdropScene';
import { GameScene, type GameSceneData } from '../scenes/GameScene';
import type { SaveManager } from '../storage/SaveManager';
import { creditsScreen, levelClearScreen, mainMenuScreen, pauseScreen, runOverScreen } from '../ui/screens';
import type { UIRoot } from '../ui/UIRoot';

/**
 * Top-level flow between screens. Campaign is a single run (D-016):
 * Main menu → Level 1 → Level cleared → Level 2 → … → Run over.
 * Game rules stay in the engine; saving stays in SaveManager.
 */
export class App {
  private run: CampaignRun | null = null;

  constructor(
    private readonly game: Phaser.Game,
    private readonly ui: UIRoot,
    private readonly save: SaveManager,
    private readonly campaign: LevelManager,
  ) {}

  showMainMenu(): void {
    this.run = null;
    this.showBackdrop();
    this.ui.show(
      mainMenuScreen(
        { onCampaign: () => this.startNewRun(), onCredits: () => this.showCredits() },
        this.save.campaign,
        this.save.persistent,
      ),
    );
  }

  showCredits(): void {
    this.showBackdrop();
    this.ui.show(creditsScreen(() => this.showMainMenu()));
  }

  startNewRun(): void {
    this.run = startRun();
    this.save.noteRunStarted();
    this.playCurrentLevel();
  }

  private playCurrentLevel(): void {
    const run = this.run;
    if (!run) return;
    const config = this.campaign.get(run.level);
    this.save.noteLevelReached(run.level);
    const label = `Level ${config.level} of ${this.campaign.count} · ${config.name}`;

    const data: GameSceneData = {
      config,
      initialSpells: run.spellCharges,
      scoreOffset: run.score,
      hooks: {
        onPauseChanged: (paused) => {
          if (!paused) return this.ui.clear();
          this.ui.show(
            pauseScreen(label, {
              onResume: () => this.gameScene.resumeGame(),
              onRestartRun: () => this.startNewRun(),
              onAbandon: () => this.showMainMenu(),
            }),
          );
        },
        onGameOver: (result, stats, spells) => this.onLevelEnd(result, stats, spells),
      },
    };

    this.ui.clear();
    this.game.scene.stop(BackdropScene.KEY);
    // start() restarts the scene if it is already running.
    this.game.scene.start(GameScene.KEY, data);
  }

  private onLevelEnd(result: GameResult, stats: GameStats, spells: SpellCharges): void {
    const run = this.run;
    if (!run) return;
    const clearedLevel = this.campaign.get(run.level);
    const { runOver, victory } = recordLevel(run, result, stats, spells, this.campaign.count);

    if (!runOver) {
      this.ui.show(
        levelClearScreen(clearedLevel, this.campaign.get(run.level), stats, run, () => this.playCurrentLevel()),
      );
      return;
    }

    const summary = summarizeRun(run, victory);
    const outcome = this.save.recordRun(summary);
    this.run = null;
    this.ui.show(
      runOverScreen(summary, outcome, clearedLevel, this.campaign.count, {
        onNewRun: () => this.startNewRun(),
        onMenu: () => this.showMainMenu(),
      }),
    );
  }

  private get gameScene(): GameScene {
    return this.game.scene.getScene(GameScene.KEY) as GameScene;
  }

  private showBackdrop(): void {
    this.game.scene.stop(GameScene.KEY);
    if (!this.game.scene.isActive(BackdropScene.KEY)) this.game.scene.start(BackdropScene.KEY);
  }
}
