import type { GameEngine } from '../core/GameEngine';
import { MAX_COMMANDS_PER_BATCH } from './commands';
import type { NetworkClient } from './NetworkClient';

/** How often new commands are sent to the server. */
const SEND_INTERVAL_MS = 100;

/**
 * Streams the local player's commands (letters, Backspace, Enter, clicks —
 * each stamped with its game tick) to the server in small batches, so the
 * server can re-run the same game. Raw keystrokes are never sent.
 */
export class GameSynchronizer {
  private sent = 0;
  private lastSendAt = 0;

  constructor(
    private readonly client: NetworkClient,
    private readonly engine: GameEngine,
  ) {}

  /** Call every frame; sends at most every SEND_INTERVAL_MS. */
  update(now: number): void {
    if (now - this.lastSendAt < SEND_INTERVAL_MS) return;
    this.lastSendAt = now;
    this.flush();
  }

  flush(): void {
    const commands = this.engine.commands;
    while (this.sent < commands.length) {
      const batch = commands.slice(this.sent, this.sent + MAX_COMMANDS_PER_BATCH);
      this.client.send({ t: 'input', commands: [...batch] });
      this.sent += batch.length;
    }
  }
}
