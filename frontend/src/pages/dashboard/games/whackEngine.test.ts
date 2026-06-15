import { describe, expect, it } from 'vitest';
import {
  GAME_DURATION,
  HOLES,
  createWorld,
  isOver,
  showDuration,
  spawnInterval,
  stepWorld,
  whack,
} from './whackEngine';

describe('whackEngine', () => {
  it('starts empty with a full clock', () => {
    const world = createWorld();
    expect(world.moles).toEqual([]);
    expect(world.score).toBe(0);
    expect(world.timeLeft).toBe(GAME_DURATION);
    expect(isOver(world)).toBe(false);
  });

  it('spawns a critter into a valid empty hole', () => {
    const world = createWorld();
    const { world: next } = stepWorld(world, 1, () => 0);
    expect(next.moles).toHaveLength(1);
    expect(next.moles[0].hole).toBeGreaterThanOrEqual(0);
    expect(next.moles[0].hole).toBeLessThan(HOLES);
  });

  it('never spawns two critters in the same hole', () => {
    let world = createWorld();
    // Advance several spawn cycles; all holes must stay unique.
    for (let i = 0; i < 20; i += 1) {
      world = stepWorld(world, 0.5, () => 0.5).world;
      const holes = world.moles.map((m) => m.hole);
      expect(new Set(holes).size).toBe(holes.length);
    }
  });

  it('bonking a critter scores and removes it', () => {
    const { world } = stepWorld(createWorld(), 1, () => 0);
    const hole = world.moles[0].hole;
    const { world: after, hit } = whack(world, hole);
    expect(hit).toBe(true);
    expect(after.score).toBe(1);
    expect(after.moles).toHaveLength(0);
  });

  it('bonking an empty hole misses without scoring', () => {
    const { world } = stepWorld(createWorld(), 1, () => 0);
    const occupied = world.moles[0].hole;
    const emptyHole = (occupied + 1) % HOLES;
    const { world: after, hit } = whack(world, emptyHole);
    expect(hit).toBe(false);
    expect(after.score).toBe(0);
    expect(after.moles).toHaveLength(1);
  });

  it('emits an escape event when a critter times out', () => {
    const { world } = stepWorld(createWorld(), 1, () => 0);
    // Advance well past the show duration so the critter ducks down.
    const { world: after, events } = stepWorld(world, 5, () => 0.99);
    expect(events).toContain('escape');
    expect(after.moles.every((m) => m.hole !== world.moles[0].hole || m.id !== world.moles[0].id)).toBe(true);
  });

  it('ends when the clock runs out and freezes the world', () => {
    const world = { ...createWorld(), timeLeft: 0.5 };
    const { world: after } = stepWorld(world, 1, () => 0);
    expect(after.timeLeft).toBe(0);
    expect(isOver(after)).toBe(true);
    // Once over, further steps and whacks are no-ops.
    const frozen = stepWorld(after, 1).world;
    expect(frozen).toEqual(after);
    expect(whack(after, 0).hit).toBe(false);
  });

  it('ramps difficulty up over elapsed time but floors it', () => {
    expect(spawnInterval(0)).toBeGreaterThan(spawnInterval(20));
    expect(showDuration(0)).toBeGreaterThan(showDuration(20));
    expect(spawnInterval(1000)).toBeGreaterThanOrEqual(0.4);
    expect(showDuration(1000)).toBeGreaterThanOrEqual(0.65);
  });
});
