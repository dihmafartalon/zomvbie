import type { Object3D, Scene, Vector3 } from 'three';
import { zombieHealthForRound, zombieSpeedForRound } from '../config/balance';
import type { GameMap } from '../world/GameMap';
import { Zombie, type ZombieContext } from './Zombie';

export interface ZombieManagerCallbacks {
  onStrike(zombie: Zombie): void;
  /** A zombie wants to groan; `distance` is to the player. */
  onGroan(zombie: Zombie, distance: number): void;
}

/** Owns the live zombie list: spawning, per-frame updates and cleanup. */
export class ZombieManager {
  readonly zombies: Zombie[] = [];
  private readonly hittables: Object3D[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly map: GameMap,
    private readonly callbacks: ZombieManagerCallbacks,
  ) {}

  /** Zombies still in the fight (rising, chasing or attacking). */
  get aliveCount(): number {
    let n = 0;
    for (const z of this.zombies) if (z.isAlive) n++;
    return n;
  }

  spawn(round: number, playerPos: Vector3, rand: () => number = Math.random): Zombie {
    const point = this.pickSpawnPoint(playerPos, rand);
    const zombie = new Zombie(point, zombieHealthForRound(round), zombieSpeedForRound(round, rand()), rand);
    this.zombies.push(zombie);
    this.scene.add(zombie.root);
    return zombie;
  }

  update(dt: number, playerPos: Vector3): void {
    const ctx: ZombieContext = {
      playerPos,
      world: this.map.collision,
      nav: this.map.nav,
      others: this.zombies,
      onStrike: this.callbacks.onStrike,
    };
    for (const z of this.zombies) {
      z.update(dt, ctx);
      if (z.isAlive && z.state !== 'rising') {
        z.groanTimer -= dt;
        if (z.groanTimer <= 0) {
          z.groanTimer = 3 + Math.random() * 6;
          this.callbacks.onGroan(z, z.position.distanceTo(playerPos));
        }
      }
    }
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.state === 'dead') {
        this.remove(z);
        this.zombies.splice(i, 1);
      }
    }
  }

  /** Meshes of living zombies, for weapon raycasts. */
  getHittables(): Object3D[] {
    this.hittables.length = 0;
    for (const z of this.zombies) {
      if (z.isAlive) for (const m of z.hitMeshes) this.hittables.push(m);
    }
    return this.hittables;
  }

  clear(): void {
    for (const z of this.zombies) this.remove(z);
    this.zombies.length = 0;
  }

  private remove(z: Zombie): void {
    this.scene.remove(z.root);
    z.dispose();
  }

  /** Prefer nearby spawns (but not on top of the player) so action stays close. */
  private pickSpawnPoint(playerPos: Vector3, rand: () => number): Vector3 {
    const spawns = this.map.zombieSpawns;
    const candidates = spawns
      .filter((p) => p.distanceTo(playerPos) > 10)
      .sort((a, b) => a.distanceTo(playerPos) - b.distanceTo(playerPos));
    const pool = candidates.length > 0 ? candidates.slice(0, 5) : spawns;
    return pool[Math.floor(rand() * pool.length)];
  }
}
