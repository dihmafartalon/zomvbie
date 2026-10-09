import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  type Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { getWeapon, type WeaponId } from '../weapons/WeaponDefs';
import { CollisionWorld } from './Collision';
import type { GameMap, WallBuySpot } from './GameMap';
import { NavGraph } from './NavGraph';
import * as tex from './textures';

interface BoxOpts {
  /** Adds an AABB collider (default true). */
  collide?: boolean;
  /** Participates in zombie path-finding as a large obstacle. */
  nav?: boolean;
  /** Stops bullets (defaults to `collide`). */
  blocksBullets?: boolean;
  castShadow?: boolean;
  rotY?: number;
  parent?: Object3D;
}

interface Flicker {
  light: PointLight;
  base: number;
  emissive?: MeshStandardMaterial;
  emissiveBase: number;
  /** Chance per second of a flicker event. */
  rate: number;
  level: number;
  dropTimer: number;
}

const HALF = 30; // Playable area is [-HALF, HALF] on X and Z.

/**
 * Map 1 — "Last Stop Fuel": an abandoned roadside gas station at night.
 * Pump canopy to the north, enterable convenience store to the south, a road
 * along the north fence, wrecks and props scattered around.
 */
export class GasStationMap implements GameMap {
  readonly name = 'Last Stop Fuel';
  readonly root = new Group();
  readonly collision = new CollisionWorld();
  readonly nav: NavGraph;
  readonly bulletBlockers: Object3D[] = [];
  readonly zombieSpawns: Vector3[] = [];
  readonly playerSpawn = { position: new Vector3(0, 0, 1.5), yaw: 0 };
  readonly wallBuys: WallBuySpot[] = [];
  readonly menuCamera = { target: new Vector3(0, 1.5, -2), radius: 22, height: 7 };

  private readonly flickers: Flicker[] = [];
  private readonly moon: DirectionalLight;

