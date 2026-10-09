import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MapBuilder } from '../MapBuilder';
import { canopyBrandTextures, pumpDisplayTexture, weatheredPaintTexture } from '../textures';

export const CANOPY = { z: -8, width: 17, depth: 11, height: 5 };

let paintTex: ReturnType<typeof weatheredPaintTexture> | null = null;
/** Shared weathering overlay for painted steel. */
function paint(): ReturnType<typeof weatheredPaintTexture> {
  paintTex ??= weatheredPaintTexture(11);
  return paintTex;
}

/** Fuel canopy: columns, damaged fascia with lit branding, soffit lights, pump islands. */
export function buildCanopy(b: MapBuilder): void {
  const a = b.assets;
  const { z: cz, width: W, depth: D, height: H } = CANOPY;
  const steel = a.pbr('green_metal_rust', { albedo: paint(), color: 0xd9d6cf, normalScale: 0.5, repeat: [0.5, 2] });
  const hazard = a.pbr('green_metal_rust', { albedo: paint(), color: 0xc79a12, normalScale: 0.7 });
  const footing = a.pbr('concrete_floor_worn_001', { color: 0x8c8c8c });

  for (const x of [-6, 6]) {
    for (const z of [cz - 3, cz + 3]) {
      b.box(0.9, 0.45, 0.9, footing, x, 0, z, { tile: 1 });
      b.box(0.42, H - 0.45, 0.42, steel, x, 0.45, z, { tile: 1 });
      b.box(0.46, 0.9, 0.46, hazard, x, 0.45, z, { collide: false, tile: 1 });
    }
  }

  // Soffit (underside), roof deck and fascia. Box face order: +x, -x, +y, -y, +z, -z.
  const soffit = a.pbr('painted_metal_shutter', { color: 0x9b9d9f, repeat: [1, 1] });
  const deck = a.pbr('corrugated_iron_02', { color: 0x3a3c40 });
  b.box(W, 0.12, D, [deck, deck, deck, soffit, deck, deck], 0, H, cz, { collide: false, blocksBullets: true, tile: 1.6 });

  const fascia = a.pbr('corrugated_iron_02', { color: 0xe4e0d6 });
  const red = a.pbr('green_metal_rust', { albedo: paint(), color: 0x8f1d15, normalScale: 0.6 });
  const fH = 1.15;
  const fY = H - 0.25;
  const front = cz - D / 2;
  const back = cz + D / 2;
  const opts = { collide: false, blocksBullets: true, tile: 1.2 } as const;
  b.box(W + 0.3, fH, 0.15, fascia, 0, fY, front - 0.075, opts);
  b.box(0.15, fH, D, fascia, -W / 2 - 0.075, fY, cz, opts);
  b.box(0.15, fH, D, fascia, W / 2 + 0.075, fY, cz, opts);
  // Store-facing fascia has a torn-off section; one panel hangs from its top edge.
  b.box(W / 2 + 3 + 0.15, fH, 0.15, fascia, (-W / 2 - 0.15 + 3) / 2, fY, back + 0.075, opts);
  b.box(W / 2 - 6 + 0.15, fH, 0.15, fascia, (6 + W / 2 + 0.15) / 2, fY, back + 0.075, opts);
  const hanging = new Group();
  hanging.position.set(4.5, fY + fH, back + 0.12);
  hanging.rotation.set(0.75, 0, 0.18);
  const panel = new Mesh(new BoxGeometry(2.9, fH, 0.08), fascia);
  panel.position.y = -fH / 2;
  hanging.add(panel);
  b.register(hanging, { collide: false });

  // Red accent band along the fascia's lower edge.
  b.box(W + 0.36, 0.22, 0.2, red, 0, fY, front - 0.08, { ...opts, tile: 1 });
  b.box(0.2, 0.22, D + 0.36, red, -W / 2 - 0.08, fY, cz, { ...opts, tile: 1 });
  b.box(0.2, 0.22, D + 0.36, red, W / 2 + 0.08, fY, cz, { ...opts, tile: 1 });

  // Backlit brand lettering (one letter dead) on the road and store sides.
  const brand = canopyBrandTextures();
  const brandMat = new MeshStandardMaterial({ map: brand.map, emissiveMap: brand.emissive, emissive: 0xffffff, emissiveIntensity: 2.4, roughness: 0.6 });
  for (const [z, rot] of [[front - 0.16, Math.PI], [back + 0.16, 0]] as const) {
    const sign = new Mesh(new PlaneGeometry(7.8, 0.98), brandMat);
    sign.position.set(z === front - 0.16 ? 0 : -3.2, fY + fH / 2 + 0.08, z);
    sign.rotation.y = rot;
    b.root.add(sign);
  }

  // Recessed light panels: two are dead, one row flickers with its light.
  const lit = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d4, emissiveIntensity: 2.2 });
  const flickerPanel = lit.clone();
  const dead = new MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4 });
  const panels: [number, number, Material][] = [
    [-5, cz - 2.4, lit], [0, cz - 2.4, dead], [5, cz - 2.4, lit],
    [-5, cz + 2.4, flickerPanel], [0, cz + 2.4, lit], [5, cz + 2.4, dead],
  ];
  for (const [x, z, mat] of panels) {
    const p = new Mesh(new PlaneGeometry(2.2, 0.7), mat);
    p.rotation.x = Math.PI / 2;
    p.position.set(x, H - 0.005, z);
    b.root.add(p);
  }
  const left = b.spotLight(0xffe6c4, 140, 24, 1.1, -3.6, H - 0.15, cz - 0.5, -3.6, cz - 0.5);
  b.spotLight(0xffe6c4, 140, 24, 1.1, 3.6, H - 0.15, cz + 0.5, 3.6, cz + 0.5);
  b.flicker(left, 0.5, [flickerPanel, brandMat]);

  // Pump islands.
  const island = a.pbr('concrete_floor_worn_001', { color: 0xa5a5a5 });
  for (const x of [-3, 3]) {
    b.box(1.5, 0.2, 7, island, x, 0, cz, { collide: false, tile: 1.2 });
    buildPump(b, x, cz - 1.6, x < 0);
    buildPump(b, x, cz + 1.6, x > 0);
    for (const z of [cz - 3.25, cz + 3.25]) bollard(b, x, z, hazard);
  }
}

