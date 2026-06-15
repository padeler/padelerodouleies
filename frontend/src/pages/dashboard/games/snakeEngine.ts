/**
 * Pure simulation for Snake — no DOM, no canvas, no timers.
 * Snake.tsx owns rendering, input and the rAF loop; tests drive this directly.
 *
 * The world is a discrete grid. One `stepWorld` call advances the snake by a
 * single cell; the component fires it on a fixed step interval that shrinks as
 * the score climbs (see `stepInterval`). Keeping the model grid-discrete (no
 * sub-pixel motion, no per-frame physics) is what makes it cheap on the old
 * Tab 4 — a step only redraws a handful of filled cells.
 */

export const GRID_W = 15;
export const GRID_H = 20;
export const CELL = 24;
export const WORLD_W = GRID_W * CELL; // 360 — matches Star Catcher's canvas ratio
export const WORLD_H = GRID_H * CELL; // 480

const START_LEN = 3;

// Step-rate ramp: the snake starts gentle for the youngest players and speeds
// up gradually with every apple, flooring out so it never becomes unplayable.
// Deliberately easy — a slow start and a shallow ramp that only reaches full
// speed after ~30 apples, so young kids aren't overwhelmed early.
const BASE_STEP_INTERVAL = 0.3; // s between moves at score 0 (~3.3 cells/s)
const MIN_STEP_INTERVAL = 0.13; // s — fastest the snake ever moves
const STEP_SHRINK_PER_FOOD = 0.0055;

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

export interface SnakeWorld {
  snake: Point[]; // head first
  dir: Direction; // the direction actually committed on the last step
  food: Point;
  score: number;
  alive: boolean;
}

/** 'eat' = apple eaten (+1, snake grows); 'dead' = wall or self collision. */
export type SnakeEvent = 'eat' | 'dead';

const DELTAS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export function stepInterval(score: number): number {
  return Math.max(BASE_STEP_INTERVAL - score * STEP_SHRINK_PER_FOOD, MIN_STEP_INTERVAL);
}

/** Pick a random free cell for the next apple. */
function placeFood(snake: Point[], rng: () => number): Point {
  const occupied = new Set(snake.map((p) => p.y * GRID_W + p.x));
  const free: Point[] = [];
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (!occupied.has(y * GRID_W + x)) free.push({ x, y });
    }
  }
  // Board full = the player has won; an off-grid apple is simply never reached.
  if (free.length === 0) return { x: -1, y: -1 };
  return free[Math.floor(rng() * free.length)]!;
}

export function createWorld(rng: () => number = Math.random): SnakeWorld {
  const cy = Math.floor(GRID_H / 2);
  const cx = Math.floor(GRID_W / 2);
  // Lay the snake out horizontally, head on the right, moving right.
  const snake: Point[] = [];
  for (let i = 0; i < START_LEN; i += 1) snake.push({ x: cx - i, y: cy });
  return { snake, dir: 'right', food: placeFood(snake, rng), score: 0, alive: true };
}

/**
 * Advance the snake by one cell toward `nextDir`. A reversal into the snake's
 * own neck is ignored (the committed `dir` is kept). `rng` is injectable so the
 * apple placement is deterministic in tests.
 */
export function stepWorld(
  world: SnakeWorld,
  nextDir: Direction,
  rng: () => number = Math.random,
): { world: SnakeWorld; events: SnakeEvent[] } {
  if (!world.alive) return { world, events: [] };

  const dir = nextDir === OPPOSITE[world.dir] ? world.dir : nextDir;
  const head = world.snake[0]!; // the snake is never empty by construction
  const delta = DELTAS[dir];
  const newHead: Point = { x: head.x + delta.x, y: head.y + delta.y };

  // Wall collision.
  if (newHead.x < 0 || newHead.x >= GRID_W || newHead.y < 0 || newHead.y >= GRID_H) {
    return { world: { ...world, dir, alive: false }, events: ['dead'] };
  }

  const ate = newHead.x === world.food.x && newHead.y === world.food.y;
  // When not eating the tail vacates its cell this step, so it's not an obstacle.
  const body = ate ? world.snake : world.snake.slice(0, world.snake.length - 1);
  if (body.some((p) => p.x === newHead.x && p.y === newHead.y)) {
    return { world: { ...world, dir, alive: false }, events: ['dead'] };
  }

  if (ate) {
    const snake = [newHead, ...world.snake];
    return {
      world: { ...world, snake, dir, food: placeFood(snake, rng), score: world.score + 1 },
      events: ['eat'],
    };
  }

  const snake = [newHead, ...world.snake.slice(0, world.snake.length - 1)];
  return { world: { ...world, snake, dir }, events: [] };
}