  private readonly m = {
    wall: new MeshStandardMaterial({ map: tex.wallTexture(2, 1), roughness: 0.95 }),
    concrete: new MeshStandardMaterial({ map: tex.concreteTexture(2), roughness: 0.95 }),
    metal: new MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.6, metalness: 0.6 }),
    rust: new MeshStandardMaterial({ color: 0x5b3420, roughness: 0.9, metalness: 0.3 }),
    darkTrim: new MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.8 }),
    white: new MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.7 }),
    red: new MeshStandardMaterial({ color: 0x8e1d17, roughness: 0.6 }),
    wood: new MeshStandardMaterial({ color: 0x4d3522, roughness: 0.95 }),
    glass: new MeshStandardMaterial({ color: 0x0b1712, emissive: 0x16352a, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.4 }),
    tire: new MeshStandardMaterial({ color: 0x111111, roughness: 0.95 }),
  };

  constructor(scene: Scene) {
    scene.background = new Color(0x070a12);
    scene.fog = new FogExp2(0x070a12, 0.032);

    this.moon = this.buildLighting();
    this.buildGround();
    this.buildCanopy();
    this.buildStore();
    this.buildProps();
    this.buildRoadSign();
    this.buildLampPost();
    this.buildFence();
    this.buildTrees();
    this.buildSky();
    this.defineSpawns();

    // Nav nodes ring the store (the only large obstacle) and its doorway.
    this.nav = new NavGraph(this.collision, [
      { x: -9.4, z: 3.7 },
      { x: 9.4, z: 3.7 },
      { x: -9.4, z: 16.3 },
      { x: 9.4, z: 16.3 },
      { x: 0, z: 3.4 },
      { x: 0, z: 6.6 },
      { x: -5, z: 10.8 },
      { x: 5, z: 11 },
    ]);

    scene.add(this.root);
  }

  update(dt: number): void {
    for (const f of this.flickers) {
      if (f.dropTimer > 0) {
        f.dropTimer -= dt;
      } else if (Math.random() < f.rate * dt) {
        f.dropTimer = 0.04 + Math.random() * 0.18;
      }
      const target = f.dropTimer > 0 ? 0.08 + Math.random() * 0.25 : 1;
      f.level += (target - f.level) * Math.min(1, dt * 30);
      f.light.intensity = f.base * f.level;
      if (f.emissive) f.emissive.emissiveIntensity = f.emissiveBase * f.level;
    }
  }

  setShadowsEnabled(enabled: boolean): void {
    this.moon.castShadow = enabled;
  }

  // ---- Builders ----------------------------------------------------------------

  /** Box whose bottom sits at `y`. */
  private box(w: number, h: number, d: number, mat: Material | Material[], x: number, y: number, z: number, opts: BoxOpts = {}): Mesh {
    const mesh = new Mesh(new BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = true;
    (opts.parent ?? this.root).add(mesh);
    const collide = opts.collide ?? true;
    if (collide) this.collision.addObject(mesh, opts.nav ?? false);
    if (opts.blocksBullets ?? collide) this.bulletBlockers.push(mesh);
    return mesh;
  }

  private plane(w: number, d: number, mat: Material, x: number, y: number, z: number, rotY = 0): Mesh {
    const mesh = new Mesh(new PlaneGeometry(w, d), mat);
    mesh.rotation.set(-Math.PI / 2, 0, rotY);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  private addFlicker(light: PointLight, rate: number, emissive?: MeshStandardMaterial): void {
    this.flickers.push({
      light,
      base: light.intensity,
      emissive,
      emissiveBase: emissive?.emissiveIntensity ?? 0,
      rate,
      level: 1,
      dropTimer: 0,
    });
  }

  private pointLight(color: number, intensity: number, distance: number, x: number, y: number, z: number): PointLight {
    const light = new PointLight(color, intensity, distance, 1.6);
    light.position.set(x, y, z);
    this.root.add(light);
    return light;
  }

  private buildLighting(): DirectionalLight {
    this.root.add(new HemisphereLight(0x5a6a96, 0x121216, 0.7));

    const moon = new DirectionalLight(0x9fb3ff, 0.85);
    moon.position.set(-40, 60, -55);
    moon.target.position.set(0, 0, 0);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const cam = moon.shadow.camera;
    cam.left = -45;
    cam.right = 45;
    cam.top = 45;
    cam.bottom = -45;
    cam.near = 1;
    cam.far = 200;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.03;
    this.root.add(moon, moon.target);
    return moon;
  }

  private buildGround(): void {
    const dirt = new MeshStandardMaterial({ map: tex.dirtTexture(50), roughness: 1 });
    this.plane(220, 220, dirt, 0, 0, 0);

    const lot = new MeshStandardMaterial({ map: tex.asphaltTexture(10), roughness: 0.92 });
    this.plane(HALF * 2, HALF * 2 - 9, lot, 0, 0.01, 4.5);

    const road = new MeshStandardMaterial({ map: tex.asphaltTexture(4), color: 0x9a9a9a, roughness: 0.9 });
    const roadMesh = this.plane(220, 9, road, 0, 0.012, -25.5);
    (roadMesh.material as MeshStandardMaterial).map?.repeat.set(30, 1.3);

    const yellow = new MeshStandardMaterial({ color: 0x9c8420, roughness: 0.8 });
    for (let x = -100; x < 100; x += 6) this.plane(3, 0.18, yellow, x, 0.02, -25.5);

    // Parking stripes in front of the store.
    const paint = new MeshStandardMaterial({ color: 0x8c8c86, roughness: 0.85 });
    for (let x = -12; x <= 12; x += 3) {
      if (Math.abs(x) < 2) continue;
      this.plane(0.12, 4.5, paint, x, 0.02, 1.2);
    }
  }

  private buildCanopy(): void {
    const cz = -8;
    for (const [x, z] of [[-6, cz - 3], [6, cz - 3], [-6, cz + 3], [6, cz + 3]]) {
      this.box(0.55, 4.6, 0.55, this.m.white, x, 0, z);
    }
    const panel = new MeshStandardMaterial({ color: 0xdedcd2, emissive: 0xfff2d0, emissiveIntensity: 0.9 });
    const underside = new MeshStandardMaterial({ color: 0x9ea2a8, roughness: 0.8 });
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
    this.box(16, 0.7, 10, [this.m.red, this.m.red, this.m.darkTrim, underside, this.m.red, this.m.red], 0, 4.6, cz, {
      collide: false,
      blocksBullets: true,
    });
    for (const x of [-3.5, 3.5]) {
      const p = new Mesh(new PlaneGeometry(2.6, 1.2), panel);
      p.rotation.x = Math.PI / 2;
      p.position.set(x, 4.58, cz);
      this.root.add(p);
    }
    const left = this.pointLight(0xfff1d0, 42, 24, -3.5, 4.2, cz);
    this.pointLight(0xfff1d0, 42, 24, 3.5, 4.2, cz);
    this.addFlicker(left, 0.6, panel);

    // Pump islands and pumps.
    const screen = new MeshStandardMaterial({ color: 0x102018, emissive: 0x3cff9a, emissiveIntensity: 0.35 });
    for (const x of [-3, 3]) {
      this.box(1.3, 0.18, 6, this.m.concrete, x, 0, cz, { collide: false });
      for (const z of [cz - 1.6, cz + 1.6]) {
        const pump = this.box(0.9, 1.75, 0.6, this.m.white, x, 0.18, z);
        const stripe = new Mesh(new BoxGeometry(0.92, 0.22, 0.62), this.m.red);
        stripe.position.y = 0.45;
        pump.add(stripe);
        for (const side of [-1, 1]) {
          const s = new Mesh(new PlaneGeometry(0.5, 0.3), screen);
          s.position.set(0, 0.25, side * 0.305);
          if (side < 0) s.rotation.y = Math.PI;
          pump.add(s);
        }
      }
      // Bollards.
      for (const z of [cz - 3.2, cz + 3.2]) {
        this.box(0.22, 0.9, 0.22, new MeshStandardMaterial({ color: 0xb59a20, roughness: 0.7 }), x, 0.18, z);
      }
    }
  }

  private buildStore(): void {
    const H = 4;
    const T = 0.25;
    const minX = -8;
    const maxX = 8;
    const minZ = 5;
    const maxZ = 15;
    const doorHalf = 1.2;
    const doorH = 2.6;
    const navWall = { nav: true };

    // Front wall with a doorway.
    this.box(-doorHalf - minX, H, T, this.m.wall, (minX - doorHalf) / 2, 0, minZ + T / 2, navWall);
    this.box(maxX - doorHalf, H, T, this.m.wall, (maxX + doorHalf) / 2, 0, minZ + T / 2, navWall);
    this.box(doorHalf * 2, H - doorH, T, this.m.wall, 0, doorH, minZ + T / 2, { nav: false });
    // Back and side walls.
    this.box(maxX - minX, H, T, this.m.wall, 0, 0, maxZ - T / 2, navWall);
    this.box(T, H, maxZ - minZ, this.m.wall, minX + T / 2, 0, (minZ + maxZ) / 2, navWall);
    this.box(T, H, maxZ - minZ, this.m.wall, maxX - T / 2, 0, (minZ + maxZ) / 2, navWall);
    // Roof with an overhang.
    this.box(maxX - minX + 1, 0.35, maxZ - minZ + 1.5, this.m.darkTrim, 0, H, (minZ + maxZ) / 2 - 0.25, { collide: false, blocksBullets: true });

    // Door frame.
    for (const x of [-doorHalf - 0.06, doorHalf + 0.06]) {
      this.box(0.12, doorH, 0.35, this.m.metal, x, 0, minZ + T / 2, { collide: false });
    }

    // Glowing (grimy) windows with boards nailed across.
    for (const cx of [-5.2, 5.2]) {
      const win = new Mesh(new PlaneGeometry(3.2, 1.4), this.m.glass);
      win.position.set(cx, 1.75, minZ - 0.01);
      win.rotation.y = Math.PI;
      this.root.add(win);
      const inner = win.clone();
      inner.position.z = minZ + T + 0.01;
      inner.rotation.y = 0;
      this.root.add(inner);
      for (let i = 0; i < 2; i++) {
        const board = this.box(3.5, 0.22, 0.05, this.m.wood, cx, 1.3 + i * 0.75, minZ - 0.05, { collide: false });
        board.rotation.z = (i ? -1 : 1) * (0.12 + Math.random() * 0.1);
      }
    }

    // Store sign above the door.
    const signTex = tex.storeSignTexture();
    const signMat = new MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25 });
    const sign = new Mesh(new PlaneGeometry(7, 1.1), signMat);
    sign.position.set(0, 3.3, minZ - 0.02);
    sign.rotation.y = Math.PI;
    this.root.add(sign);

    // Interior floor and fittings.
    const tiles = new MeshStandardMaterial({ map: tex.tileTexture(8, 5), roughness: 0.6 });
    this.plane(maxX - minX - 2 * T, maxZ - minZ - 2 * T, tiles, 0, 0.015, (minZ + maxZ) / 2);

    // Counter + register.
    this.box(4, 1.05, 1, this.m.wood, 5, 0, 7.6);
    this.box(0.5, 0.3, 0.4, this.m.darkTrim, 4.2, 1.05, 7.6, { collide: false });
    // Shelving rows with scattered goods.
    const goods = [0x8a2a22, 0x2a5a8a, 0xb89a2a, 0x3a7a3a, 0x7a4a8a].map(
      (c) => new MeshStandardMaterial({ color: c, roughness: 0.7 }),
    );
    for (const z of [9.6, 12.2]) {
      this.box(4.5, 1.7, 0.7, this.m.metal, -4, 0, z);
      for (let i = 0; i < 14; i++) {
        if (Math.random() < 0.35) continue;
        const shelfY = [0.35, 0.95, 1.55][i % 3];
        const item = this.box(0.25, 0.3, 0.25, goods[i % goods.length], -6 + (i / 14) * 4.2, shelfY, z + (Math.random() - 0.5) * 0.3, {
          collide: false,
          blocksBullets: false,
          castShadow: false,
        });
        item.rotation.y = Math.random();
      }
    }
    // Drinks fridges glowing along the back wall.
    const fridgeGlow = new MeshStandardMaterial({ color: 0x0c1418, emissive: 0x7fd0ff, emissiveIntensity: 0.5 });
    this.box(5, 2.2, 0.6, this.m.white, 4.6, 0, maxZ - T - 0.3);
    for (let i = 0; i < 3; i++) {
      const door = new Mesh(new PlaneGeometry(1.4, 1.8), fridgeGlow);
      door.position.set(2.9 + i * 1.65, 1.1, maxZ - T - 0.61);
      door.rotation.y = Math.PI;
      this.root.add(door);
    }

    // Fluorescent tube that flickers.
    const tube = new MeshStandardMaterial({ color: 0xe8fff0, emissive: 0xd8ffe8, emissiveIntensity: 1.2 });
    const tubeMesh = new Mesh(new BoxGeometry(2.4, 0.08, 0.25), tube);
    tubeMesh.position.set(0, H - 0.1, 10);
    this.root.add(tubeMesh);
    this.addFlicker(this.pointLight(0xd8ffe8, 40, 18, 0, H - 0.4, 10), 1.6, tube);

    // Wall-buys: SMG outside by the door, shotgun inside, rifle on the west wall.
    this.addWallBuy('vex', new Vector3(-2.75, 1.6, minZ - 0.03), Math.PI, new Vector3(-2.75, 0, minZ - 0.8));
    this.addWallBuy('breacher', new Vector3(-3, 1.7, maxZ - T - 0.02), Math.PI, new Vector3(-3, 0, maxZ - 1.0));
    this.addWallBuy('longwatch', new Vector3(minX - 0.03, 1.6, 10), -Math.PI / 2, new Vector3(minX - 0.8, 0, 10));
  }

  private addWallBuy(weaponId: WeaponId, at: Vector3, rotY: number, standAt: Vector3): void {
    const def = getWeapon(weaponId);
    const mat = new MeshBasicMaterial({ map: tex.chalkTexture(def.name, def.price, def.model), transparent: true, depthWrite: false, color: 0xbfc4c8 });
    const mesh = new Mesh(new PlaneGeometry(1.7, 0.85), mat);
    mesh.position.copy(at);
    mesh.rotation.y = rotY;
    this.root.add(mesh);
    this.wallBuys.push({ weaponId, position: standAt });
  }

  private makeCar(color: number, truck: boolean): Group {
    const g = new Group();
    const paint = new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.4 });
    const len = truck ? 5.2 : 4.3;
    const add = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number): Mesh => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    add(1.9, 0.75, len, paint, 0, 0.35, 0);
    if (truck) {
      add(1.85, 0.8, 1.9, paint, 0, 1.1, -1.3);
      add(1.8, 0.4, 2.6, this.m.rust, 0, 1.1, 1.1);
    } else {
      add(1.7, 0.65, 2.2, paint, 0, 1.1, 0.1);
      add(1.72, 0.45, 2.0, this.m.glass, 0, 1.15, 0.1);
    }
    const wheel = new CylinderGeometry(0.36, 0.36, 0.28, 12);
    for (const sx of [-0.95, 0.95]) {
      for (const sz of [-len * 0.32, len * 0.32]) {
        const w = new Mesh(wheel, this.m.tire);
        w.rotation.z = Math.PI / 2;
        w.position.set(sx, 0.36, sz);
        g.add(w);
      }
    }
    return g;
  }

  private placeObject(obj: Object3D, x: number, z: number, rotY: number, nav = false): void {
    obj.position.set(x, 0, z);
    obj.rotation.y = rotY;
    this.root.add(obj);
    this.collision.addObject(obj, nav);
    this.bulletBlockers.push(obj);
  }

  private buildProps(): void {
    this.placeObject(this.makeCar(0x4a5560, false), -11.5, -16, 0.12);
    this.placeObject(this.makeCar(0x6b2b22, true), 14, -1, Math.PI / 2 + 0.06);
    this.placeObject(this.makeCar(0x3d4a3a, false), 6, -25.5, 1.45);
    this.placeObject(this.makeCar(0x777064, false), -13, -1, 0.02);

    // Dumpster beside the store.
    this.box(1.3, 1.4, 2.2, new MeshStandardMaterial({ color: 0x23402c, roughness: 0.8, metalness: 0.3 }), 10.2, 0, 12);
    // Propane cage and ice chest.
    this.box(1.6, 1.8, 0.9, this.m.metal, 9.2, 0, 6.6);
    this.box(1.6, 1.1, 0.7, this.m.white, 5.4, 0, 4.2);

    // Barrels.
    const barrel = new CylinderGeometry(0.33, 0.33, 0.95, 14);
    for (const [x, z] of [[-9.6, -3.6], [-8.9, -2.8], [9, -12.5], [-16, 8], [17, 15], [2, 22], [-21, -8], [20, -15]]) {
      const b = new Mesh(barrel, this.m.rust);
      b.position.set(x, 0.475, z);
      b.castShadow = true;
      b.receiveShadow = true;
      this.root.add(b);
      this.collision.addObject(b);
      this.bulletBlockers.push(b);
    }
    // Jersey barriers along the road.
    for (const [x, z, r] of [[-18, -22.5, 0.15], [-14, -22.2, -0.05], [21, -22.7, 0.1]]) {
      this.box(3, 0.85, 0.6, this.m.concrete, x, 0, z, { rotY: r });
    }
    // Tyre stack and pallets behind the store.
    for (let i = 0; i < 4; i++) {
      const t = new Mesh(new CylinderGeometry(0.42, 0.42, 0.26, 14), this.m.tire);
      t.position.set(-5, 0.13 + i * 0.26, 19);
      t.castShadow = true;
      this.root.add(t);
    }
    this.collision.add({ minX: -5.45, maxX: -4.55, minY: 0, maxY: 1.05, minZ: 18.55, maxZ: 19.45 });
    this.box(1.2, 0.5, 1.2, this.m.wood, 4, 0, 19.5);
    this.box(1.2, 0.5, 1.2, this.m.wood, 4.4, 0.5, 19.3, { rotY: 0.4 });
  }

  private buildRoadSign(): void {
    const x = -15;
    const z = -19;
    this.box(0.35, 7.4, 0.35, this.m.metal, x, 0, z);
    const face = tex.roadSignTexture();
    const mat = new MeshStandardMaterial({ map: face, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.7 });
    const board = new Mesh(new BoxGeometry(4, 2.65, 0.25), [this.m.darkTrim, this.m.darkTrim, this.m.darkTrim, this.m.darkTrim, mat, mat]);
    board.position.set(x, 8.4, z);
    board.rotation.y = 0.35;
    board.castShadow = true;
    this.root.add(board);
    this.addFlicker(this.pointLight(0xff5040, 16, 14, x, 6.6, z + 1.2), 0.9, mat);
  }

  private buildLampPost(): void {
    const x = -20;
    const z = 13;
    this.box(0.25, 6, 0.25, this.m.metal, x, 0, z);
    this.box(1.6, 0.15, 0.25, this.m.metal, x + 0.7, 6, z, { collide: false });
    const bulb = new MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb860, emissiveIntensity: 1.4 });
    const head = new Mesh(new BoxGeometry(0.6, 0.15, 0.4), bulb);
    head.position.set(x + 1.3, 5.95, z);
    this.root.add(head);
    const glow = new Sprite(new SpriteMaterial({ map: tex.glowTexture('rgba(255,210,150,0.9)', 'rgba(255,160,80,0.25)'), blending: AdditiveBlending, depthWrite: false }));
    glow.position.copy(head.position);
    glow.scale.setScalar(2.2);
    this.root.add(glow);
    this.addFlicker(this.pointLight(0xffa860, 24, 20, x + 1.3, 5.6, z), 0.25, bulb);
  }

  private buildFence(): void {
    const chain = new MeshStandardMaterial({
      map: tex.fenceTexture(HALF * 2 / 0.45, 2.6 / 0.45),
      transparent: true,
      alphaTest: 0.4,
      side: DoubleSide,
      roughness: 0.6,
      metalness: 0.5,
    });
    const fenceH = 2.6;
    const sides: [number, number, number][] = [
      [0, -HALF, 0],
      [0, HALF, 0],
      [-HALF, 0, Math.PI / 2],
      [HALF, 0, Math.PI / 2],
    ];
    for (const [x, z, rot] of sides) {
      const mesh = new Mesh(new PlaneGeometry(HALF * 2, fenceH), chain);
      mesh.position.set(x, fenceH / 2, z);
      mesh.rotation.y = rot;
      this.root.add(mesh);
      // Top rail.
      const rail = new Mesh(new CylinderGeometry(0.04, 0.04, HALF * 2, 6), this.m.metal);
      rail.rotation.set(0, rot, Math.PI / 2);
      rail.position.set(x, fenceH, z);
      this.root.add(rail);
      // Invisible collider wall.
      const thick = 0.4;
      if (rot === 0) {
        this.collision.add({ minX: -HALF - 1, maxX: HALF + 1, minY: 0, maxY: 6, minZ: z - thick, maxZ: z + thick });
      } else {
        this.collision.add({ minX: x - thick, maxX: x + thick, minY: 0, maxY: 6, minZ: -HALF - 1, maxZ: HALF + 1 });
      }
    }
    const post = new CylinderGeometry(0.06, 0.06, fenceH + 0.1, 6);
    for (let t = -HALF; t <= HALF; t += 3) {
      for (const [x, z] of [[t, -HALF], [t, HALF], [-HALF, t], [HALF, t]]) {
        const p = new Mesh(post, this.m.metal);
        p.position.set(x, (fenceH + 0.1) / 2, z);
        this.root.add(p);
      }
    }
  }

  private buildTrees(): void {
    const rand = tex.seededRandom(1234);
    const positions: [number, number, number][] = [];
    while (positions.length < 140) {
      const angle = rand() * Math.PI * 2;
      const r = 34 + rand() * 30;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (z > -31 && z < -20) continue; // keep the road clear
      positions.push([x, z, 0.7 + rand() * 0.7]);
    }
    const leaves = new InstancedMesh(new ConeGeometry(2, 7, 7), new MeshStandardMaterial({ color: 0x0c1a12, roughness: 1 }), positions.length);
    const trunks = new InstancedMesh(new CylinderGeometry(0.2, 0.3, 2, 6), new MeshStandardMaterial({ color: 0x1c140e, roughness: 1 }), positions.length);
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    positions.forEach(([x, z, scale], i) => {
      s.setScalar(scale);
      trunks.setMatrixAt(i, m.compose(p.set(x, 1 * scale, z), q, s));
      leaves.setMatrixAt(i, m.compose(p.set(x, (2 + 3.5) * scale, z), q, s));
    });
    leaves.castShadow = true;
    this.root.add(leaves, trunks);
  }

  private buildSky(): void {
    const rand = tex.seededRandom(99);
    const verts: number[] = [];
    for (let i = 0; i < 900; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 0.95);
      const r = 170;
      verts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(verts, 3));
    this.root.add(new Points(geo, new PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false })));

    const moonMesh = new Mesh(new SphereGeometry(6, 24, 16), new MeshBasicMaterial({ color: 0xdfe6ff, fog: false }));
    moonMesh.position.set(-75, 85, -105);
    this.root.add(moonMesh);
    const halo = new Sprite(new SpriteMaterial({ map: tex.glowTexture('rgba(200,215,255,0.5)', 'rgba(120,140,220,0.12)'), fog: false, blending: AdditiveBlending, depthWrite: false }));
    halo.position.copy(moonMesh.position);
    halo.scale.setScalar(55);
    this.root.add(halo);
  }

  private defineSpawns(): void {
    const e = HALF - 2.5;
    for (const [x, z] of [
      [-e, -14], [-e, 0], [-e, 14], [-e, 25],
      [e, -12], [e, 5], [e, 20],
      [-15, e], [0, e], [15, e],
      [-22, -26], [22, -27], [0, -e],
    ]) {
      this.zombieSpawns.push(new Vector3(x, 0, z));
    }
  }
}
