import {
  AdditiveBlending,
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  Quaternion,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import type { MapBuilder } from '../MapBuilder';
import { glowTexture, pylonSignTextures } from '../textures';
import { ROAD } from './forecourt';

export const HALF = 30;

/** Builds everything around the station. Returns a per-frame updater (fire). */
export function buildSurroundings(b: MapBuilder): (dt: number) => void {
  buildFence(b);
  buildRoadblocks(b);
  buildPylonSign(b);
  buildPowerLine(b);
  buildLotLight(b, -20, 13);
  buildProps(b);
  return buildBurnBarrel(b, -16.5, 6.5);
}

// ---- Perimeter fence (instanced from the licensed fence kit) ---------------------

function buildFence(b: MapBuilder): void {
  const kit = b.assets.source('fence_kit');
  const sides: { from: Vector3; to: Vector3 }[] = [
    { from: new Vector3(-HALF, 0, -HALF), to: new Vector3(HALF, 0, -HALF) },
    { from: new Vector3(-HALF, 0, HALF), to: new Vector3(HALF, 0, HALF) },
    // East/west sides stop at the road, which is barricaded instead.
    { from: new Vector3(-HALF, 0, ROAD.z + ROAD.width / 2 + 0.5), to: new Vector3(-HALF, 0, HALF) },
    { from: new Vector3(HALF, 0, ROAD.z + ROAD.width / 2 + 0.5), to: new Vector3(HALF, 0, HALF) },
  ];

  // Invisible colliders along the full boundary (road gaps included).
  const t = 0.4;
  b.collision.add({ minX: -HALF - 1, maxX: HALF + 1, minY: 0, maxY: 6, minZ: -HALF - t, maxZ: -HALF + t });
  b.collision.add({ minX: -HALF - 1, maxX: HALF + 1, minY: 0, maxY: 6, minZ: HALF - t, maxZ: HALF + t });
  b.collision.add({ minX: -HALF - t, maxX: -HALF + t, minY: 0, maxY: 6, minZ: -HALF - 1, maxZ: HALF + 1 });
  b.collision.add({ minX: HALF - t, maxX: HALF + t, minY: 0, maxY: 6, minZ: -HALF - 1, maxZ: HALF + 1 });

  if (!kit) return; // Missing asset: colliders still keep players in.
  const panel = extractPart(kit, 'modular_chainlink_fence_double');
  const post = extractPart(kit, 'modular_chainlink_fence_post');
  if (!panel || !post) return;

  const panelPlacements: Matrix4[] = [];
  const postPlacements: Matrix4[] = [];
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  for (const { from, to } of sides) {
    const len = from.distanceTo(to);
    const count = Math.max(1, Math.round(len / panel.width));
    const stretch = len / (count * panel.width);
    const dir = to.clone().sub(from).normalize();
    q.setFromAxisAngle(up, Math.atan2(-dir.z, dir.x));
    for (let i = 0; i < count; i++) {
      const c = from.clone().addScaledVector(dir, (i + 0.5) * panel.width * stretch);
      panelPlacements.push(new Matrix4().compose(c, q, new Vector3(stretch, 1, 1)));
    }
    for (let i = 0; i <= count; i++) {
      const p = from.clone().addScaledVector(dir, i * panel.width * stretch);
      postPlacements.push(new Matrix4().compose(p, q, new Vector3(1, 1, 1)));
    }
  }
  instance(b, panel, panelPlacements);
  instance(b, post, postPlacements);
}

interface Part {
  meshes: { mesh: Mesh; local: Matrix4 }[];
  width: number;
}

/** Pulls one named node out of a kit, re-pivoted to its footprint centre at ground level. */
function extractPart(kit: Object3D, name: string): Part | null {
  const node = kit.getObjectByName(name);
  if (!node) return null;
  kit.updateMatrixWorld(true);
  const box = new Box3().setFromObject(node);
  const centre = box.getCenter(new Vector3());
  const offset = new Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z);
  const meshes: Part['meshes'] = [];
  node.traverse((o) => {
    if ((o as Mesh).isMesh) meshes.push({ mesh: o as Mesh, local: offset.clone().multiply(o.matrixWorld) });
  });
  return { meshes, width: box.max.x - box.min.x };
}

