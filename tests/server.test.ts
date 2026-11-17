import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { GameEngine, type Command } from '../src/core/GameEngine';
import { SIMULATION_STEP_MS } from '../src/core/GameConfig';
import { WORDS } from '../src/data/wordList';
import { CAMPAIGN_LEVELS } from '../src/difficulty/LevelDefinitions';
import { practiceConfig } from '../src/modes/PracticeMode';
import { isValidCommand } from '../src/multiplayer/commands';
import {
  normalizeRoomCode,
  PROTOCOL_VERSION,
  sanitizeName,
  type ServerMessage,
} from '../src/multiplayer/protocol';
import { startServer, type RunningServer } from '../server/index';
import { LAG_TICKS, Match } from '../server/match';
import { RoomManager, type Connection } from '../server/rooms';
import { parseClientMessage } from '../server/validation';

// Stage 5 level 1: fast enough that an idle player collapses well within a test run.
const LEVEL = CAMPAIGN_LEVELS.get(81);
const CONFIG = practiceConfig(LEVEL, 'original');
const ticksToMs = (ticks: number) => ticks * SIMULATION_STEP_MS;

/** A controllable clock. */
function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

function makeMatch(c: ReturnType<typeof clock>, opts: { durationMs?: number } = {}) {
  return new Match({
    seed: 77,
    config: CONFIG,
    players: [
      { id: 'a', name: 'Ann' },
      { id: 'b', name: 'Bob' },
    ],
    now: c.now,
    countdownMs: 0,
    durationMs: opts.durationMs ?? 10 * 60 * 1000,
  });
}

/** Record what a perfect local player would send: destroy each word quickly. */
function perfectPlayerCommands(seed: number, untilTick: number): Command[] {
  const engine = new GameEngine({ config: CONFIG, seed, words: WORDS });
  while (engine.state.tick < untilTick) {
    engine.step();
    const w = engine.state.words[0];
    if (w && engine.state.tick % 30 === 0) {
      for (const ch of w.match) engine.typeChar(ch);
      engine.submit();
    }
  }
  return [...engine.commands];
}

describe('message validation', () => {
  it('accepts well-formed messages', () => {
    expect(parseClientMessage('{"t":"hello","version":1,"name":"Ann"}', 10)).toEqual({ t: 'hello', version: 1, name: 'Ann' });
    expect(parseClientMessage('{"t":"join","code":"ab-cd"}', 10)).toEqual({ t: 'join', code: 'ABCD' });
    expect(parseClientMessage('{"t":"create","settings":{"level":3}}', 10)).toEqual({ t: 'create', settings: { level: 3 } });
    expect(
      parseClientMessage('{"t":"input","commands":[{"tick":4,"type":"char","char":"a"},{"tick":5,"type":"submit"}]}', 10),
    ).not.toBeNull();
  });

  it('rejects anything malformed or out of range', () => {
    for (const raw of [
      'not json',
      '[]',
      '{"t":"nope"}',
      '{"t":"create","settings":{"level":11}}',
      '{"t":"create","settings":{"level":1.5}}',
      '{"t":"join","code":"AB"}',
      '{"t":"ready","ready":"yes"}',
      '{"t":"input","commands":[{"tick":-1,"type":"char","char":"a"}]}',
      '{"t":"input","commands":[{"tick":1,"type":"char","char":"A"}]}',
      '{"t":"input","commands":[{"tick":1,"type":"char","char":"ab"}]}',
      '{"t":"input","commands":[{"tick":1,"type":"submit","extra":true}]}',
      '{"t":"input","commands":[{"tick":1,"type":"hack"}]}',
      JSON.stringify({ t: 'input', commands: Array.from({ length: 61 }, (_, i) => ({ tick: i, type: 'submit' })) }),
      'x'.repeat(20_000),
    ]) {
      expect(parseClientMessage(raw, 10), raw.slice(0, 40)).toBeNull();
    }
  });

  it('command shape check', () => {
    expect(isValidCommand({ tick: 0, type: 'select', wordId: 3 })).toBe(true);
    expect(isValidCommand({ tick: 0, type: 'select', wordId: -3 })).toBe(false);
  });

  it('room codes and names are normalised', () => {
    expect(normalizeRoomCode(' qwer ')).toBe('QWER');
    expect(sanitizeName('  <b>Gandalf</b>  the   Grey!! ')).toBe('bGandalfb the Gr');
    expect(sanitizeName('$$$')).toBe('Apprentice');
  });
});

