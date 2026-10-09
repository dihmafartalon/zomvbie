import { ROUNDS, spawnDelayForRound, zombiesForRound } from '../config/balance';

export type RoundPhase = 'intermission' | 'active';

export interface RoundEvents {
  onRoundStart?(round: number): void;
  onRoundComplete?(round: number): void;
}

/**
 * Round progression state machine. It owns no scene objects: each frame it is
 * told how many zombies are alive and answers how many to spawn.
 */
export class RoundManager {
  round = 0;
  phase: RoundPhase = 'intermission';
  /** Zombies still queued to spawn this round. */
  remainingToSpawn = 0;
  private phaseTimer = 0;
  private spawnTimer = 0;

  constructor(private readonly events: RoundEvents = {}) {
    this.reset();
  }

  reset(): void {
    this.round = 0;
    this.phase = 'intermission';
    this.phaseTimer = ROUNDS.firstIntermission;
    this.remainingToSpawn = 0;
    this.spawnTimer = 0;
  }

  /** Seconds until the next round starts (0 while a round is active). */
  get intermissionRemaining(): number {
    return this.phase === 'intermission' ? Math.max(0, this.phaseTimer) : 0;
  }

  /** Advances timers. Returns the number of zombies to spawn this frame (0 or 1). */
  update(dt: number, alive: number): number {
    if (this.phase === 'intermission') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) this.startNextRound();
      return 0;
    }

    let spawns = 0;
    this.spawnTimer -= dt;
    if (this.remainingToSpawn > 0 && alive < ROUNDS.maxActive && this.spawnTimer <= 0) {
      spawns = 1;
      this.remainingToSpawn--;
      this.spawnTimer = spawnDelayForRound(this.round);
    }

    if (spawns === 0 && this.remainingToSpawn === 0 && alive === 0) {
      this.phase = 'intermission';
      this.phaseTimer = ROUNDS.intermission;
      this.events.onRoundComplete?.(this.round);
    }
    return spawns;
  }

  private startNextRound(): void {
    this.round++;
    this.phase = 'active';
    this.remainingToSpawn = zombiesForRound(this.round);
    this.spawnTimer = 0.5;
    this.events.onRoundStart?.(this.round);
  }
}
