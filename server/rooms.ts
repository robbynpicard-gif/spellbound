import { createSeed } from '../src/core/Random';
import type { LevelManager } from '../src/difficulty/LevelManager';
import { practiceConfig } from '../src/modes/PracticeMode';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  sanitizeName,
  type ClientMessage,
  type DuelSettings,
  type ErrorCode,
  type PlayerInfo,
  type RoomInfo,
  type ServerMessage,
} from '../src/multiplayer/protocol';
import { Match, type MatchEnd } from './match';

/** Sends a message to one connected client. */
export type Send = (message: ServerMessage) => void;

export interface Connection {
  id: string;
  name: string;
  send: Send;
  roomCode: string | null;
  helloDone: boolean;
}

interface RoomPlayer {
  conn: Connection;
  ready: boolean;
}

interface Room {
  code: string;
  hostId: string;
  settings: DuelSettings;
  players: RoomPlayer[];
  state: RoomInfo['state'];
  match: Match | null;
  lastProgressAt: number;
  lastActivityAt: number;
}

export interface RoomManagerOptions {
  levels: LevelManager;
  now?: () => number;
  random?: () => number;
  maxRooms?: number;
  countdownMs?: number;
  durationMs?: number;
  /** How often live scores are broadcast during a match. */
  progressIntervalMs?: number;
  /** Lobby rooms with no activity for this long are closed. */
  idleRoomMs?: number;
}