describe('Match (server referee)', () => {
  it('re-runs a player game from commands and matches the client exactly', () => {
    const c = clock();
    const match = makeMatch(c);
    const commands = perfectPlayerCommands(77, 3000);
    // Send in small batches as time passes, as a real client would.
    let sent = 0;
    for (let tick = 0; tick <= 3000 + LAG_TICKS + 5; tick += 6) {
      c.advance(ticksToMs(6));
      const batch: Command[] = [];
      while (sent < commands.length && commands[sent]!.tick <= tick) batch.push(commands[sent++]!);
      expect(match.receive('a', batch).ok).toBe(true);
      match.update();
    }
    // The idle opponent collapses first and ends the duel, so compare the
    // server's copy with the player's own game at the tick the match stopped.
    const server = match.engineOf('a')!;
    const replay = GameEngine.replay({ config: CONFIG, seed: 77, words: WORDS }, commands, server.state.tick);
    expect(match.result?.winnerId).toBe('a');
    expect(server.state).toEqual(replay.state);
    expect(server.state.completed).toBeGreaterThan(10);
  });

  it('a player who stops typing collapses and loses; the other wins', () => {
    const c = clock();
    const match = makeMatch(c);
    const commands = perfectPlayerCommands(77, 20_000);
    let end = null;
    let sent = 0;
    for (let tick = 0; tick < 20_000 && !end; tick += 6) {
      c.advance(ticksToMs(6));
      const batch: Command[] = [];
      while (sent < commands.length && commands[sent]!.tick <= tick) batch.push(commands[sent++]!);
      match.receive('a', batch);
      end = match.update();
    }
    expect(end).not.toBeNull();
    expect(end!.reason).toBe('collapse');
    expect(end!.winnerId).toBe('a');
    expect(end!.results.find((r) => r.id === 'b')!.alive).toBe(false);
  });

  it('simultaneous collapse is decided by score, then words, then misses', () => {
    const c = clock();
    const match = makeMatch(c);
    let end = null;
    while (!end) {
      c.advance(100);
      end = match.update();
    }
    // Neither typed: identical games collapse on the same tick with equal scores → draw.
    expect(end.reason).toBe('both-collapsed');
    expect(end.winnerId).toBeNull();
  });

  it('time limit: highest score wins', () => {
    const c = clock();
    const match = makeMatch(c, { durationMs: 20_000 });
    const commands = perfectPlayerCommands(77, 1500);
    match.receive('a', commands.filter((cmd) => cmd.tick <= 0));
    let end = null;
    let sent = commands.filter((cmd) => cmd.tick <= 0).length;
    for (let tick = 0; !end; tick += 6) {
      c.advance(ticksToMs(6));
      const batch: Command[] = [];
      while (sent < commands.length && commands[sent]!.tick <= tick) batch.push(commands[sent++]!);
      match.receive('a', batch);
      end = match.update();
    }
    expect(['time', 'collapse']).toContain(end.reason);
    expect(end.winnerId).toBe('a');
  });

  it('refuses commands from the future or out of order', () => {
    const c = clock();
    const match = makeMatch(c);
    c.advance(1000); // wall tick ≈ 60
    expect(match.receive('a', [{ tick: 500, type: 'submit' }]).ok).toBe(false);
    expect(match.receive('a', [{ tick: 50, type: 'submit' }]).ok).toBe(true);
    expect(match.receive('a', [{ tick: 40, type: 'submit' }]).ok).toBe(false);
    expect(match.receive('zz', []).ok).toBe(false);
  });

  it('forfeit gives the win to the other player', () => {
    const c = clock();
    const match = makeMatch(c);
    expect(match.forfeit('b')).toMatchObject({ winnerId: 'a', reason: 'forfeit' });
  });
});

