import { describe, expect, it } from 'vitest';
import {
  HEAR_H,
  createHearWorld,
  fallSpeed,
  fallerAt,
  removeFaller,
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
    // Step the fresh world forward so the first faller is actually on-screen —
    // invisible fallers (still staggered above the canvas) are not tappable.
    let world = createHearWorld(CHOICES, () => 0);
    for (let i = 0; i < 40; i += 1) world = stepHear(world, 0.05).world;
    const target = [...world.fallers].sort((a, b) => b.y - a.y)[0]!;
    expect(target.y).toBeGreaterThan(0); // sanity: it descended into view
    const hit = fallerAt(world, target.x, target.y);
    expect(hit?.token).toBe(target.token);
    // A tap far from every faller misses.
    expect(fallerAt(world, -500, HEAR_H * 2)).toBeNull();
  });

  it('does not hit-test fallers still invisible above the canvas', () => {
    const world = createHearWorld(CHOICES, () => 0); // fresh: everything above screen
    const target = world.fallers[0]!;
    expect(fallerAt(world, target.x, target.y)).toBeNull();
  });

  it('fallSpeed applies multiplier before capping', () => {
    const base = fallSpeed(10, 1.0);
    const faster = fallSpeed(10, 1.5);
    expect(faster).toBeGreaterThan(base);
    // Even with extreme mult, stays capped at MAX_FALL_SPEED.
    expect(fallSpeed(10, 100)).toBeLessThanOrEqual(fallSpeed(1000)); // near-max base speed
  });

  it('higher speedMult clears fallers faster', () => {
    const clearAt = (mult: number): number => {
      let world = createHearWorld(CHOICES, () => 0, mult);
      let steps = 0;
      for (; steps < 600; steps += 1) {
        const r = stepHear(world, 0.05);
        world = r.world;
        if (world.fallers.length === 0) break;
      }
      return steps;
    };
    expect(clearAt(2.0)).toBeLessThan(clearAt(1.0));
  });

  it('attaches emoji icons from an icons map when provided', () => {
    const iconMap = new Map<string, string>([
      ['n3', '\u{1F31F}'], // 🌟
      ['n7', '\u{1F4AF}'], // ⭐
    ]);
    const world = createHearWorld(CHOICES, () => 0, 1.0, iconMap);
    expect(world.fallers[0]).toHaveProperty('icon');
    expect(world.fallers.find((f) => f.token === 'n3')).toHaveProperty('icon', '\u{1F31F}');
    expect(world.fallers.find((f) => f.token === 'n7')).toHaveProperty('icon', '\u{1F4AF}');
    // Choices not in the map should have no icon (undefined, falsy).
    const n9 = world.fallers.find((f) => f.token === 'n9');
    expect(n9?.icon).toBeUndefined();
  });

  it('works without an icons map (icons undefined)', () => {
    const world = createHearWorld(CHOICES, () => 0);
    for (const faller of world.fallers) {
      expect(faller.icon).toBeUndefined();
    }
  });

  it('removeFaller drops only the matching faller, leaving the rest untouched', () => {
    const world = createHearWorld(CHOICES, () => 0);
    const target = world.fallers[1]!;
    const next = removeFaller(world, target.id);
    expect(next.fallers).toHaveLength(world.fallers.length - 1);
    expect(next.fallers.find((f) => f.id === target.id)).toBeUndefined();
    // Untouched fallers keep their original data.
    expect(next.fallers.map((f) => f.token)).toEqual(
      world.fallers.filter((f) => f.id !== target.id).map((f) => f.token),
    );
  });
});