function instance(b: MapBuilder, part: Part, placements: Matrix4[]): void {
  const m = new Matrix4();
  for (const { mesh, local } of part.meshes) {
    const mat = mesh.material as MeshStandardMaterial;
    if (mat.transparent) {
      // Alpha-tested wire avoids sorting artefacts across hundreds of panels.
      mat.transparent = false;
      mat.alphaTest = 0.5;
      mat.alphaToCoverage = true; // keeps distant wire from mip-mapping into a solid wall
      mat.depthWrite = true;
    }
    const inst = new InstancedMesh(mesh.geometry, mat, placements.length);
    placements.forEach((p, i) => inst.setMatrixAt(i, m.multiplyMatrices(p, local)));
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    b.root.add(inst);
  }
}

// ---- Roadblocks where the highway leaves the arena -------------------------------

function buildRoadblocks(b: MapBuilder): void {
  const zs = [-29.1, -27.5, -25.9, -24.3, -22.7];
  zs.forEach((z, i) => {
    b.place('concrete_barrier', HALF - 2.2 + (i % 2) * 0.25, z, { rotY: Math.PI / 2 + (i - 2) * 0.04 });
    // The west block has been shoved aside.
    const knocked = i === 2;
    b.place('concrete_barrier', -HALF + 2.2 + (knocked ? 1.6 : (i % 2) * 0.3), z + (knocked ? 0.6 : 0), { rotY: knocked ? 0.5 : Math.PI / 2 - (i - 2) * 0.05 });
  });
  b.place('barrel_hazard', HALF - 3.6, -21.9, { rotY: 0.4 });
  b.place('barrel_hazard', -HALF + 3.8, -28.9, { rotY: 1.3 });
  b.place('barrel_blue', -HALF + 4.4, -29.4, { rotY: 2 });
}

// ---- Roadside pylon sign ---------------------------------------------------------

function buildPylonSign(b: MapBuilder): void {
  const x = -15;
  const z = -19.4;
  const steel = b.assets.pbr('green_metal_rust', { noAlbedo: true, color: 0x55585e, normalScale: 0.6 });
  const base = b.assets.pbr('concrete_floor_worn_001', { color: 0x8a8a8a });
  b.box(2.8, 0.6, 1.1, base, x, 0, z, { tile: 1 });
  for (const dx of [-1, 1]) b.box(0.32, 7.6, 0.32, steel, x + dx, 0.6, z, { tile: 1 });

  const faces = pylonSignTextures();
  const face = new MeshStandardMaterial({ map: faces.map, emissiveMap: faces.emissive, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.55 });
  const cabinet = new Mesh(new BoxGeometry(4.6, 3.24, 0.5), [steel, steel, steel, steel, face, face]);
  cabinet.position.set(x, 9.6, z);
  cabinet.rotation.y = 0.3;
  b.register(cabinet, { collide: false });
  b.flicker(b.pointLight(0xff5a3c, 30, 16, x, 7.6, z + 1.4), 0.7, [face]);
}

// ---- Power line receding into the fog ----------------------------------------------

function buildPowerLine(b: MapBuilder): void {
  const wood = new MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.9 });
  const wire = new MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
  const z = -33;
  const tops: Vector3[][] = [[], [], []];
  for (let x = -120; x <= 120; x += 32) {
    const pole = new Group();
    const shaft = new Mesh(new CylinderGeometry(0.12, 0.17, 9, 8), wood);
    shaft.position.y = 4.5;
    const arm = new Mesh(new BoxGeometry(2.2, 0.12, 0.12), wood);
    arm.position.y = 8.3;
    pole.add(shaft, arm);
    pole.position.set(x, 0, z);
    pole.rotation.y = (Math.sin(x) * 0.05);
    b.register(pole, { collide: false });
    [-0.95, 0, 0.95].forEach((dx, i) => tops[i].push(new Vector3(x + dx, i === 1 ? 8.7 : 8.4, z)));
  }
  for (const line of tops) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const c = line[i + 1];
      const mid = a.clone().lerp(c, 0.5);
      mid.y -= 1.1;
      const curve = new CatmullRomCurve3([a, a.clone().lerp(mid, 0.6).setY(a.y - 0.7), mid, c.clone().lerp(mid, 0.6).setY(c.y - 0.7), c]);
      b.root.add(new Mesh(new TubeGeometry(curve, 16, 0.018, 4, false), wire));
    }
  }
}

// ---- Lighting pole with a sodium flood head ------------------------------------------

