/**
 * Pure simulation for Whack-a-Mole — no DOM, no timers, no sound.
 * WhackAMole.tsx owns rendering, input and the rAF loop; tests drive this
 * directly. The model is time-stepped (like the Star Catcher engine): critters
 * pop up in empty holes, stay for a shrinking show-window, then duck back down.
 *
 * It's a timed game — `score` is the number of critters bonked before the clock
 * runs out. Difficulty ramps with *elapsed time* (not score), so every run gets
 * uniformly busier toward the end regardless of how good the player is — which
 * keeps it fair for the youngest hands.
 */

export const HOLES = 9; // 3×3 board
export const GAME_DURATION = 30; // seconds per round

// Spawn cadence and how long a critter stays up, both ramping with elapsed time.
const BASE_SPAWN_INTERVAL = 0.85; // s between pop-ups at the start
const MIN_SPAWN_INTERVAL = 0.4;
const SPAWN_SHRINK_PER_SEC = 0.015;

const BASE_SHOW = 1.15; // s a critter stays up at the start
const MIN_SHOW = 0.65;
const SHOW_SHRINK_PER_SEC = 0.018;

export interface Mole {
  id: number;
  hole: number; // 0..HOLES-1
  remaining: number; // seconds left visible
}

export interface WhackWorld {
  moles: Mole[]; // currently-visible critters
  score: number;
  timeLeft: number;
  nextSpawnIn: number;
  nextId: number;
}

/** 'escape' = a critter ducked back down un-bonked (one per escaped mole). */
export type WhackEvent = 'escape';

function elapsed(world: WhackWorld): number {
  return GAME_DURATION - world.timeLeft;
}

export function spawnInterval(elapsedSec: number): number {
  return Math.max(BASE_SPAWN_INTERVAL - elapsedSec * SPAWN_SHRINK_PER_SEC, MIN_SPAWN_INTERVAL);
}

export function showDuration(elapsedSec: number): number {
  return Math.max(BASE_SHOW - elapsedSec * SHOW_SHRINK_PER_SEC, MIN_SHOW);
}

export function createWorld(): WhackWorld {
  return {
    moles: [],
    score: 0,
    timeLeft: GAME_DURATION,
    nextSpawnIn: BASE_SPAWN_INTERVAL,
    nextId: 1,
  };
}

export function isOver(world: WhackWorld): boolean {
  return world.timeLeft <= 0;
}

/** Advance the world by `dt` seconds. `rng` is injectable for deterministic tests. */
export function stepWorld(
  world: WhackWorld,
  dt: number,
  rng: () => number = Math.random,
): { world: WhackWorld; events: WhackEvent[] } {
  if (isOver(world)) return { world, events: [] };

  const events: WhackEvent[] = [];
  const timeLeft = Math.max(0, world.timeLeft - dt);
  let { nextSpawnIn, nextId } = world;

  // Age the visible critters; any that hit zero duck back down (escape).
  const moles: Mole[] = [];
  for (const mole of world.moles) {
    const remaining = mole.remaining - dt;
    if (remaining > 0) moles.push({ ...mole, remaining });
    else events.push('escape');
  }

  // Spawn while the clock is still running and there's an empty hole.
  nextSpawnIn -= dt;
  while (nextSpawnIn <= 0 && timeLeft > 0) {
    const occupied = new Set(moles.map((m) => m.hole));
    const free: number[] = [];
    for (let h = 0; h < HOLES; h += 1) if (!occupied.has(h)) free.push(h);
    if (free.length > 0) {
      const hole = free[Math.floor(rng() * free.length)]!;
      moles.push({ id: nextId, hole, remaining: showDuration(elapsed(world)) });
      nextId += 1;
    }
    nextSpawnIn += spawnInterval(elapsed(world));
  }

  return { world: { moles, score: world.score, timeLeft, nextSpawnIn, nextId }, events };
}

/** Bonk the critter at `hole`. Returns the new world and whether it was a hit. */
export function whack(world: WhackWorld, hole: number): { world: WhackWorld; hit: boolean } {
  if (isOver(world)) return { world, hit: false };
  const target = world.moles.find((m) => m.hole === hole);
  if (!target) return { world, hit: false };
  return {
    world: {
      ...world,
      moles: world.moles.filter((m) => m.id !== target.id),
      score: world.score + 1,
    },
    hit: true,
  };
}