/**
 * Rooms and Wizard Duels (GDD §15.1). Transport-agnostic: the WebSocket
 * layer (index.ts) and the tests both talk to it through `Connection.send`.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly options: RoomManagerOptions) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  handle(conn: Connection, message: ClientMessage): void {
    switch (message.t) {
      case 'hello':
        return; // handled by the transport (version check, name)
      case 'create':
        return this.create(conn, message.settings);
      case 'join':
        return this.join(conn, message.code);
      case 'leave':
        this.leave(conn);
        return conn.send({ t: 'left' });
      case 'ready':
        return this.setReady(conn, message.ready);
      case 'settings':
        return this.setSettings(conn, message.settings);
      case 'input':
        return this.input(conn, message);
      case 'forfeit':
        return this.forfeit(conn);
    }
  }

  /** The connection closed (tab closed, network lost…). */
  disconnect(conn: Connection): void {
    this.leave(conn);
  }

  /** Called on a timer (~20×/s): advances matches, broadcasts scores, tidies rooms. */
  tick(): void {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      if (room.match && (room.state === 'countdown' || room.state === 'playing')) {
        if (room.state === 'countdown' && room.match.wallTick() >= 0) {
          room.state = 'playing';
        }
        const end = room.match.update();
        if (end) {
          this.endMatch(room, end);
          continue;
        }
        if (room.state === 'playing' && now - room.lastProgressAt >= (this.options.progressIntervalMs ?? 250)) {
          room.lastProgressAt = now;
          this.broadcast(room, { t: 'progress', players: room.match.progress(), elapsedMs: room.match.elapsedMs() });
        }
      } else if (now - room.lastActivityAt > (this.options.idleRoomMs ?? 30 * 60 * 1000)) {
        for (const p of room.players) {
          p.conn.roomCode = null;
          p.conn.send({ t: 'error', code: 'no-such-room', message: 'The room closed after a long time idle.' });
        }
        this.rooms.delete(room.code);
      }
    }
  }

  // ───────────────────────── lobby ─────────────────────────

  private create(conn: Connection, settings: DuelSettings): void {
    if (conn.roomCode) this.leave(conn);
    if (this.rooms.size >= (this.options.maxRooms ?? 500)) {
      return this.error(conn, 'server-full', 'The server has too many rooms open. Try again later.');
    }
    const code = this.newCode();
    const room: Room = {
      code,
      hostId: conn.id,
      settings,
      players: [{ conn, ready: false }],
      state: 'lobby',
      match: null,
      lastProgressAt: 0,
      lastActivityAt: this.now(),
    };
    this.rooms.set(code, room);
    conn.roomCode = code;
    this.sendRoom(room);
  }

  private join(conn: Connection, code: string): void {
    const room = this.rooms.get(code);
    if (!room) return this.error(conn, 'no-such-room', `There is no room ${code}. Check the code and try again.`);
    if (room.players.some((p) => p.conn.id === conn.id)) return this.sendRoom(room);
    if (room.players.length >= 2) return this.error(conn, 'room-full', `Room ${code} already has two wizards.`);
    if (room.state !== 'lobby') return this.error(conn, 'busy', `Room ${code} is mid-duel.`);
    if (conn.roomCode) this.leave(conn);
    room.players.push({ conn, ready: false });
    room.lastActivityAt = this.now();
    conn.roomCode = code;
    this.sendRoom(room);
  }

  private leave(conn: Connection): void {
    const room = this.roomOf(conn);
    conn.roomCode = null;
    if (!room) return;
    if (room.match && (room.state === 'countdown' || room.state === 'playing')) {
      const end = room.match.forfeit(conn.id);
      if (end) this.endMatch(room, end);
    }
    room.players = room.players.filter((p) => p.conn.id !== conn.id);
    if (room.players.length === 0) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostId === conn.id) room.hostId = room.players[0]!.conn.id;
    for (const p of room.players) p.ready = false;
    room.state = 'lobby';
    room.match = null;
    room.lastActivityAt = this.now();
    this.sendRoom(room);
  }

  private setReady(conn: Connection, ready: boolean): void {
    const room = this.roomOf(conn);
    if (!room) return this.error(conn, 'not-in-room', 'You are not in a room.');
    if (room.state !== 'lobby' && room.state !== 'finished') return;
    if (room.state === 'finished') room.state = 'lobby';
    const me = room.players.find((p) => p.conn.id === conn.id)!;
    me.ready = ready;
    room.lastActivityAt = this.now();
    if (room.players.length === 2 && room.players.every((p) => p.ready)) return this.startMatch(room);
    this.sendRoom(room);
  }

  private setSettings(conn: Connection, settings: DuelSettings): void {
    const room = this.roomOf(conn);
    if (!room) return this.error(conn, 'not-in-room', 'You are not in a room.');
    if (room.hostId !== conn.id) return this.error(conn, 'not-host', 'Only the host can change the duel settings.');
    if (room.state !== 'lobby' && room.state !== 'finished') return;
    room.settings = settings;
    for (const p of room.players) p.ready = false; // everyone re-confirms new settings
    room.lastActivityAt = this.now();
    this.sendRoom(room);
  }

  // ───────────────────────── match ─────────────────────────

  private startMatch(room: Room): void {
    const [a, b] = room.players as [RoomPlayer, RoomPlayer];
    const seed = createSeed();
    const config = practiceConfig(this.options.levels.get(room.settings.level), 'original');
    room.match = new Match({
      seed,
      config,
      players: [
        { id: a.conn.id, name: a.conn.name },
        { id: b.conn.id, name: b.conn.name },
      ],
      now: this.now,
      countdownMs: this.options.countdownMs,
      durationMs: this.options.durationMs,
    });
    room.state = 'countdown';
    room.lastProgressAt = 0;
    const startsInMs = room.match.startAt - this.now();
    for (const p of room.players) {
      const opponent = room.players.find((o) => o !== p)!;
      p.conn.send({
        t: 'start',
        seed,
        settings: room.settings,
        startsInMs,
        durationMs: room.match.durationMs,
        opponent: this.playerInfo(room, opponent),
      });
    }
  }

  private input(conn: Connection, message: Extract<ClientMessage, { t: 'input' }>): void {
    const room = this.roomOf(conn);
    if (!room?.match || (room.state !== 'countdown' && room.state !== 'playing')) return;
    const result = room.match.receive(conn.id, message.commands);
    if (!result.ok) {
      // A client sending impossible input is treated as forfeiting.
      this.error(conn, 'bad-message', `Input rejected (${result.reason}).`);
      const end = room.match.forfeit(conn.id);
      if (end) this.endMatch(room, end);
    }
  }

  private forfeit(conn: Connection): void {
    const room = this.roomOf(conn);
    if (!room?.match || (room.state !== 'countdown' && room.state !== 'playing')) return;
    const end = room.match.forfeit(conn.id);
    if (end) this.endMatch(room, end);
  }

  private endMatch(room: Room, end: MatchEnd): void {
    this.broadcast(room, { t: 'end', ...end });
    room.state = 'finished';
    room.match = null;
    room.lastActivityAt = this.now();
    for (const p of room.players) p.ready = false;
    this.sendRoom(room);
  }

  // ───────────────────────── helpers ─────────────────────────

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_ALPHABET[Math.floor(this.random() * ROOM_CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
  }

  private roomOf(conn: Connection): Room | undefined {
    return conn.roomCode ? this.rooms.get(conn.roomCode) : undefined;
  }

  private playerInfo(room: Room, p: RoomPlayer): PlayerInfo {
    return { id: p.conn.id, name: sanitizeName(p.conn.name), ready: p.ready, host: room.hostId === p.conn.id, connected: true };
  }

  private sendRoom(room: Room): void {
    const info: RoomInfo = {
      code: room.code,
      settings: room.settings,
      players: room.players.map((p) => this.playerInfo(room, p)),
      state: room.state,
    };
    for (const p of room.players) p.conn.send({ t: 'room', room: info, you: p.conn.id });
  }

  private broadcast(room: Room, message: ServerMessage): void {
    for (const p of room.players) p.conn.send(message);
  }

  private error(conn: Connection, code: ErrorCode, message: string): void {
    conn.send({ t: 'error', code, message });
  }
}
