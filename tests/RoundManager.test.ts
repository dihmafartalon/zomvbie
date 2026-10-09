import { describe, expect, it } from 'vitest';
import { ROUNDS, zombiesForRound } from '../src/config/balance';
import { RoundManager } from '../src/game/RoundManager';

/** Drives the manager like the game loop would, with an instant-kill player. */
function simulateRound(rm: RoundManager, maxSteps = 100_000): number {
  let spawned = 0;
  for (let i = 0; i < maxSteps && rm.phase === 'active'; i++) {
    spawned += rm.update(0.1, 0);
  }
  return spawned;
}

describe('RoundManager', () => {
  it('starts round 1 after the first intermission', () => {
    const started: number[] = [];
    const rm = new RoundManager({ onRoundStart: (r) => started.push(r) });
    expect(rm.round).toBe(0);
    rm.update(ROUNDS.firstIntermission + 0.01, 0);
    expect(rm.round).toBe(1);
    expect(rm.phase).toBe('active');
    expect(started).toEqual([1]);
  });

  it('spawns exactly the round quota, then completes', () => {
    const completed: number[] = [];
    const rm = new RoundManager({ onRoundComplete: (r) => completed.push(r) });
    rm.update(ROUNDS.firstIntermission + 0.01, 0);
    expect(simulateRound(rm)).toBe(zombiesForRound(1));
    expect(rm.phase).toBe('intermission');
    expect(completed).toEqual([1]);
  });

  it('does not complete while zombies are alive', () => {
    const rm = new RoundManager();
    rm.update(ROUNDS.firstIntermission + 0.01, 0);
    rm.remainingToSpawn = 0;
    rm.update(0.1, 3);
    expect(rm.phase).toBe('active');
    rm.update(0.1, 0);
    expect(rm.phase).toBe('intermission');
  });

  it('respects the active zombie cap', () => {
    const rm = new RoundManager();
    rm.update(ROUNDS.firstIntermission + 0.01, 0);
    let spawned = 0;
    for (let i = 0; i < 1000; i++) spawned += rm.update(0.1, ROUNDS.maxActive);
    expect(spawned).toBe(0);
  });

  it('advances to round 2 after the intermission', () => {
    const rm = new RoundManager();
    rm.update(ROUNDS.firstIntermission + 0.01, 0);
    simulateRound(rm);
    rm.update(ROUNDS.intermission + 0.01, 0);
    expect(rm.round).toBe(2);
    expect(rm.remainingToSpawn).toBe(zombiesForRound(2));
  });

  it('reset returns to the pre-game state', () => {
    const rm = new RoundManager();
    rm.update(ROUNDS.firstIntermission + 0.01, 0);
    rm.reset();
    expect(rm.round).toBe(0);
    expect(rm.phase).toBe('intermission');
  });
});
