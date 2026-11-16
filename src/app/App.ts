import type Phaser from 'phaser';
import type { GameResult } from '../core/GameEvents';
import type { LevelManager } from '../difficulty/LevelManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import { BackdropScene } from '../scenes/BackdropScene';
import { GameScene, type GameSceneData } from '../scenes/GameScene';
import type { SaveManager } from '../storage/SaveManager';
import {
  creditsScreen,
  levelSelectScreen,
  mainMenuScreen,
  pauseScreen,
  resultsScreen,
} from '../ui/screens';
import type { UIRoot } from '../ui/UIRoot';

/**
 * Top-level flow between screens: main menu → level select → play →
 * results → next level… It decides which Phaser scene runs and which HTML
 * screen is shown. Game rules stay in the engine; saving stays in SaveManager.
 */
export class App {
  constructor(
    private readonly game: Phaser.Game,
    private readonly ui: UIRoot,
    private readonly save: SaveManager,
    private readonly campaign: LevelManager,
  ) {}

  showMainMenu(): void {
    this.showBackdrop();
    this.ui.show(
      mainMenuScreen(
        { onCampaign: () => this.showLevelSelect(), onCredits: () => this.showCredits() },
        this.save.persistent,
      ),
    );
  }

  showLevelSelect(): void {
    this.showBackdrop();
    this.ui.show(
      levelSelectScreen(this.campaign.all, this.save.campaign, {
        onPlay: (level) => this.startLevel(level),
        onBack: () => this.showMainMenu(),
      }),
    );
  }

  showCredits(): void {
    this.showBackdrop();
    this.ui.show(creditsScreen(() => this.showMainMenu()));
  }

  startLevel(level: number): void {
    const config = this.campaign.get(level);
    const label = `Level ${config.level} · ${config.name}`;
    const data: GameSceneData = {
      config,
      hooks: {
        onPauseChanged: (paused) => {
          if (paused) {
            this.ui.show(
              pauseScreen(label, {
                onResume: () => this.gameScene.resumeGame(),
                onRestart: () => this.startLevel(level),
                onQuit: () => this.showLevelSelect(),
              }),
            );
          } else {
            this.ui.clear();
          }
        },
        onGameOver: (result, stats) => this.showResults(level, result, stats),
      },
    };

    this.ui.clear();
    this.game.scene.stop(BackdropScene.KEY);
    // start() restarts the scene if it is already running.
    this.game.scene.start(GameScene.KEY, data);
  }

  private showResults(level: number, result: GameResult, stats: GameStats): void {
    const outcome = this.save.recordCampaignResult(level, result, stats);
    this.ui.show(
      resultsScreen(this.campaign.get(level), result, stats, outcome, {
        onNext: () => this.startLevel(level + 1),
        onRetry: () => this.startLevel(level),
        onLevels: () => this.showLevelSelect(),
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
