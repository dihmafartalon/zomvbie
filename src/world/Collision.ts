import { Box3, type Object3D } from 'three';

/** Axis-aligned collision box in world space. */
export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  /** Large static obstacle that zombie path-finding must route around. */
  nav?: boolean;
}

export interface XZ {
  x: number;
  z: number;
}

const tmpBox = new Box3();

/**
 * Static world collision built from AABBs. Characters are treated as vertical
 * cylinders and resolved on the XZ plane, which gives smooth wall sliding.
 */
export class CollisionWorld {
  readonly boxes: AABB[] = [];

  add(box: AABB): AABB {
    this.boxes.push(box);
    return box;
  }

  /** Adds the world-space bounding box of an object (and its children). */
  addObject(obj: Object3D, nav = false): AABB {
    obj.updateMatrixWorld(true);
    tmpBox.setFromObject(obj);
    return this.add({
      minX: tmpBox.min.x,
      minY: tmpBox.min.y,
      minZ: tmpBox.min.z,
      maxX: tmpBox.max.x,
      maxY: tmpBox.max.y,
      maxZ: tmpBox.max.z,
      nav,
    });
  }

  /**
   * Pushes a vertical cylinder (centre `pos`, `radius`, spanning y0..y1) out of
   * every box it overlaps. Mutates `pos` and returns true if it collided.
   */
  resolveCylinder(pos: XZ, radius: number, y0: number, y1: number): boolean {
    let collided = false;
    const r2 = radius * radius;
    // Two passes settle corners where two boxes push in different directions.
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.boxes) {
        if (y1 <= b.minY || y0 >= b.maxY) continue;
        const cx = clamp(pos.x, b.minX, b.maxX);
        const cz = clamp(pos.z, b.minZ, b.maxZ);
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r2) continue;
        collided = true;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          const push = radius - d;
          pos.x += (dx / d) * push;
          pos.z += (dz / d) * push;
        } else {
          // Centre is inside the box: leave along the shallowest axis.
          const left = pos.x - b.minX;
          const right = b.maxX - pos.x;
          const back = pos.z - b.minZ;
          const front = b.maxZ - pos.z;
          const m = Math.min(left, right, back, front);
          if (m === left) pos.x = b.minX - radius;
          else if (m === right) pos.x = b.maxX + radius;
          else if (m === back) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
    }
    return collided;
  }

  /** True if walking straight from a to b avoids every nav-blocking box grown by `clearance`. */
  navLineClear(a: XZ, b: XZ, clearance: number): boolean {
    for (const box of this.boxes) {
      if (!box.nav) continue;
      if (
        segmentHitsRect(
          a.x, a.z, b.x, b.z,
          box.minX - clearance, box.minZ - clearance,
          box.maxX + clearance, box.maxZ + clearance,
        )
      ) {
        return false;
      }
    }
    return true;
  }
}

/** Liang–Barsky style slab test: does segment a→b touch the rectangle? */
export function segmentHitsRect(
  ax: number, az: number, bx: number, bz: number,
  minX: number, minZ: number, maxX: number, maxZ: number,
): boolean {
  let t0 = 0;
  let t1 = 1;
  const axes: [number, number, number, number][] = [
    [ax, bx - ax, minX, maxX],
    [az, bz - az, minZ, maxZ],
  ];
  for (const [p, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
      continue;
    }
    let ta = (lo - p) / d;
    let tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
