import { describe, expect, it } from 'vitest';
import {
  HEAR_H,
  createHearWorld,
  fallSpeed,
  fallerAt,
  stepHear,
  type HearChoice,
} from './hearEngine';

const CHOICES: HearChoice[] = [
  { token: 'n3', glyph: '3' },
  { token: 'n7', glyph: '7' },
  { token: 'n9', glyph: '9' },
  { token: 'n2', glyph: '2' },
];

describe('hearEngine', () => {
  it('lays out one faller per choice across distinct columns', () => {
    const world = createHearWorld(CHOICES, () => 0);
    expect(world.fallers).toHaveLength(4);
    expect(new Set(world.fallers.map((f) => f.token))).toEqual(
      new Set(CHOICES.map((c) => c.token)),
    );
    expect(new Set(world.fallers.map((f) => f.x)).size).toBe(4); // distinct columns
    expect(world.fallers.every((f) => f.y < 0)).toBe(true); // start above screen
  });

  it('accelerates fall speed with elapsed time, capped', () => {
    expect(fallSpeed(10)).toBeGreaterThan(fallSpeed(0));
    expect(fallSpeed(1000)).toBe(fallSpeed(100000)); // hits the ceiling
  });

  it('reports fallers that reach the bottom and drops them', () => {
    let world = createHearWorld(CHOICES, () => 0);
    const seen = new Set<string>();
    // Run long enough for everything to fall off the bottom.
    for (let i = 0; i < 600; i += 1) {
      const r = stepHear(world, 0.05);
      world = r.world;
      r.fallen.forEach((tok) => seen.add(tok));
      if (world.fallers.length === 0) break;
    }
    expect(seen).toEqual(new Set(CHOICES.map((c) => c.token)));
    expect(world.fallers).toHaveLength(0);
  });

  it('hit-tests a tap to the nearest faller within touch radius', () => {
    const world = createHearWorld(CHOICES, () => 0);
    const target = world.fallers[0]!;
    const hit = fallerAt(world, target.x, target.y);
    expect(hit?.token).toBe(target.token);
    // A tap far from every faller misses.
    expect(fallerAt(world, -500, HEAR_H * 2)).toBeNull();
  });
});
