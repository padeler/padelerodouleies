/**
 * Pure simulation for the Listen (Hear It) action level — no DOM, no canvas,
 * no timers, no audio. HearIt.tsx owns the canvas, rAF loop, audio and input;
 * tests drive this directly (Star Catcher pattern).
 *
 * One round = the spoken target plus its distractors drifting down in columns.
 * The kid taps the glyph that matches what they heard. A faller that reaches the
 * bottom is reported as "fallen" — if it's the target, the component treats that
 * as a miss (a lost life, per the lives-endless rule). Fall speed ramps with
 * elapsed time so the level keeps its time-trial pressure.
 */

export const HEAR_W = 360;
export const HEAR_H = 420;
export const FALLER_R = 30;

// Gentle pace so a young kid has time to find the spoken target (the level is
// still a time-trial — fallers keep accelerating — just with more breathing room).
const BASE_FALL_SPEED = 42; // px/s at entry
const SPEED_RAMP_PER_SEC = 4; // accelerates the longer the round runs
const MAX_FALL_SPEED = 130;
const COLUMN_STAGGER = 90; // px of head-start spread between fallers

export interface Faller {
  id: number;
  token: string;
  glyph: string;
  icon?: string; // optional emoji icon alongside the glyph
  x: number;
  y: number;
}

export interface HearWorld {
  fallers: Faller[];
  elapsed: number;
  speedMult: number; // multiplier for fall speed; defaults to 1.0
}

export interface HearChoice {
  token: string;
  glyph: string;
}

function shuffleColumns(n: number, rng: () => number): number[] {
  const cols = Array.from({ length: n }, (_, i) => i);
  for (let i = cols.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cols[i]!;
    cols[i] = cols[j]!;
    cols[j] = tmp;
  }
  return cols;
}

/** Lay the choices out in evenly spaced columns, staggered above the screen. */
export function createHearWorld(
  choices: HearChoice[],
  rng: () => number = Math.random,
  speedMult: number = 1.0,
  icons?: Map<string, string>, // token → emoji; undefined = no icons
): HearWorld {
  const n = choices.length;
  const columns = shuffleColumns(n, rng);
  const fallers = choices.map((choice, i) => {
    const col = columns[i]!;
    return {
      id: i + 1,
      token: choice.token,
      glyph: choice.glyph,
      icon: icons?.get(choice.token),
      x: HEAR_W * ((col + 0.5) / n),
      y: -FALLER_R - i * COLUMN_STAGGER,
    };
  });
  return { fallers, elapsed: 0, speedMult };
}

export function fallSpeed(elapsed: number, mult: number = 1.0): number {
  return Math.min((BASE_FALL_SPEED + elapsed * SPEED_RAMP_PER_SEC) * mult, MAX_FALL_SPEED);
}

/**
 * Advance the world by `dt` seconds. Returns the new world and the tokens of any
 * fallers that reached the bottom this step (removed from play).
 */
export function stepHear(world: HearWorld, dt: number): { world: HearWorld; fallen: string[] } {
  const elapsed = world.elapsed + dt;
  const speed = fallSpeed(elapsed, world.speedMult);
  const fallen: string[] = [];
  const fallers: Faller[] = [];
  for (const faller of world.fallers) {
    const y = faller.y + speed * dt;
    if (y - FALLER_R > HEAR_H) fallen.push(faller.token);
    else fallers.push({ ...faller, y });
  }
  return { world: { fallers, elapsed, speedMult: world.speedMult }, fallen };
}

/** Drop a faller by id (e.g. after a correct multi-target tap) — pure, no side effects. */
export function removeFaller(world: HearWorld, id: number): HearWorld {
  return { ...world, fallers: world.fallers.filter((f) => f.id !== id) };
}

/** Hit-test a tap (in world coords) against the fallers; nearest within radius. */
export function fallerAt(world: HearWorld, x: number, y: number): Faller | null {
  let best: Faller | null = null;
  let bestDist = FALLER_R * FALLER_R * 2.25; // generous touch radius (1.5×)
  for (const faller of world.fallers) {
    const dx = faller.x - x;
    const dy = faller.y - y;
    const dist = dx * dx + dy * dy;
    if (dist <= bestDist) {
      best = faller;
      bestDist = dist;
    }
  }
  return best;
}
