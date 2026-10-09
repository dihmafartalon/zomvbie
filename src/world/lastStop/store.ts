import { BoxGeometry, Group, type Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { getWeapon, type WeaponId } from '../../weapons/WeaponDefs';
import type { WallBuySpot } from '../GameMap';
import type { MapBuilder } from '../MapBuilder';
import { chalkTexture, type NoticeKind, noticeTexture, storeSignTextures, weatheredPaintTexture } from '../textures';

/** Store footprint. Gameplay (nav nodes, wall-buys) depends on these values. */
export const STORE = { minX: -8, maxX: 8, minZ: 5, maxZ: 15, height: 4.2, wall: 0.25, doorHalf: 1.2, doorHeight: 2.6 };

/** Convenience store shell, interior dressing, signage, exterior clutter and wall-buys. */
export function buildStore(b: MapBuilder, wallBuys: WallBuySpot[]): void {
  const a = b.assets;
  const { minX, maxX, minZ, maxZ, height: H, wall: T, doorHalf, doorHeight } = STORE;
  const brick = a.pbr('painted_worn_brick', { color: 0xc8c2b4 });
  const plaster = a.pbr('painted_worn_brick', { color: 0xaebdb0 });
  // Box face order: +x, -x, +y, -y, +z, -z. Exterior face gets brick, interior plaster.
  const faces = (exterior: number): Material[] => [0, 1, 2, 3, 4, 5].map((i) => (i === exterior ? brick : i === 2 || i === 3 ? brick : plaster));
  const nav = { nav: true, tile: 2.4 };

  // Front wall with doorway (exterior faces -Z).
  b.box(-doorHalf - minX, H, T, faces(5), (minX - doorHalf) / 2, 0, minZ + T / 2, nav);
  b.box(maxX - doorHalf, H, T, faces(5), (maxX + doorHalf) / 2, 0, minZ + T / 2, nav);
  b.box(doorHalf * 2, H - doorHeight, T, faces(5), 0, doorHeight, minZ + T / 2, { tile: 2.4 });
  b.box(maxX - minX, H, T, faces(4), 0, 0, maxZ - T / 2, nav);
  b.box(T, H, maxZ - minZ - 2 * T, faces(1), minX + T / 2, 0, (minZ + maxZ) / 2, nav);
  b.box(T, H, maxZ - minZ - 2 * T, faces(0), maxX - T / 2, 0, (minZ + maxZ) / 2, nav);

  // Flat roof with concrete parapet cap and plaster ceiling.
  const roof = a.pbr('corrugated_iron_02', { color: 0x2c2d30 });
  const cap = a.pbr('dirty_concrete', { color: 0x8a8a86 });
  const ceiling = a.pbr('plastered_wall_05', { color: 0x5d625b });
  b.box(maxX - minX, 0.3, maxZ - minZ, [roof, roof, roof, ceiling, roof, roof], 0, H, (minZ + maxZ) / 2, { collide: false, blocksBullets: true, tile: 2 });
  for (const [w, d, x, z] of [
    [maxX - minX + 0.3, 0.3, 0, minZ], [maxX - minX + 0.3, 0.3, 0, maxZ],
    [0.3, maxZ - minZ, minX, (minZ + maxZ) / 2], [0.3, maxZ - minZ, maxX, (minZ + maxZ) / 2],
  ]) {
    b.box(w, 0.45, d, cap, x, H + 0.15, z, { collide: false, blocksBullets: true, tile: 1.5 });
  }

  // Aluminium door frame and the glass door hanging open.
  const alu = new MeshStandardMaterial({ color: 0x8d9296, roughness: 0.35, metalness: 0.9 });
  for (const x of [-doorHalf - 0.05, doorHalf + 0.05]) b.box(0.1, doorHeight, 0.32, alu, x, 0, minZ + T / 2, { collide: false });
  b.box(doorHalf * 2 + 0.2, 0.1, 0.32, alu, 0, doorHeight - 0.1, minZ + T / 2, { collide: false });
  const door = new Group();
  door.position.set(-doorHalf, 0.02, minZ - 0.02);
  door.rotation.y = -1.25;
  const frame = new Mesh(new BoxGeometry(1.15, 2.5, 0.05), alu);
  frame.position.set(0.575, 1.25, 0);
  const glass = new Mesh(new PlaneGeometry(0.95, 2.2), new MeshStandardMaterial({ color: 0x0d1a1c, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 }));
  glass.position.set(0.575, 1.25, 0.03);
  door.add(frame, glass);
  b.register(door, { collide: false });

  // Shuttered front windows (one tagged), rear service shutter.
  b.place('shutter_window', -4.75, minZ - 0.2, { pickX: [-1, 1], rotY: Math.PI, y: 0.45, scale: 1.35, collide: false });
  b.place('shutter_window', 4.75, minZ - 0.2, { pickX: [2, 4], rotY: Math.PI, y: 0.45, scale: 1.35, collide: false });
  b.place('shutter_door', 3.8, maxZ + 0.18, { pickX: [-1, 1], scale: 1.2, collide: false });

  // Box sign over the door: dead letters, flickers with the interior light.
  const sign = storeSignTextures();
  const signFace = new MeshStandardMaterial({ map: sign.map, emissiveMap: sign.emissive, emissive: 0xffffff, emissiveIntensity: 2, roughness: 0.5 });
  const signSide = new MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.6, metalness: 0.5 });
  const signBox = new Mesh(new BoxGeometry(7.4, 0.95, 0.3), [signSide, signSide, signSide, signSide, signSide, signFace]);
  signBox.position.set(0, 3.45, minZ - 0.16);
  b.register(signBox, { collide: false });

  // Sodium security lights on the front corners, washing the forecourt.
  for (const x of [-7.3, 7.3]) {
    b.place('security_light', x, minZ - 0.22, { y: 3.05, rotY: Math.PI, collide: false });
    b.spotLight(0xffb169, 70, 26, 0.95, x, 3.05, minZ - 0.6, x * 0.6, -3);
  }

  // ---- Interior --------------------------------------------------------------
  const linoleum = a.pbr('old_linoleum_flooring_01', { color: 0x9a9a92 });
  b.floor(maxX - minX - 2 * T, maxZ - minZ - 2 * T, linoleum, 0, 0.015, (minZ + maxZ) / 2, 1.1);

  // Two aisles of steel shelving; one unit toppled against its neighbour.
  for (const z of [9.6, 12.2]) {
    for (const [i, x] of [-6.2, -5.05, -3.9, -2.75].entries()) {
      if (z === 12.2 && i === 3) continue;
      b.place('shelves', x, z, { rotY: Math.PI });
      if ((i + z) % 2 < 1) b.place('cardboard_box', x + 0.15, z, { y: 0.6, rotY: i, collide: false, blocksBullets: false, castShadow: false });
    }
  }
  const toppled = b.assets.model('shelves');
  // Lying flat across the end of the aisle.
  toppled.position.set(-2.1, 0.55, 12.5);
  toppled.rotation.set(0, 0.3, -Math.PI / 2);
  b.register(toppled);

  // Counter with register.
  const counterBody = a.pbr('green_metal_rust', { albedo: weatheredPaintTexture(12), color: 0x6a5240, normalScale: 0.5 });
  const counterTop = new MeshStandardMaterial({ color: 0x24262a, roughness: 0.45 });
  b.box(4, 1.0, 0.9, counterBody, 5, 0, 7.6, { tile: 1 });
  b.box(4.1, 0.05, 1.0, counterTop, 5, 1.0, 7.6, { collide: false });
  b.place('cash_register', 4.3, 7.6, { y: 1.05, rotY: Math.PI, collide: false });

  // Drinks fridges glowing along the back wall.
  const fridgeBody = a.pbr('green_metal_rust', { albedo: weatheredPaintTexture(13), color: 0xd8d8d4, normalScale: 0.4 });
  const fridgeGlass = new MeshStandardMaterial({ color: 0x0b1416, emissive: 0x58b8e8, emissiveIntensity: 0.38, roughness: 0.1 });
  b.box(5, 2.2, 0.7, fridgeBody, 4.8, 0, maxZ - T - 0.35, { tile: 1 });
  for (let i = 0; i < 3; i++) {
    const glassDoor = new Mesh(new PlaneGeometry(1.45, 1.85), fridgeGlass);
    glassDoor.position.set(3.15 + i * 1.65, 1.1, maxZ - T - 0.71);
    glassDoor.rotation.y = Math.PI;
    b.root.add(glassDoor);
  }

  // Ceiling fluorescents; the interior light flickers with them.
  const tube = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xdcffe9, emissiveIntensity: 1.8 });
  for (const [x, z] of [[-4, 8], [3, 10.5], [-4, 13]]) {
    b.place('fluorescent', x, z, { y: H - 0.06, collide: false, castShadow: false });
    const glow = new Mesh(new PlaneGeometry(0.8, 0.5), tube);
    glow.rotation.x = Math.PI / 2;
    glow.position.set(x, H - 0.07, z);
    b.root.add(glow);
  }
  b.flicker(b.pointLight(0xdcffe9, 50, 18, -1, H - 0.5, 10), 1.4, [tube, signFace]);
  b.pointLight(0xdcffe9, 18, 12, 4.5, H - 0.6, 8.5);

  // Floor clutter.
  b.place('wet_floor_sign', 1.9, 6.3, { rotY: 0.6, collide: false });
  b.place('trashbag', 7, 13.8, { collide: false });
  b.place('trashbag', 6.4, 13.9, { rotY: 2, collide: false });
  b.place('cardboard_box', -6.8, 7, { rotY: 0.4, collide: false });
  b.place('cardboard_box', -6.3, 6.6, { rotY: 1.1, collide: false });

  // Notices and graffiti: who was here, and what happened.
  const notices: [NoticeKind, number, number, number, number, number][] = [
    ['evacuation', 1.75, 1.6, minZ - 0.02, Math.PI, 0.7],
    ['missing', 2.35, 1.45, minZ - 0.02, Math.PI, 0.55],
    ['evacuation', minX + T + 0.02, 1.7, 8, Math.PI / 2, 0.7],
    ['missing', 1.2, 1.6, maxZ - T - 0.02, Math.PI, 0.55],
    ['missing', 1.85, 1.35, maxZ - T - 0.02, Math.PI, 0.55],
    ['warning', maxX - T - 0.02, 2.4, 11, -Math.PI / 2, 2.2],
  ];
  notices.forEach(([kind, x, y, z, rot, w], i) => {
    const m = new Mesh(
      new PlaneGeometry(w, w * 1.33),
      new MeshStandardMaterial({ map: noticeTexture(kind, 50 + i), transparent: kind === 'warning', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }),
    );
    m.position.set(x, y, z);
    m.rotation.set(0, rot, (i % 2 ? 1 : -1) * 0.04);
    b.root.add(m);
  });

  // ---- Exterior service side -----------------------------------------------------
  b.place('utility_box', maxX + 0.3, 9, { rotY: Math.PI / 2 });
  b.place('aircon', maxX + 0.3, 11.6, { pickX: [-2, 0], rotY: Math.PI / 2 });
  b.place('aircon', maxX + 0.3, 13.4, { pickX: [0, 2], rotY: Math.PI / 2 });
  b.place('trash_can', 10.4, 12.4, { pickX: [0, 2] });
  b.place('trash_can', 10.2, 13.3, { pickX: [-2, 0], rotY: 0.5 });
  for (const [x, z, r] of [[10.9, 14.2, 0], [11.3, 13.4, 1.4], [10.2, 14.6, 2.6]]) b.place('trashbag', x, z, { rotY: r, collide: false });
  for (const [x, z] of [[9.0, 6.2], [9.4, 6.7], [8.9, 7.1]]) b.place('propane_tank', x, z);
  b.place('generator', 1.5, maxZ + 2.8, { rotY: 0.3 });
  b.place('trash_can', 3.1, minZ - 0.6, { pickX: [-2, 0], rotY: 0.2 });

  // ---- Chalk wall-buys ---------------------------------------------------------------
  addWallBuy(b, wallBuys, 'vex', new Vector3(-2.65, 1.6, minZ - 0.03), Math.PI, new Vector3(-2.65, 0, minZ - 0.8));
  addWallBuy(b, wallBuys, 'breacher', new Vector3(-0.6, 1.7, maxZ - T - 0.02), Math.PI, new Vector3(-0.6, 0, maxZ - 1.0));
  addWallBuy(b, wallBuys, 'longwatch', new Vector3(minX - 0.03, 1.6, 10), -Math.PI / 2, new Vector3(minX - 0.8, 0, 10));
}

function addWallBuy(b: MapBuilder, wallBuys: WallBuySpot[], weaponId: WeaponId, at: Vector3, rotY: number, standAt: Vector3): void {
  const def = getWeapon(weaponId);
  const mat = new MeshBasicMaterial({ map: chalkTexture(def.name, def.price, def.model), transparent: true, depthWrite: false, color: 0xc4c8cc });
  const mesh = new Mesh(new PlaneGeometry(1.7, 0.85), mat);
  // Sit the chalk 1 cm proud of its backing board (both face along the wall normal).
  mesh.position.copy(at).add(new Vector3(Math.sin(rotY), 0, Math.cos(rotY)).multiplyScalar(0.01));
  mesh.rotation.y = rotY;
  // Dark slate backing so the chalk reads on any wall.
  const board = new Mesh(
    new PlaneGeometry(1.95, 1.1),
    new MeshStandardMaterial({ color: 0x1a1d1c, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 }),
  );
  board.position.copy(at);
  board.rotation.y = rotY;
  b.root.add(board, mesh);
  wallBuys.push({ weaponId, position: standAt });
}
