import type Phaser from 'phaser';
import type { GameEngine } from '../core/GameEngine';
import type { LevelManager } from '../difficulty/LevelManager';
import { practiceConfig } from '../modes/PracticeMode';
import { GameSynchronizer } from '../multiplayer/GameSynchronizer';
import { NetworkClient, serverUrl } from '../multiplayer/NetworkClient';
import type { MatchEndMessage, RoomInfo, ServerMessage, StartMessage } from '../multiplayer/protocol';
import { GameScene } from '../scenes/GameScene';
import type { SaveManager } from '../storage/SaveManager';
import {
  connectingScreen,
  duelMenuScreen,
  duelResultScreen,
  lobbyScreen,
  offlineScreen,
  roomScreen,
} from '../ui/multiplayerScreens';
import type { UIRoot } from '../ui/UIRoot';

export interface MultiplayerHost {
  game: Phaser.Game;
  ui: UIRoot;
  save: SaveManager;
  campaign: LevelManager;
  showMainMenu(): void;
  showBackdrop(): void;
}

/**
 * Wizard Duel flow on the client (GDD §15.1, decisions.md D-024):
 * connect → lobby (create / join) → room (ready up) → duel → result → room…
 * The server decides results; this class only shows them.
 */
export class MultiplayerFlow {
  private readonly client = new NetworkClient();
  private room: RoomInfo | null = null;
  private you: string | null = null;
  private inDuel = false;
  private lastEnd: MatchEndMessage | null = null;
  private lobbyError: string | null = null;

  constructor(private readonly host: MultiplayerHost) {
    this.client.events.on('message', (m) => this.onMessage(m));
    this.client.events.on('closed', ({ reason }) => this.onClosed(reason));
  }

  /** Main menu → Multiplayer. */
  async open(): Promise<void> {
    this.host.showBackdrop();
    if (this.client.connected) return this.showLobby();
    let cancelled = false;
    this.host.ui.show(
      connectingScreen(() => {
        cancelled = true;
        this.client.close();
        this.host.showMainMenu();
      }),
    );
    const url = serverUrl();
    try {
      this.you = await this.client.connect(url, this.host.save.profile.name || 'Apprentice');
      if (!cancelled) this.showLobby();
    } catch (error) {
      if (cancelled) return;
      this.host.ui.show(
        offlineScreen(
          (error as Error).message,
          url,
          () => void this.open(),
          () => this.host.showMainMenu(),
        ),
      );
    }
  }

  /** Leaving multiplayer entirely. */
  close(): void {
    this.room = null;
    this.inDuel = false;
    this.client.close();
  }

  // ───────────────────────── screens ─────────────────────────

  private showLobby(): void {
    this.host.showBackdrop();
    const profile = this.host.save.profile;
    this.host.ui.show(
      lobbyScreen(this.host.campaign.all, { name: profile.name, level: profile.duelLevel }, this.lobbyError, {
        onCreate: (name, level) => {
          this.rememberName(name, level);
          this.client.send({ t: 'create', settings: { level } });
        },
        onJoin: (name, code) => {
          this.rememberName(name, profile.duelLevel);
          this.client.send({ t: 'join', code });
        },
        onBack: () => {
          this.close();
          this.host.showMainMenu();
        },
      }),
    );
    this.lobbyError = null;
  }

  /** The server only learns names on hello, so a changed name reconnects. */
  private rememberName(name: string, level: number): void {
    const before = this.host.save.profile.name;
    this.host.save.setProfile(name, level);
    if (this.host.save.profile.name !== before && this.client.connected) {
      // Reconnect quietly with the new name; the pending request is re-sent by the caller next time.
      this.client.send({ t: 'hello', version: 1, name: this.host.save.profile.name });
    }
  }

  private showRoom(): void {
    if (!this.room || !this.you) return;
    this.host.showBackdrop();
    this.host.ui.show(
      roomScreen(this.room, this.you, this.host.campaign.all, {
        onReady: (ready) => this.client.send({ t: 'ready', ready }),
        onLevel: (level) => {
          this.host.save.setProfile(this.host.save.profile.name, level);
          this.client.send({ t: 'settings', settings: { level } });
        },
        onLeave: () => {
          this.client.send({ t: 'leave' });
          this.room = null;
          this.showLobby();
        },
      }),
    );
  }

  // ───────────────────────── server messages ─────────────────────────

  private onMessage(m: ServerMessage): void {
    switch (m.t) {
      case 'room':
        this.room = m.room;
        this.you = m.you;
        // During a duel or on the result screen, room updates arrive in the background.
        if (!this.inDuel && !this.lastEnd) this.showRoom();
        return;
      case 'left':
        this.room = null;
        return;
      case 'error':
        if (this.inDuel) return; // the 'end' message explains what happened
        this.lobbyError = m.message;
        if (this.room) this.showRoom();
        else this.showLobby();
        return;
      case 'start':
        return this.startDuel(m);
      case 'progress': {
        if (!this.inDuel) return;
        const rival = m.players.find((p) => p.id !== this.you);
        if (rival) this.scene.setRival(rival.score, rival.instability, rival.alive);
        return;
      }
      case 'end':
        return this.endDuel(m);
      case 'welcome':
        this.you = m.id;
        return;
    }
  }

  private onClosed(reason: string): void {
    const wasActive = this.room !== null || this.inDuel;
    this.room = null;
    this.inDuel = false;
    this.lastEnd = null;
    if (!wasActive) return;
    this.host.showBackdrop();
    this.host.ui.show(
      offlineScreen(reason, serverUrl(), () => void this.open(), () => this.host.showMainMenu()),
    );
  }

  // ───────────────────────── the duel ─────────────────────────

  private get scene(): GameScene {
    return this.host.game.scene.getScene(GameScene.KEY) as GameScene;
  }

  private startDuel(start: StartMessage): void {
    this.inDuel = true;
    this.lastEnd = null;
    const config = practiceConfig(this.host.campaign.get(start.settings.level), 'original');
    let sync: GameSynchronizer | null = null;

    this.host.ui.clear();
    this.host.game.scene.stop('BackdropScene');
    this.host.game.scene.start(GameScene.KEY, {
      config,
      seed: start.seed,
      hooks: {
        onPauseChanged: () => {},
        onGameOver: () => {}, // the server decides; see endDuel
      },
      duel: {
        startPerf: performance.now() + start.startsInMs,
        durationMs: start.durationMs,
        rivalName: start.opponent.name,
        onFrame: (engine: GameEngine, now: number) => {
          sync ??= new GameSynchronizer(this.client, engine);
          sync.update(now);
        },
        onMenu: () =>
          this.host.ui.show(
            duelMenuScreen(
              () => {
                this.host.ui.clear();
                this.scene.closeDuelMenu();
              },
              () => this.client.send({ t: 'forfeit' }),
            ),
          ),
      },
    });
  }

  private endDuel(end: MatchEndMessage): void {
    if (!this.inDuel || !this.you) return;
    this.inDuel = false;
    this.lastEnd = end;
    this.host.showBackdrop();
    this.host.ui.show(
      duelResultScreen(
        end,
        this.you,
        () => {
          this.lastEnd = null;
          this.showRoom();
        },
        () => {
          this.lastEnd = null;
          this.client.send({ t: 'leave' });
          this.room = null;
          this.showLobby();
        },
      ),
    );
  }
}
