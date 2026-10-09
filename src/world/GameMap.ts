import type { Object3D, Vector3 } from 'three';
import type { WeaponId } from '../weapons/WeaponDefs';
import type { CollisionWorld } from './Collision';
import type { NavGraph } from './NavGraph';

export interface WallBuySpot {
  readonly weaponId: WeaponId;
  /** Where the player must stand (feet level) to interact. */
  readonly position: Vector3;
}

/**
 * Everything the game needs from a map. New maps implement this interface and
 * the rest of the game stays untouched.
 */
export interface GameMap {
  readonly name: string;
  readonly root: Object3D;
  readonly collision: CollisionWorld;
  readonly nav: NavGraph;
  /** Objects that stop bullets (raycast recursively). */
  readonly bulletBlockers: readonly Object3D[];
  readonly zombieSpawns: readonly Vector3[];
  readonly playerSpawn: { readonly position: Vector3; readonly yaw: number };
  readonly wallBuys: readonly WallBuySpot[];
  /** Slow orbit shown behind the main menu. */
  readonly menuCamera: { readonly target: Vector3; readonly radius: number; readonly height: number };
  /** Strength of image-based (environment map) lighting, if the map wants it. */
  readonly environmentIntensity?: number;
  update(dt: number): void;
  setShadowsEnabled(enabled: boolean): void;
}