const pumpShared = {
  liveDisplay: null as Material | null,
  deadDisplay: null as Material | null,
  rubber: new MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.55 }),
  nozzle: new MeshStandardMaterial({ color: 0x23262b, roughness: 0.35, metalness: 0.8 }),
};

/** A worn, two-sided fuel dispenser. Faces ±X (the driving lanes). */
function buildPump(b: MapBuilder, x: number, z: number, dead: boolean): void {
  const a = b.assets;
  const body = a.pbr('green_metal_rust', { albedo: paint(), color: 0xd8d2c4, normalScale: 0.55 });
  const head = a.pbr('green_metal_rust', { albedo: paint(), color: 0x9b231a, normalScale: 0.6 });
  const plinth = a.pbr('concrete_floor_worn_001', { color: 0x6f6f6f });
  pumpShared.liveDisplay ??= new MeshStandardMaterial({ map: pumpDisplayTexture(false), emissiveMap: pumpDisplayTexture(false), emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.2 });
  pumpShared.deadDisplay ??= new MeshStandardMaterial({ map: pumpDisplayTexture(true), roughness: 0.15 });

  const g = new Group();
  g.position.set(x, 0.2, z);
  const add = (mesh: Mesh, px: number, py: number, pz: number): Mesh => {
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  add(new Mesh(new BoxGeometry(0.78, 0.12, 1.2), plinth), 0, 0.06, 0);
  add(new Mesh(new RoundedBoxGeometry(0.62, 1.15, 1.02, 3, 0.04), body), 0, 0.12 + 0.575, 0);
  add(new Mesh(new BoxGeometry(0.64, 0.16, 1.04), head), 0, 0.82, 0);
  add(new Mesh(new RoundedBoxGeometry(0.68, 0.56, 1.08, 3, 0.05), head), 0, 1.27 + 0.28, 0);
  add(new Mesh(new RoundedBoxGeometry(0.5, 0.06, 0.9, 2, 0.02), body), 0, 1.86, 0);

  for (const side of [-1, 1]) {
    const display = new Mesh(new PlaneGeometry(0.62, 0.36), dead ? pumpShared.deadDisplay : pumpShared.liveDisplay);
    display.rotation.y = side * Math.PI / 2;
    add(display, side * 0.345, 1.55, 0);

    // Nozzle holster, nozzle and a hose that droops towards the ground.
    const sx = side * 0.33;
    add(new Mesh(new BoxGeometry(0.08, 0.16, 0.14), pumpShared.nozzle), sx + side * 0.03, 0.95, 0.28);
    const nozzle = add(new Mesh(new CylinderGeometry(0.025, 0.03, 0.26, 8), pumpShared.nozzle), sx + side * 0.07, 0.92, 0.28);
    nozzle.rotation.z = side * 0.5;
    const hose = new CatmullRomCurve3([
      new Vector3(sx + side * 0.02, 1.25, -0.35),
      new Vector3(sx + side * 0.22, 0.75, -0.4),
      new Vector3(sx + side * 0.3, 0.22, -0.05),
      new Vector3(sx + side * 0.24, 0.3, 0.3),
      new Vector3(sx + side * 0.09, 0.8, 0.3),
    ]);
    add(new Mesh(new TubeGeometry(hose, 28, 0.022, 6, false), pumpShared.rubber), 0, 0, 0);
  }
  b.register(g);
}

function bollard(b: MapBuilder, x: number, z: number, mat: Material): void {
  const g = new Group();
  const post = new Mesh(new CylinderGeometry(0.11, 0.11, 1.0, 14), mat);
  post.position.y = 0.7;
  const cap = new Mesh(new SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  cap.position.y = 1.2;
  g.add(post, cap);
  g.position.set(x, 0, z);
  b.register(g);
}
