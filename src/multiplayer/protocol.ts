import type { Command } from '../core/GameEngine';
import type { GameStats } from '../gameplay/ScoringSystem';

/**
 * Messages between the game and the multiplayer server (decisions.md D-024).
 * Shared by the browser client and the Node server so both always agree.
 *
 * Only player *commands* are sent (typed letters, Backspace, Enter, clicks),
 * never rendered state. The server re-runs every player's game with the same
 * engine to decide the result (GDD §6: the client is not trusted).
 */
export const PROTOCOL_VERSION = 1;

/** Default local server port. */
export const DEFAULT_SERVER_PORT = 8787;

export interface DuelSettings {
  /** Campaign level whose difficulty the duel uses. */
  level: number;
}

/** A player as everyone in the room sees them. */
export interface PlayerInfo {
  id: string;
  name: string;
  ready: boolean;
  host: boolean;
  connected: boolean;
}

export interface RoomInfo {
  code: string;
  settings: DuelSettings;
  players: PlayerInfo[];
  state: 'lobby' | 'countdown' | 'playing' | 'finished';
}

/** Live scoreboard the server sends during a match. */
export interface PlayerProgress {
  id: string;
  score: number;
  instability: number;
  completed: number;
  missed: number;
  alive: boolean;
}

export type EndReason = 'collapse' | 'both-collapsed' | 'time' | 'forfeit';

export interface PlayerResult {
  id: string;
  name: string;
  stats: GameStats;
  instability: number;
  alive: boolean;
}

// ───────────────────────── client → server ─────────────────────────

export type ClientMessage =
  | { t: 'hello'; version: number; name: string }
  | { t: 'create'; settings: DuelSettings }
  | { t: 'join'; code: string }
  | { t: 'leave' }
  | { t: 'ready'; ready: boolean }
  | { t: 'settings'; settings: DuelSettings }
  /** New commands since the last batch, each stamped with its game tick. */
  | { t: 'input'; commands: Command[] }
  | { t: 'forfeit' };

// ───────────────────────── server → client ─────────────────────────

export type ErrorCode =
  | 'bad-message'
  | 'version'
  | 'no-such-room'
  | 'room-full'
  | 'not-in-room'
  | 'not-host'
  | 'busy'
  | 'rate-limit'
  | 'server-full';

export type ServerMessage =
  | { t: 'welcome'; id: string }
  | { t: 'room'; room: RoomInfo; you: string }
  | { t: 'left' }
  | { t: 'error'; code: ErrorCode; message: string }
  /**
   * The duel begins `startsInMs` from now. Both players use this seed and
   * these settings, so they get identical words and difficulty.
   */
  | { t: 'start'; seed: number; settings: DuelSettings; startsInMs: number; durationMs: number; opponent: PlayerInfo }
  | { t: 'progress'; players: PlayerProgress[]; elapsedMs: number }
  | { t: 'end'; winnerId: string | null; reason: EndReason; results: PlayerResult[] };

export type MatchEndMessage = Extract<ServerMessage, { t: 'end' }>;
export type StartMessage = Extract<ServerMessage, { t: 'start' }>;

/** Room codes: 4 letters, no I or O (easy to read aloud). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH);
}

/** Display names: letters, digits, spaces, - and _; 1–16 characters. */
export function sanitizeName(input: string): string {
  const cleaned = input.replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return cleaned || 'Apprentice';
}