describe('RoomManager', () => {
  function conn(id: string): Connection & { inbox: ServerMessage[] } {
    const inbox: ServerMessage[] = [];
    return { id, name: id.toUpperCase(), roomCode: null, helloDone: true, send: (m) => inbox.push(m), inbox };
  }
  const last = <T extends ServerMessage['t']>(c: { inbox: ServerMessage[] }, t: T) =>
    [...c.inbox].reverse().find((m) => m.t === t) as Extract<ServerMessage, { t: T }> | undefined;

  it('create → join → both ready → start with the same seed and level', () => {
    const c = clock();
    const rooms = new RoomManager({ levels: CAMPAIGN_LEVELS, now: c.now, countdownMs: 3000 });
    const a = conn('a');
    const b = conn('b');
    rooms.handle(a, { t: 'create', settings: { level: 4 } });
    const code = last(a, 'room')!.room.code;
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);

    rooms.handle(b, { t: 'join', code });
    expect(last(b, 'room')!.room.players.map((p) => p.name)).toEqual(['A', 'B']);
    expect(last(a, 'room')!.room.players[0]!.host).toBe(true);

    rooms.handle(a, { t: 'ready', ready: true });
    expect(last(a, 'start')).toBeUndefined();
    rooms.handle(b, { t: 'ready', ready: true });
    const sa = last(a, 'start')!;
    const sb = last(b, 'start')!;
    expect(sa.seed).toBe(sb.seed);
    expect(sa.settings).toEqual({ level: 4 });
    expect(sa.startsInMs).toBe(3000);
    expect(sa.opponent.id).toBe('b');
  });

  it('rejects unknown and full rooms, and non-host settings changes', () => {
    const rooms = new RoomManager({ levels: CAMPAIGN_LEVELS });
    const [a, b, c] = [conn('a'), conn('b'), conn('c')];
    rooms.handle(c, { t: 'join', code: 'ZZZZ' });
    expect(last(c, 'error')!.code).toBe('no-such-room');
    rooms.handle(a, { t: 'create', settings: { level: 1 } });
    const code = last(a, 'room')!.room.code;
    rooms.handle(b, { t: 'join', code });
    rooms.handle(c, { t: 'join', code });
    expect(last(c, 'error')!.code).toBe('room-full');
    rooms.handle(b, { t: 'settings', settings: { level: 9 } });
    expect(last(b, 'error')!.code).toBe('not-host');
  });

  it('a disconnect mid-duel is a forfeit; the room survives for the other player', () => {
    const c = clock();
    const rooms = new RoomManager({ levels: CAMPAIGN_LEVELS, now: c.now, countdownMs: 0 });
    const [a, b] = [conn('a'), conn('b')];
    rooms.handle(a, { t: 'create', settings: { level: 1 } });
    rooms.handle(b, { t: 'join', code: last(a, 'room')!.room.code });
    rooms.handle(a, { t: 'ready', ready: true });
    rooms.handle(b, { t: 'ready', ready: true });
    c.advance(500);
    rooms.tick();
    rooms.disconnect(b);
    expect(last(a, 'end')).toMatchObject({ winnerId: 'a', reason: 'forfeit' });
    const room = last(a, 'room')!.room;
    expect(room.players.map((p) => p.id)).toEqual(['a']);
    expect(room.state).toBe('lobby');
    expect(rooms.roomCount).toBe(1);
    rooms.disconnect(a);
    expect(rooms.roomCount).toBe(0);
  });

  it('sends live progress during a match and allows a rematch after', () => {
    const c = clock();
    const rooms = new RoomManager({ levels: CAMPAIGN_LEVELS, now: c.now, countdownMs: 0, durationMs: 2000 });
    const [a, b] = [conn('a'), conn('b')];
    rooms.handle(a, { t: 'create', settings: { level: 1 } });
    rooms.handle(b, { t: 'join', code: last(a, 'room')!.room.code });
    rooms.handle(a, { t: 'ready', ready: true });
    rooms.handle(b, { t: 'ready', ready: true });
    for (let i = 0; i < 60; i++) {
      c.advance(50);
      rooms.tick();
    }
    expect(last(a, 'progress')!.players).toHaveLength(2);
    expect(last(a, 'end')!.reason).toBe('time');
    // Rematch: both ready again → a new start.
    const starts = a.inbox.filter((m) => m.t === 'start').length;
    rooms.handle(a, { t: 'ready', ready: true });
    rooms.handle(b, { t: 'ready', ready: true });
    expect(a.inbox.filter((m) => m.t === 'start').length).toBe(starts + 1);
  });
});

