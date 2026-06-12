/**
 * Pure simulation for Star Catcher — no DOM, no canvas, no timers.
 * StarCatcher.tsx owns rendering, input and the rAF loop; tests drive this directly.
 */

export const WORLD_W = 360;
export const WORLD_H = 480;
export const BASKET_W = 72;
export const CATCH_ZONE_H = 44;
export const ITEM_R = 16;
export const START_LIVES = 3;

// Difficulty ramp: tuned to keep climbing well into a long run rather than
// plateauing early — items fall faster and spawn denser the higher you score.
const BASE_FALL_SPEED = 120; // px/s
const SPEED_PER_POINT = 7; // steeper acceleration per caught star
const MAX_FALL_SPEED = 440; // higher ceiling so speed keeps rising to ~score 46
const BASE_SPAWN_INTERVAL = 1.1; // s
const MIN_SPAWN_INTERVAL = 0.32; // denser screen at high scores
const SPAWN_SHRINK_PER_POINT = 0.035;
const BOMB_PROBABILITY = 0.15;

export type ItemKind = 'star' | 'bomb';

export interface FallingItem {
  id: number;
  x: number;
  y: number;
  kind: ItemKind;
}

export interface CatcherWorld {
  items: FallingItem[];
  score: number;
  lives: number;
  nextSpawnIn: number;
  nextId: number;
}

/** 'catch' = star caught (+1), 'bomb' = bomb caught (-1 life), 'miss' = star hit the floor (-1 life). */
export type CatcherEvent = 'catch' | 'bomb' | 'miss';

export function createWorld(): CatcherWorld {
  return { items: [], score: 0, lives: START_LIVES, nextSpawnIn: BASE_SPAWN_INTERVAL, nextId: 1 };
}

export function fallSpeed(score: number): number {
  return Math.min(BASE_FALL_SPEED + score * SPEED_PER_POINT, MAX_FALL_SPEED);
}

export function spawnInterval(score: number): number {
  return Math.max(BASE_SPAWN_INTERVAL - score * SPAWN_SHRINK_PER_POINT, MIN_SPAWN_INTERVAL);
}

/**
 * Advance the world by `dt` seconds with the basket centred at `basketX`.
 * Returns the new world plus the events that occurred, so the caller can play
 * sounds / end the game. `rng` is injectable for deterministic tests.
 */
export function stepWorld(
  world: CatcherWorld,
  dt: number,
  basketX: number,
  rng: () => number = Math.random,
): { world: CatcherWorld; events: CatcherEvent[] } {
  const events: CatcherEvent[] = [];
  let { score, lives, nextSpawnIn, nextId } = world;
  let items = [...world.items];

  nextSpawnIn -= dt;
  while (nextSpawnIn <= 0) {
    const kind: ItemKind = rng() < BOMB_PROBABILITY ? 'bomb' : 'star';
    items.push({ id: nextId, x: ITEM_R + rng() * (WORLD_W - 2 * ITEM_R), y: -ITEM_R, kind });
    nextId += 1;
    nextSpawnIn += spawnInterval(score);
  }

  const speed = fallSpeed(score);
  const catchY = WORLD_H - CATCH_ZONE_H;
  const halfCatch = BASKET_W / 2 + ITEM_R / 2;

  const remaining: FallingItem[] = [];
  for (const item of items) {
    const y = item.y + speed * dt;
    const inCatchZone = y >= catchY && Math.abs(item.x - basketX) <= halfCatch;
    if (inCatchZone) {
      if (item.kind === 'star') {
        score += 1;
        events.push('catch');
      } else {
        lives -= 1;
        events.push('bomb');
      }
    } else if (y - ITEM_R > WORLD_H) {
      if (item.kind === 'star') {
        lives -= 1;
        events.push('miss');
      }
      // Bombs falling off-screen are harmless and simply disappear.
    } else {
      remaining.push({ ...item, y });
    }
  }
  items = remaining;

  return { world: { items, score, lives, nextSpawnIn, nextId }, events };
}
