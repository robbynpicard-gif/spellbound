import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import { CAMPAIGN_LEVELS } from '../src/difficulty/LevelDefinitions';
import { MAX_COMMANDS_PER_SECOND } from '../src/multiplayer/commands';
import {
  DEFAULT_SERVER_PORT,
  PROTOCOL_VERSION,
  sanitizeName,
  type ServerMessage,
} from '../src/multiplayer/protocol';
import { RoomManager, type Connection, type RoomManagerOptions } from './rooms';
import { MAX_MESSAGE_BYTES, parseClientMessage } from './validation';

/** Messages per second a client may send before being disconnected. */
const MAX_MESSAGES_PER_SECOND = 30;
const MAX_CONNECTIONS = 1000;
const TICK_MS = 50;
const HEARTBEAT_MS = 15_000;

export interface ServerOptions extends Partial<Omit<RoomManagerOptions, 'levels'>> {
  port?: number;
  /** If set, only browsers from these origins may connect (e.g. the GitHub Pages URL). */
  allowedOrigins?: string[];
  log?: (message: string) => void;
}

export interface RunningServer {
  port: number;
  rooms: RoomManager;
  close(): Promise<void>;
}

/**
 * The TypeL multiplayer server: WebSockets + room/match logic.
 * The game works without it; it's only needed for Wizard Duels.
 */
export function startServer(options: ServerOptions = {}): Promise<RunningServer> {
  const log = options.log ?? ((m: string) => console.log(`[typel] ${m}`));
  const rooms = new RoomManager({ ...options, levels: CAMPAIGN_LEVELS });
  const wss = new WebSocketServer({
    port: options.port ?? DEFAULT_SERVER_PORT,
    maxPayload: MAX_MESSAGE_BYTES,
    verifyClient: ({ origin }: { origin?: string }) =>
      !options.allowedOrigins || (origin !== undefined && options.allowedOrigins.includes(origin)),
  });
  const alive = new WeakMap<WebSocket, boolean>();

  wss.on('connection', (socket) => {
    if (wss.clients.size > MAX_CONNECTIONS) {
      socket.close(1013, 'Server busy');
      return;
    }
    alive.set(socket, true);
    socket.on('pong', () => alive.set(socket, true));

    const conn: Connection = {
      id: randomUUID(),
      name: 'Apprentice',
      roomCode: null,
      helloDone: false,
      send: (message: ServerMessage) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      },
    };

    // Simple per-second rate limits (messages and commands).
    let windowStart = Date.now();
    let messages = 0;
    let commands = 0;

    socket.on('message', (data, isBinary) => {
      const now = Date.now();
      if (now - windowStart >= 1000) {
        windowStart = now;
        messages = 0;
        commands = 0;
      }
      if (++messages > MAX_MESSAGES_PER_SECOND || isBinary) {
        conn.send({ t: 'error', code: 'rate-limit', message: 'Too many messages.' });
        socket.close(1008, 'Rate limit');
        return;
      }

      const message = parseClientMessage(data.toString(), CAMPAIGN_LEVELS.count);
      if (!message) {
        conn.send({ t: 'error', code: 'bad-message', message: 'Message not understood.' });
        return;
      }
      if (message.t === 'input' && (commands += message.commands.length) > MAX_COMMANDS_PER_SECOND) {
        conn.send({ t: 'error', code: 'rate-limit', message: 'Typing faster than humanly possible.' });
        socket.close(1008, 'Rate limit');
        return;
      }
      if (message.t === 'hello') {
        if (message.version !== PROTOCOL_VERSION) {
          conn.send({ t: 'error', code: 'version', message: 'Game and server versions differ. Refresh the page.' });
          socket.close(1008, 'Version mismatch');
          return;
        }
        conn.name = sanitizeName(message.name);
        conn.helloDone = true;
        conn.send({ t: 'welcome', id: conn.id });
        return;
      }
      if (!conn.helloDone) {
        conn.send({ t: 'error', code: 'bad-message', message: 'Say hello first.' });
        return;
      }
      rooms.handle(conn, message);
    });

    socket.on('close', () => rooms.disconnect(conn));
    socket.on('error', () => socket.terminate());
  });

  const tick = setInterval(() => rooms.tick(), TICK_MS);
  // Drop connections that stopped answering (closed laptop, lost network).
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.get(socket)) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, HEARTBEAT_MS);

  return new Promise((resolve, reject) => {
    wss.once('error', reject);
    wss.once('listening', () => {
      const port = (wss.address() as AddressInfo).port;
      log(`multiplayer server listening on ws://localhost:${port}`);
      resolve({
        port,
        rooms,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(tick);
            clearInterval(heartbeat);
            for (const socket of wss.clients) socket.terminate();
            wss.close(() => done());
          }),
      });
    });
  });
}