describe('WebSocket server (end-to-end)', () => {
  let server: RunningServer | null = null;
  afterEach(async () => {
    await server?.close();
    server = null;
  });

  function client(port: number) {
    const socket = new WebSocket(`ws://localhost:${port}`);
    const inbox: ServerMessage[] = [];
    const waiters: { t: string; resolve: (m: ServerMessage) => void }[] = [];
    socket.on('message', (data) => {
      const m = JSON.parse(data.toString()) as ServerMessage;
      inbox.push(m);
      const i = waiters.findIndex((w) => w.t === m.t);
      if (i >= 0) waiters.splice(i, 1)[0]!.resolve(m);
    });
    const open = new Promise<void>((r) => socket.once('open', () => r()));
    return {
      socket,
      inbox,
      open,
      send: (m: object) => socket.send(JSON.stringify(m)),
      next<T extends ServerMessage['t']>(t: T): Promise<Extract<ServerMessage, { t: T }>> {
        return new Promise((resolve) => waiters.push({ t, resolve: resolve as (m: ServerMessage) => void }));
      },
    };
  }

  it('two clients create, join, ready, duel and get a validated result', async () => {
    server = await startServer({ port: 0, countdownMs: 200, durationMs: 1500, log: () => {} });
    const a = client(server.port);
    const b = client(server.port);
    await Promise.all([a.open, b.open]);

    a.send({ t: 'hello', version: PROTOCOL_VERSION, name: 'Merlin' });
    b.send({ t: 'hello', version: PROTOCOL_VERSION, name: 'Morgana' });
    await Promise.all([a.next('welcome'), b.next('welcome')]);

    a.send({ t: 'create', settings: { level: 2 } });
    const room = (await a.next('room')).room;
    b.send({ t: 'join', code: room.code.toLowerCase() });
    await b.next('room');

    const startA = a.next('start');
    a.send({ t: 'ready', ready: true });
    b.send({ t: 'ready', ready: true });
    const start = await startA;
    expect(start.opponent.name).toBe('Morgana');
    expect(start.settings.level).toBe(2);

    // Merlin types a few letters (valid commands); Morgana idles.
    a.send({ t: 'input', commands: [{ tick: 0, type: 'char', char: 'q' }] });
    const end = await a.next('end');
    expect(end.reason).toBe('time');
    expect(end.results.map((r) => r.name).sort()).toEqual(['Merlin', 'Morgana']);
  }, 10_000);

  it('rejects a client with the wrong protocol version', async () => {
    server = await startServer({ port: 0, log: () => {} });
    const c = client(server.port);
    await c.open;
    const closed = new Promise<number>((r) => c.socket.once('close', (code) => r(code)));
    c.send({ t: 'hello', version: 999, name: 'Old' });
    expect((await c.next('error')).code).toBe('version');
    expect(await closed).toBe(1008);
  });
});