function buildLotLight(b: MapBuilder, x: number, z: number): void {
  const steel = b.assets.pbr('green_metal_rust', { noAlbedo: true, color: 0x6b6e73, normalScale: 0.5 });
  b.box(0.22, 7, 0.22, steel, x, 0, z, { tile: 1 });
  b.box(1.4, 0.14, 0.18, steel, x + 0.6, 6.9, z, { collide: false, tile: 1 });
  b.place('security_light', x + 1.2, z, { y: 6.45, rotY: -Math.PI / 2, collide: false });
  const light = b.spotLight(0xffa860, 80, 26, 0.85, x + 1.2, 6.4, z, x + 4, z - 3);
  b.flicker(light, 0.15);
}

// ---- Vehicles, clutter -----------------------------------------------------------------

function buildProps(b: MapBuilder): void {
  // Covered, long-abandoned cars.
  b.place('covered_car', -12.8, -0.8, { rotY: 0.08 });
  b.place('covered_car', -11.4, -15.6, { rotY: 0.35 });
  b.place('covered_car', 14.2, -1.2, { rotY: Math.PI / 2 + 0.07 });
  b.place('covered_car', 6.5, ROAD.z + 1.2, { rotY: Math.PI / 2 - 0.2 });

  // Barrels and junk around the canopy edge.
  b.place('barrel_hazard', -9.6, -3.6, { rotY: 0.3 });
  b.place('barrel_blue', -8.9, -2.7, { rotY: 1.2 });
  b.place('barrel_blue', 9.2, -12.6, { rotY: 2.2 });
  b.place('hydrant', -4.2, -20.2, { pickX: [0, 1], rotY: Math.PI });
  b.place('manhole', 4.2, -1.8, { collide: false });
  b.place('manhole', -6.5, 19.5, { collide: false });

  // Tyre stacks.
  for (const [sx, sz, n] of [[-5, 19.4, 4], [16.5, 14, 3], [-21, -10, 2]] as const) {
    for (let i = 0; i < n; i++) {
      const tyre = b.assets.model('tyre');
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(sx + (i % 2) * 0.06, 0.08 + i * 0.165, sz - 0.3);
      b.register(tyre, { collide: false });
    }
    b.collision.add({ minX: sx - 0.35, maxX: sx + 0.35, minY: 0, maxY: n * 0.165, minZ: sz - 0.35, maxZ: sz + 0.35 });
  }

  for (const [x, z, r] of [[-11, 16.5, 0.4], [-10.4, 17, 2], [12.8, -8, 1], [-3.8, 17.6, 0.2]]) b.place('trashbag', x, z, { rotY: r, collide: false });
  for (const [x, z, r] of [[-10.8, 15.8, 0.3], [6.4, 4.2, 1.2], [6.9, 3.8, 0.4]]) b.place('cardboard_box', x, z, { rotY: r, collide: false });
}

// ---- Burn barrel: the warm light source on the west side --------------------------------

function buildBurnBarrel(b: MapBuilder, x: number, z: number): (dt: number) => void {
  b.place('barrel_blue', x, z);
  const flames: Sprite[] = [];
  const tex = glowTexture('rgba(255,220,140,1)', 'rgba(255,90,20,0.6)');
  for (let i = 0; i < 3; i++) {
    const s = new Sprite(new SpriteMaterial({ map: tex, blending: AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.set(x, 1.05 + i * 0.22, z);
    b.root.add(s);
    flames.push(s);
  }
  // Ember glow disc inside the rim.
  const embers = new Mesh(new PlaneGeometry(0.5, 0.5), new MeshStandardMaterial({ color: 0x220800, emissive: 0xff5a10, emissiveIntensity: 2 }));
  embers.rotation.x = -Math.PI / 2;
  embers.position.set(x, 0.9, z);
  b.root.add(embers);
  const light = b.pointLight(0xff7a2a, 26, 15, x, 1.6, z);
  let t = 0;
  return (dt: number) => {
    t += dt;
    flames.forEach((s, i) => {
      const k = 0.75 + 0.25 * Math.sin(t * (9 + i * 3) + i) + Math.random() * 0.12;
      s.scale.set(0.7 * k - i * 0.12, (1.0 - i * 0.2) * k, 1);
      s.position.y = 1.05 + i * 0.22 + Math.sin(t * 7 + i) * 0.03;
    });
    light.intensity = 26 * (0.8 + 0.2 * Math.sin(t * 13) + Math.random() * 0.1);
  };
}
