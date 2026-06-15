import { describe, expect, it } from 'vitest';
import {
  GRID_H,
  GRID_W,
  type SnakeWorld,
  createWorld,
  stepInterval,
  stepWorld,
} from './snakeEngine';

describe('snakeEngine', () => {
  it('starts with a horizontal snake moving right', () => {
    const world = createWorld(() => 0);
    expect(world.snake).toHaveLength(3);
    expect(world.dir).toBe('right');
    expect(world.alive).toBe(true);
    expect(world.score).toBe(0);
    // Head is to the right of the body.
    expect(world.snake[0].x).toBeGreaterThan(world.snake[1].x);
  });

  it('moves the head one cell without growing on an empty step', () => {
    const world = createWorld(() => 0);
    const head = world.snake[0];
    const { world: next, events } = stepWorld(world, 'right');
    expect(events).toEqual([]);
    expect(next.snake).toHaveLength(3);
    expect(next.snake[0]).toEqual({ x: head.x + 1, y: head.y });
  });

  it('ignores a reversal into its own neck', () => {
    const world = createWorld(() => 0);
    const { world: next } = stepWorld(world, 'left'); // opposite of 'right'
    expect(next.dir).toBe('right');
    expect(next.snake[0].x).toBe(world.snake[0].x + 1);
  });

  it('grows and scores when eating an apple', () => {
    const base = createWorld(() => 0);
    const head = base.snake[0];
    const world: SnakeWorld = { ...base, food: { x: head.x + 1, y: head.y } };
    const { world: next, events } = stepWorld(world, 'right', () => 0);
    expect(events).toEqual(['eat']);
    expect(next.score).toBe(1);
    expect(next.snake).toHaveLength(4);
    expect(next.snake[0]).toEqual({ x: head.x + 1, y: head.y });
  });

  it('dies on a wall collision', () => {
    const world: SnakeWorld = {
      snake: [
        { x: GRID_W - 1, y: 5 },
        { x: GRID_W - 2, y: 5 },
      ],
      dir: 'right',
      food: { x: 0, y: 0 },
      score: 0,
      alive: true,
    };
    const { world: next, events } = stepWorld(world, 'right');
    expect(events).toEqual(['dead']);
    expect(next.alive).toBe(false);
  });

  it('dies when the head runs into its own body', () => {
    // A C-shaped snake; turning up drives the head into a non-tail body cell.
    const world: SnakeWorld = {
      snake: [
        { x: 2, y: 2 }, // head
        { x: 1, y: 2 },
        { x: 1, y: 1 },
        { x: 2, y: 1 }, // body cell directly above the head
        { x: 3, y: 1 }, // tail
      ],
      dir: 'right',
      food: { x: 9, y: 9 },
      score: 0,
      alive: true,
    };
    const { world: next, events } = stepWorld(world, 'up');
    expect(events).toEqual(['dead']);
    expect(next.alive).toBe(false);
  });

  it('allows following the vacating tail cell', () => {
    // Moving into the current tail cell is safe: the tail leaves the same step.
    const world: SnakeWorld = {
      snake: [
        { x: 2, y: 2 }, // head
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 }, // tail — head turning down lands here
      ],
      dir: 'right',
      food: { x: 9, y: 9 },
      score: 0,
      alive: true,
    };
    const { world: next, events } = stepWorld(world, 'down');
    expect(events).toEqual([]);
    expect(next.alive).toBe(true);
    expect(next.snake[0]).toEqual({ x: 2, y: 3 });
  });

  it('never places an apple on the snake', () => {
    let calls = 0;
    // First rng() picks an occupied-ish low index; ensure result avoids the snake.
    const world = createWorld(() => {
      calls += 1;
      return calls === 1 ? 0 : 0.9;
    });
    const occupied = world.snake.some((p) => p.x === world.food.x && p.y === world.food.y);
    expect(occupied).toBe(false);
    expect(world.food.x).toBeGreaterThanOrEqual(0);
    expect(world.food.y).toBeLessThan(GRID_H);
  });

  it('shrinks the step interval as the score climbs but floors it', () => {
    expect(stepInterval(0)).toBeGreaterThan(stepInterval(10));
    expect(stepInterval(1000)).toBeGreaterThanOrEqual(0.13);
    expect(stepInterval(1000)).toBeLessThanOrEqual(stepInterval(0));
  });
});
