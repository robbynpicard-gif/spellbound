import { MAX_INPUT_LENGTH, type Command, type GameEngine } from '../core/GameEngine';

/**
 * Applies a player command to an engine through its public API (the same
 * calls the keyboard makes). Used by the server to re-run each player's game.
 */
export function applyCommand(engine: GameEngine, command: Command): void {
  switch (command.type) {
    case 'char':
      engine.typeChar(command.char);
      return;
    case 'backspace':
      engine.backspace();
      return;
    case 'clear':
      engine.clearInput();
      return;
    case 'submit':
      engine.submit();
      return;
    case 'select':
      engine.selectTarget(command.wordId);
      return;
  }
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Strict shape check for a command received over the network. */
export function isValidCommand(value: unknown): value is Command {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!isInt(c.tick) || c.tick > 10_000_000) return false;
  switch (c.type) {
    case 'char':
      return typeof c.char === 'string' && /^[a-z]$/.test(c.char) && Object.keys(c).length === 3;
    case 'backspace':
    case 'clear':
    case 'submit':
      return Object.keys(c).length === 2;
    case 'select':
      return isInt(c.wordId) && c.wordId < 1_000_000 && Object.keys(c).length === 3;
    default:
      return false;
  }
}

/** Most commands a single batch may carry (≈1 s of very fast typing). */
export const MAX_COMMANDS_PER_BATCH = 60;
/** Sanity bound used by the server's rate limit: commands per second. */
export const MAX_COMMANDS_PER_SECOND = 40;

export { MAX_INPUT_LENGTH };
