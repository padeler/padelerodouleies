import { describe, expect, it } from 'vitest';
import {
  CATCH_ZONE_H,
  START_LIVES,
  WORLD_H,
  createWorld,
  fallSpeed,
  spawnInterval,
  stepWorld,
  type CatcherWorld,
} from './catcherEngine';

/** rng stub returning the given values in order (cycles when exhausted). */
function rngOf(...values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    if (v === undefined) throw new Error('rngOf: no values');
    return v;
  };
}

/** A world that won't spawn anything during the test step. */
function quietWorld(overrides: Partial<CatcherWorld>): CatcherWorld {
  return { ...createWorld(), nextSpawnIn: 100, ...overrides };
}

describe('createWorld', () => {
  it('starts empty with full lives', () => {
    const world = createWorld();
    expect(world.items).toEqual([]);
    expect(world.score).toBe(0);
    expect(world.lives).toBe(START_LIVES);
  });
});

describe('stepWorld', () => {
  it('spawns an item when the spawn timer elapses', () => {
    const world = { ...createWorld(), nextSpawnIn: 0.1 };
    // rng calls per spawn: kind, x
    const { world: next } = stepWorld(world, 0.2, 180, rngOf(0.5, 0.5));
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.kind).toBe('star'); // 0.5 >= bomb probability
    expect(next.nextSpawnIn).toBeGreaterThan(0);
  });

  it('spawns a bomb when rng falls under the bomb probability', () => {
    const world = { ...createWorld(), nextSpawnIn: 0 };
    const { world: next } = stepWorld(world, 0.01, 180, rngOf(0.01, 0.5));
    expect(next.items[0]?.kind).toBe('bomb');
  });

  it('catches a star over the basket: +1 score, catch event', () => {
    const world = quietWorld({
      items: [{ id: 1, x: 180, y: WORLD_H - CATCH_ZONE_H - 5, kind: 'star' }],
    });
    const { world: next, events } = stepWorld(world, 0.1, 180);
    expect(events).toEqual(['catch']);
    expect(next.score).toBe(1);
    expect(next.lives).toBe(START_LIVES);
    expect(next.items).toEqual([]);
  });

  it('loses a life when a bomb is caught', () => {
    const world = quietWorld({
      items: [{ id: 1, x: 180, y: WORLD_H - CATCH_ZONE_H - 5, kind: 'bomb' }],
    });
    const { world: next, events } = stepWorld(world, 0.1, 180);
    expect(events).toEqual(['bomb']);
    expect(next.score).toBe(0);
    expect(next.lives).toBe(START_LIVES - 1);
  });

  it('loses a life when a star falls past the floor away from the basket', () => {
    const world = quietWorld({
      items: [{ id: 1, x: 20, y: WORLD_H - 5, kind: 'star' }],
    });
    const { world: next, events } = stepWorld(world, 0.3, 340);
    expect(events).toEqual(['miss']);
    expect(next.lives).toBe(START_LIVES - 1);
    expect(next.items).toEqual([]);
  });

  it('lets a missed bomb disappear harmlessly', () => {
    const world = quietWorld({
      items: [{ id: 1, x: 20, y: WORLD_H - 5, kind: 'bomb' }],
    });
    const { world: next, events } = stepWorld(world, 0.3, 340);
    expect(events).toEqual([]);
    expect(next.lives).toBe(START_LIVES);
    expect(next.items).toEqual([]);
  });

  it('keeps falling items that reach neither basket nor floor', () => {
    const world = quietWorld({
      items: [{ id: 1, x: 180, y: 50, kind: 'star' }],
    });
    const { world: next, events } = stepWorld(world, 0.1, 180);
    expect(events).toEqual([]);
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.y).toBeGreaterThan(50);
  });
});

describe('difficulty ramp', () => {
  it('fall speed grows with score and is capped', () => {
    expect(fallSpeed(10)).toBeGreaterThan(fallSpeed(0));
    expect(fallSpeed(1000)).toBe(fallSpeed(999));
  });

  it('spawn interval shrinks with score and has a floor', () => {
    expect(spawnInterval(10)).toBeLessThan(spawnInterval(0));
    expect(spawnInterval(1000)).toBe(spawnInterval(999));
  });
});
