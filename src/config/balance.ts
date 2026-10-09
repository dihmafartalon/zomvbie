/**
 * Central gameplay tuning. Everything here is plain data or pure functions so
 * balance changes are easy to review and unit test in isolation.
 */

export const PLAYER = {
  maxHealth: 100,
  /** Seconds without taking damage before health starts regenerating. */
  regenDelay: 4,
  /** Health regenerated per second once regeneration kicks in. */
  regenRate: 45,
  walkSpeed: 4.6,
  sprintSpeed: 7.0,
  adsSpeedMultiplier: 0.6,
  jumpVelocity: 5.4,
  gravity: 18,
  radius: 0.35,
  height: 1.8,
  eyeHeight: 1.65,
  startingPoints: 500,
} as const;

export const POINTS = {
  hit: 10,
  kill: 60,
  headshotKill: 100,
} as const;

export const ZOMBIE = {
  radius: 0.35,
  attackRange: 1.25,
  attackDamage: 35,
  /** Time from starting a swing until the hit lands. */
  attackWindup: 0.5,
  /** Full length of one attack swing. */
  attackDuration: 1.1,
  riseTime: 1.4,
  corpseTime: 3.5,
  walkSpeed: 1.3,
  runSpeed: 4.0,
} as const;

export const ROUNDS = {
  firstIntermission: 4,
  intermission: 9,
  /** Cap on simultaneously alive zombies; the rest of the round queues up. */
  maxActive: 24,
} as const;

/** Total zombies spawned over the course of a round (solo). */
export function zombiesForRound(round: number): number {
  const early = [6, 8, 13, 18, 24];
  if (round <= early.length) return early[Math.max(0, round - 1)];
  const r = round - early.length;
  return Math.round(24 + r * 5 + 0.25 * r * r);
}

/** Zombie health: +100 per round until round 9, then +10% compounding. */
export function zombieHealthForRound(round: number): number {
  if (round <= 9) return 150 + 100 * (Math.max(1, round) - 1);
  return Math.round(950 * Math.pow(1.1, round - 9));
}

/** Probability that a newly spawned zombie is a sprinter. */
export function runnerChanceForRound(round: number): number {
  return Math.min(0.85, Math.max(0, (round - 2) * 0.15));
}

/** Seconds between individual zombie spawns during a round. */
export function spawnDelayForRound(round: number): number {
  return Math.max(0.5, 2.0 - 0.15 * (round - 1));
}

/** Movement speed for a zombie, given a uniform random roll in [0, 1). */
export function zombieSpeedForRound(round: number, roll: number): number {
  if (roll < runnerChanceForRound(round)) return ZOMBIE.runSpeed;
  return ZOMBIE.walkSpeed + Math.min(1.2, 0.12 * (round - 1));
}
