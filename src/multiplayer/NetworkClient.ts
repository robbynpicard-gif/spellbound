import { EventBus } from '../core/EventBus';
import {
  DEFAULT_SERVER_PORT,
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from './protocol';

export interface NetworkEvents {
  message: ServerMessage;
  /** The connection closed (server stopped, network lost, kicked…). */
  closed: { reason: string };
}

const CONNECT_TIMEOUT_MS = 5000;

/**
 * Where the multiplayer server is. Set VITE_SERVER_URL when building for
 * deployment; locally it defaults to this computer, port 8787.
 */
export function serverUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (configured) return configured;
  const secure = location.protocol === 'https:';
  return `${secure ? 'wss' : 'ws'}://${location.hostname || 'localhost'}:${DEFAULT_SERVER_PORT}`;
}

/** Browser WebSocket connection to the TypeL server (no libraries needed). */
export class NetworkClient {
  readonly events = new EventBus<NetworkEvents>();
  private socket: WebSocket | null = null;
  private myId: string | null = null;
  private closedByUs = false;

  get id(): string | null {
    return this.myId;
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN && this.myId !== null;
  }

  /** Connect and say hello. Resolves with our player id. */
  connect(url: string, name: string): Promise<string> {
    this.close();
    this.closedByUs = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (reason: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.close();
        reject(new Error(reason));
      };
      const timer = setTimeout(() => fail('The multiplayer server did not answer.'), CONNECT_TIMEOUT_MS);

      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch {
        return fail('The multiplayer server address is invalid.');
      }
      this.socket = socket;

      socket.onopen = () => this.send({ t: 'hello', version: PROTOCOL_VERSION, name });
      socket.onerror = () => fail('Could not reach the multiplayer server.');
      socket.onclose = () => {
        if (!settled) return fail('Could not reach the multiplayer server.');
        if (!this.closedByUs) this.events.emit('closed', { reason: 'Lost connection to the multiplayer server.' });
        this.myId = null;
      };
      socket.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (!settled) {
          if (message.t === 'welcome') {
            settled = true;
            clearTimeout(timer);
            this.myId = message.id;
            resolve(message.id);
          } else if (message.t === 'error') {
            fail(message.message);
          }
          return;
        }
        this.events.emit('message', message);
      };
    });
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  close(): void {
    this.closedByUs = true;
    this.socket?.close();
    this.socket = null;
    this.myId = null;
  }
}
