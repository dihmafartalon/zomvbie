import { describe, expect, it } from 'vitest';
import { CollisionWorld, segmentHitsRect } from '../src/world/Collision';
import { NavGraph } from '../src/world/NavGraph';

function wallWorld(): CollisionWorld {
  const w = new CollisionWorld();
  // A wall along X from -5..5 at z ≈ 0.
  w.add({ minX: -5, maxX: 5, minY: 0, maxY: 3, minZ: -0.2, maxZ: 0.2, nav: true });
  return w;
}

describe('CollisionWorld.resolveCylinder', () => {
  it('pushes a cylinder out of a wall along the normal', () => {
    const w = wallWorld();
    const p = { x: 0, z: 0.4 };
    expect(w.resolveCylinder(p, 0.35, 0, 1.8)).toBe(true);
    expect(p.z).toBeCloseTo(0.55);
    expect(p.x).toBe(0);
  });

  it('leaves non-overlapping cylinders alone', () => {
    const w = wallWorld();
    const p = { x: 0, z: 2 };
    expect(w.resolveCylinder(p, 0.35, 0, 1.8)).toBe(false);
    expect(p).toEqual({ x: 0, z: 2 });
  });

  it('ignores boxes entirely above the cylinder', () => {
    const w = new CollisionWorld();
    w.add({ minX: -1, maxX: 1, minY: 4, maxY: 5, minZ: -1, maxZ: 1 });
    const p = { x: 0, z: 0 };
    expect(w.resolveCylinder(p, 0.35, 0, 1.8)).toBe(false);
  });

  it('ejects a centre that ended up inside a box', () => {
    const w = wallWorld();
    const p = { x: 4.9, z: 0.05 };
    w.resolveCylinder(p, 0.35, 0, 1.8);
    expect(Math.abs(p.z) >= 0.2 + 0.35 - 1e-9 || p.x >= 5 + 0.35 - 1e-9).toBe(true);
  });
});

describe('segmentHitsRect', () => {
  it('detects crossings and misses', () => {
    expect(segmentHitsRect(0, -2, 0, 2, -1, -1, 1, 1)).toBe(true);
    expect(segmentHitsRect(2, -2, 2, 2, -1, -1, 1, 1)).toBe(false);
    expect(segmentHitsRect(-3, 0, -2, 0, -1, -1, 1, 1)).toBe(false);
  });
});

describe('NavGraph', () => {
  const nodes = [
    { x: -6, z: -1 },
    { x: -6, z: 1 },
    { x: 6, z: -1 },
    { x: 6, z: 1 },
  ];

  it('walks straight when the line is clear', () => {
    const nav = new NavGraph(wallWorld(), nodes);
    const to = { x: 3, z: -3 };
    expect(nav.nextWaypoint({ x: 0, z: -2 }, to)).toBe(to);
  });

  it('routes around a wall via the nearest corner', () => {
    const nav = new NavGraph(wallWorld(), nodes);
    const wp = nav.nextWaypoint({ x: -3, z: -2 }, { x: -3, z: 2 });
    expect(wp).toEqual({ x: -6, z: -1 });
  });

  it('skips a node the agent is already standing on', () => {
    const nav = new NavGraph(wallWorld(), nodes);
    const wp = nav.nextWaypoint({ x: -6, z: -1.1 }, { x: -3, z: 2 });
    expect(wp).toEqual({ x: -6, z: 1 });
  });
});
