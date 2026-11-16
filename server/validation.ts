import { isValidCommand, MAX_COMMANDS_PER_BATCH } from '../src/multiplayer/commands';
import {
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
  type ClientMessage,
  type DuelSettings,
} from '../src/multiplayer/protocol';

/** Largest message the server accepts, in bytes. */
export const MAX_MESSAGE_BYTES = 16 * 1024;

function parseSettings(value: unknown, totalLevels: number): DuelSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const level = (value as Record<string, unknown>).level;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > totalLevels) return null;
  return { level };
}

/**
 * Turns raw text from a client into a typed message, or null if it is
 * malformed in any way. Nothing from the network is trusted (GDD §6).
 */
export function parseClientMessage(raw: string, totalLevels: number): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;

  switch (m.t) {
    case 'hello':
      if (typeof m.version !== 'number' || typeof m.name !== 'string' || m.name.length > 64) return null;
      return { t: 'hello', version: m.version, name: m.name };
    case 'create': {
      const settings = parseSettings(m.settings, totalLevels);
      return settings ? { t: 'create', settings } : null;
    }
    case 'settings': {
      const settings = parseSettings(m.settings, totalLevels);
      return settings ? { t: 'settings', settings } : null;
    }
    case 'join': {
      if (typeof m.code !== 'string') return null;
      const code = normalizeRoomCode(m.code);
      return code.length === ROOM_CODE_LENGTH ? { t: 'join', code } : null;
    }
    case 'ready':
      return typeof m.ready === 'boolean' ? { t: 'ready', ready: m.ready } : null;
    case 'input': {
      if (!Array.isArray(m.commands) || m.commands.length > MAX_COMMANDS_PER_BATCH) return null;
      if (!m.commands.every(isValidCommand)) return null;
      return { t: 'input', commands: m.commands };
    }
    case 'leave':
      return { t: 'leave' };
    case 'forfeit':
      return { t: 'forfeit' };
    default:
      return null;
  }
}
