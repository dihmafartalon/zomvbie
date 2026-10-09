import { type CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import type { MapBuilder } from '../MapBuilder';
import { puddleTexture, seededRandom, stainTexture } from '../textures';

export const LOT = { minX: -30, maxX: 30, minZ: -21, maxZ: 30 };
export const ROAD = { z: -25.5, width: 9 };

/** Ground layers: dirt shoulder, cracked forecourt, highway, paint and decals. */
export function buildForecourt(b: MapBuilder): void {
  const a = b.assets;

  b.floor(260, 260, a.pbr('forest_ground_04', { color: 0x777777 }), 0, 0, 0, 4);
  b.floor(LOT.maxX - LOT.minX, LOT.maxZ - LOT.minZ, a.pbr('asphalt_02', { color: 0x9a9a9a }), 0, 0.01, (LOT.minZ + LOT.maxZ) / 2, 3.5);
  b.floor(260, ROAD.width, a.pbr('aerial_asphalt_01', { color: 0x7d7d7d }), 0, 0.012, ROAD.z, 9);

  const paint = (color: number, opacity: number): MeshStandardMaterial =>
    new MeshStandardMaterial({ color, roughness: 0.75, transparent: true, opacity, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const yellow = paint(0xb8901c, 0.8);
  const white = paint(0xb9b9b2, 0.55);
  for (const dz of [-0.13, 0.13]) b.floor(260, 0.1, yellow, 0, 0.02, ROAD.z + dz, 260);
  for (const dz of [-ROAD.width / 2 + 0.35, ROAD.width / 2 - 0.35]) b.floor(260, 0.14, white, 0, 0.02, ROAD.z + dz, 260);
  // Parking bays in front of the store.
  for (const x of [-12, -9, -6, -3.6, 3.6, 6, 9, 12]) b.floor(0.12, 4.5, white, x, 0.02, 0.4, 4.5);

  // Store apron and kerbs where the lot meets the road (gaps for driveways).
  b.floor(18, 3.4, a.pbr('dirty_concrete', { color: 0xa0a0a0 }), 0, 0.02, 3.3, 2.5);
  const kerb = a.pbr('concrete_floor_worn_001', { color: 0x9a9a9a });
  for (const [x0, x1] of [[-30, -20], [-8, 8], [20, 30]]) {
    b.box(x1 - x0, 0.16, 0.35, kerb, (x0 + x1) / 2, 0, LOT.minZ, { collide: false, castShadow: false, tile: 1.5 });
  }

  // Oil stains under pumps and parking spots, tyre grime at the driveways.
  const stains = [stainTexture(3), stainTexture(8), stainTexture(13)];
  const rand = seededRandom(31);
  const spots: [number, number, number][] = [
    [-3, -10.8, 1.8], [-3, -5.2, 1.6], [3, -10.6, 1.7], [3, -5.4, 2], [-1.5, -8, 2.4],
    [-10.5, 0.8, 2.2], [7.5, 0.4, 2], [-13, -16, 2.6], [12, -16, 2.2], [-14, -20.2, 3], [14, -20.4, 3],
  ];
  spots.forEach(([x, z, size], i) => decal(b, stains[i % stains.length], size, x, z, rand() * Math.PI, 0.9));

  // Glossy puddles: low roughness so the canopy and security lights glint in them.
  const puddles: [number, number, number][] = [[6.5, -2.5, 3.2], [-6, -14, 2.6], [-17, 3, 4], [16, 9, 3.4], [1, -18, 2.4], [-4, 22, 3]];
  puddles.forEach(([x, z, size], i) => {
    const mat = new MeshStandardMaterial({
      color: 0x0a0c10,
      roughness: 0.04,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      alphaMap: puddleTexture(40 + i),
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    const m = new Mesh(new PlaneGeometry(size, size * 0.8), mat);
    m.rotation.set(-Math.PI / 2, 0, rand() * Math.PI);
    m.position.set(x, 0.025, z);
    m.receiveShadow = true;
    b.root.add(m);
  });
}

function decal(b: MapBuilder, tex: CanvasTexture, size: number, x: number, z: number, rot: number, opacity: number): void {
  const m = new Mesh(
    new PlaneGeometry(size, size),
    new MeshStandardMaterial({ color: 0x000000, alphaMap: tex, transparent: true, opacity, roughness: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
  );
  m.rotation.set(-Math.PI / 2, 0, rot);
  m.position.set(x, 0.022, z);
  m.receiveShadow = true;
  b.root.add(m);
}
