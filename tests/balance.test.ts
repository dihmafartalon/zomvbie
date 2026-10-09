import { describe, expect, it } from 'vitest';
import {
  runnerChanceForRound,
  spawnDelayForRound,
  ZOMBIE,
  zombieHealthForRound,
  zombieSpeedForRound,
  zombiesForRound,
} from '../src/config/balance';

describe('balance curves', () => {
  it('zombie count starts small and strictly increases', () => {
    expect(zombiesForRound(1)).toBe(6);
    for (let r = 1; r < 40; r++) expect(zombiesForRound(r + 1)).toBeGreaterThan(zombiesForRound(r));
  });

  it('zombie health is linear to round 9 then compounds 10%', () => {
    expect(zombieHealthForRound(1)).toBe(150);
    expect(zombieHealthForRound(9)).toBe(950);
    expect(zombieHealthForRound(10)).toBe(1045);
    expect(zombieHealthForRound(20)).toBeGreaterThan(zombieHealthForRound(19));
  });

  it('no sprinters in the opening rounds; capped later', () => {
    expect(runnerChanceForRound(1)).toBe(0);
    expect(runnerChanceForRound(2)).toBe(0);
    expect(runnerChanceForRound(100)).toBe(0.85);
    expect(zombieSpeedForRound(1, 0)).toBe(ZOMBIE.walkSpeed);
    expect(zombieSpeedForRound(10, 0)).toBe(ZOMBIE.runSpeed);
  });

  it('spawn delay shrinks but has a floor', () => {
    expect(spawnDelayForRound(1)).toBe(2);
    expect(spawnDelayForRound(50)).toBe(0.5);
  });
});
