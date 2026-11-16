import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus';

interface TestEvents {
  wordCompleted: { id: number; text: string };
  gameOver: { score: number };
}

describe('EventBus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.on('wordCompleted', listener);
    bus.emit('wordCompleted', { id: 1, text: 'ember' });
    expect(listener).toHaveBeenCalledWith({ id: 1, text: 'ember' });
  });

  it('unsubscribes via the returned function', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    const off = bus.on('gameOver', listener);
    off();
    bus.emit('gameOver', { score: 10 });
    expect(listener).not.toHaveBeenCalled();
    expect(bus.listenerCount('gameOver')).toBe(0);
  });

  it('once() fires a single time', () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    bus.once('gameOver', listener);
    bus.emit('gameOver', { score: 1 });
    bus.emit('gameOver', { score: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ score: 1 });
  });

  it('allows a listener to unsubscribe during emit without skipping others', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const off = bus.on('gameOver', () => off());
    bus.on('gameOver', second);
    bus.emit('gameOver', { score: 0 });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
