import { GameEngine, type Command } from '../src/core/GameEngine';
import { SIMULATION_STEP_MS } from '../src/core/GameConfig';
import { WORDS } from '../src/data/wordList';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import type { GameStats } from '../src/gameplay/ScoringSystem';
import { applyCommand } from '../src/multiplayer/commands';
import type { EndReason, PlayerProgress, PlayerResult } from '../src/multiplayer/protocol';

/**
 * Authoritative referee for one Wizard Duel (decisions.md D-024).
 *
 * Each browser plays its own copy of the game for instant feedback and
 * streams its commands here. The server runs both players' games with the
 * same engine, seed and config, on its own clock, and decides the result.
 *
 * Timing: the server keeps each game LAG_TICKS (0.5 s) behind real time so
 * commands have time to arrive. A command that arrives later than that is
 * applied as soon as possible ("late"); one stamped in the future is refused.
 */
export const LAG_TICKS = 30;
/** How far ahead of the server clock a command's tick may be. */
export const FUTURE_TOLERANCE_TICKS = 30;
export const DEFAULT_COUNTDOWN_MS = 3000;
/** Duels at a fixed difficulty could last forever; after this, highest score wins. */
export const DEFAULT_DURATION_MS = 4 * 60 * 1000;

export interface MatchPlayer {
  id: string;
  name: string;
}

export interface MatchOptions {
  seed: number;
  config: DifficultyConfig;
  players: readonly [MatchPlayer, MatchPlayer];
  now: () => number;
  countdownMs?: number;
  durationMs?: number;
  words?: readonly string[];
}

export interface MatchEnd {
  winnerId: string | null;
  reason: EndReason;
  results: PlayerResult[];
}

interface Seat {
  player: MatchPlayer;
  engine: GameEngine;
  queue: Command[];
  lastTick: number;
  lostAtTick: number | null;
  lateCommands: number;
}

export type ReceiveResult = { ok: true } | { ok: false; reason: string };

export class Match {
  readonly startAt: number;
  readonly durationMs: number;
  private readonly seats: Seat[];
  private ended: MatchEnd | null = null;

  constructor(private readonly options: MatchOptions) {
    this.startAt = options.now() + (options.countdownMs ?? DEFAULT_COUNTDOWN_MS);
    this.durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
    this.seats = options.players.map((player) => ({
      player,
      engine: new GameEngine({ config: options.config, seed: options.seed, words: options.words ?? WORDS }),
      queue: [],
      lastTick: 0,
      lostAtTick: null,
      lateCommands: 0,
    }));
  }

  get result(): MatchEnd | null {
    return this.ended;
  }

  /** Real-time tick since the match started (negative during the countdown). */
  wallTick(): number {
    return Math.floor((this.options.now() - this.startAt) / SIMULATION_STEP_MS);
  }

  elapsedMs(): number {
    return Math.max(0, this.options.now() - this.startAt);
  }

  /** Queue a batch of commands from a player after checking their ticks. */
  receive(playerId: string, commands: readonly Command[]): ReceiveResult {
    const seat = this.seat(playerId);
    if (!seat) return { ok: false, reason: 'not in match' };
    if (this.ended) return { ok: true };
    const limit = this.wallTick() + FUTURE_TOLERANCE_TICKS;
    let last = seat.lastTick;
    for (const c of commands) {
      if (c.tick < last) return { ok: false, reason: 'ticks out of order' };
      if (c.tick > limit) return { ok: false, reason: 'tick from the future' };
      last = c.tick;
    }
    seat.lastTick = last;
    seat.queue.push(...commands);
    return { ok: true };
  }

  /** Advance both games to the server clock and check whether the duel is over. */
  update(): MatchEnd | null {
    if (this.ended) return this.ended;
    const wall = this.wallTick();
    if (wall < 0) return null;
    const target = Math.max(0, wall - LAG_TICKS);

    for (const seat of this.seats) this.advance(seat, target);

    const lost = this.seats.filter((s) => s.lostAtTick !== null);
    if (lost.length === 2) {
      const [a, b] = lost as [Seat, Seat];
      if (a.lostAtTick === b.lostAtTick) return this.finish(this.tieBreak(), 'both-collapsed');
      const loser = a.lostAtTick! < b.lostAtTick! ? a : b;
      return this.finish(this.other(loser).player.id, 'collapse');
    }
    if (lost.length === 1) return this.finish(this.other(lost[0]!).player.id, 'collapse');
    if (this.options.now() - this.startAt >= this.durationMs) return this.finish(this.tieBreak(), 'time');
    return null;
  }

  /** A player gave up or disconnected: the other player wins. */
  forfeit(playerId: string): MatchEnd | null {
    if (this.ended) return this.ended;
    const seat = this.seat(playerId);
    if (!seat) return null;
    return this.finish(this.other(seat).player.id, 'forfeit');
  }

  progress(): PlayerProgress[] {
    return this.seats.map((s) => ({
      id: s.player.id,
      score: s.engine.state.score,
      instability: s.engine.state.instability,
      completed: s.engine.state.completed,
      missed: s.engine.state.missed,
      alive: s.lostAtTick === null,
    }));
  }

  /** For tests and diagnostics. */
  engineOf(playerId: string): GameEngine | undefined {
    return this.seat(playerId)?.engine;
  }

  private advance(seat: Seat, target: number): void {
    const engine = seat.engine;
    const applyDue = () => {
      while (seat.queue.length > 0 && seat.queue[0]!.tick <= engine.state.tick && engine.status === 'playing') {
        const command = seat.queue.shift()!;
        if (command.tick < engine.state.tick) seat.lateCommands++;
        applyCommand(engine, command);
      }
    };
    while (engine.state.tick < target && engine.status === 'playing') {
      applyDue();
      engine.step();
    }
    applyDue();
    if (engine.status === 'lost' && seat.lostAtTick === null) seat.lostAtTick = engine.state.tick;
  }

  /**
   * Tie-breaker (GDD §15.1) for simultaneous collapse or time-out:
   * higher score → more words → fewer misses → draw (null).
   */
  private tieBreak(): string | null {
    const [a, b] = this.seats as [Seat, Seat];
    const sa = a.engine.state;
    const sb = b.engine.state;
    if (sa.score !== sb.score) return sa.score > sb.score ? a.player.id : b.player.id;
    if (sa.completed !== sb.completed) return sa.completed > sb.completed ? a.player.id : b.player.id;
    if (sa.missed !== sb.missed) return sa.missed < sb.missed ? a.player.id : b.player.id;
    return null;
  }

  private finish(winnerId: string | null, reason: EndReason): MatchEnd {
    this.ended = {
      winnerId,
      reason,
      results: this.seats.map((s) => ({
        id: s.player.id,
        name: s.player.name,
        stats: s.engine.stats() as GameStats,
        instability: s.engine.state.instability,
        alive: s.lostAtTick === null,
      })),
    };
    return this.ended;
  }

  private seat(id: string): Seat | undefined {
    return this.seats.find((s) => s.player.id === id);
  }

  private other(seat: Seat): Seat {
    return this.seats.find((s) => s !== seat)!;
  }
}
