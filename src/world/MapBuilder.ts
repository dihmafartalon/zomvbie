import {
  BoxGeometry,
  type BufferGeometry,
  Group,
  type Material,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  PointLight,
  SpotLight,
} from 'three';
import type { AssetLibrary, ModelOptions } from '../assets/AssetLibrary';
import type { ModelKey } from '../assets/catalog';
import { CollisionWorld } from './Collision';

export interface PlaceOptions {
  rotY?: number;
  /** Adds an AABB collider (default true). */
  collide?: boolean;
  /** Large obstacle that zombie path-finding must route around. */
  nav?: boolean;
  /** Stops bullets (defaults to `collide`). */
  blocksBullets?: boolean;
  castShadow?: boolean;
  parent?: Object3D;
}

interface Flicker {
  light: PointLight | SpotLight;
  base: number;
  emissive: MeshStandardMaterial[];
  emissiveBase: number[];
  /** Chance per second of a flicker burst. */
  rate: number;
  level: number;
  dropTimer: number;
}

/**
 * Shared construction helpers for maps: real-world UV scaling, asset
 * placement that keeps collision and bullet blocking in sync, and lights.
 */
export class MapBuilder {
  readonly root = new Group();
  readonly collision = new CollisionWorld();
  readonly bulletBlockers: Object3D[] = [];
  private readonly flickers: Flicker[] = [];

  constructor(readonly assets: AssetLibrary) {}

  /** Box whose bottom sits at `y`; UVs are scaled so `tile` metres = one texture repeat. */
  box(w: number, h: number, d: number, mat: Material | Material[], x: number, y: number, z: number, opts: PlaceOptions & { tile?: number } = {}): Mesh {
    const geo = new BoxGeometry(w, h, d);
    worldScaleBoxUVs(geo, w, h, d, opts.tile ?? 2);
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y + h / 2, z);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    return this.register(mesh, opts);
  }

  /** Horizontal plane (facing up) with UVs tiled every `tile` metres. */
  floor(w: number, d: number, mat: Material, x: number, y: number, z: number, tile = 2, rotY = 0): Mesh {
    const geo = new PlaneGeometry(w, d);
    scaleUVs(geo, w / tile, d / tile);
    const mesh = new Mesh(geo, mat);
    mesh.rotation.set(-Math.PI / 2, 0, rotY);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
  }

  /** Places a library model with its footprint centred at (x, z). */
  place(key: ModelKey, x: number, z: number, opts: PlaceOptions & ModelOptions & { y?: number; scale?: number } = {}): Group {
    const obj = this.assets.model(key, opts);
    obj.position.set(x, opts.y ?? 0, z);
    if (opts.scale) obj.scale.setScalar(opts.scale);
    if (opts.rotY) obj.rotation.y = opts.rotY;
    return this.register(obj, { collide: true, ...opts });
  }

  /** Adds an object to the map, registering collision / bullet blocking. */
  register<T extends Object3D>(obj: T, opts: PlaceOptions = {}): T {
    (opts.parent ?? this.root).add(obj);
    const cast = opts.castShadow ?? true;
    obj.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = o.castShadow && cast;
        o.receiveShadow = true;
      }
    });
    if ((obj as unknown as Mesh).isMesh) {
      obj.castShadow = cast;
      obj.receiveShadow = true;
    }
    const collide = opts.collide ?? true;
    if (collide) this.collision.addObject(obj, opts.nav ?? false);
    if (opts.blocksBullets ?? collide) this.bulletBlockers.push(obj);
    return obj;
  }

  pointLight(color: number, intensity: number, distance: number, x: number, y: number, z: number): PointLight {
    const light = new PointLight(color, intensity, distance, 1.8);
    light.position.set(x, y, z);
    this.root.add(light);
    return light;
  }

  /** Downward cone light, aimed at (tx, 0, tz). */
  spotLight(color: number, intensity: number, distance: number, angle: number, x: number, y: number, z: number, tx = x, tz = z): SpotLight {
    const light = new SpotLight(color, intensity, distance, angle, 0.55, 1.6);
    light.position.set(x, y, z);
    light.target.position.set(tx, 0, tz);
    this.root.add(light, light.target);
    return light;
  }

  /** Makes a light (and any emissive materials driven by it) flicker. */
  flicker(light: PointLight | SpotLight, rate: number, emissive: MeshStandardMaterial[] = []): void {
    this.flickers.push({
      light,
      base: light.intensity,
      emissive,
      emissiveBase: emissive.map((m) => m.emissiveIntensity),
      rate,
      level: 1,
      dropTimer: 0,
    });
  }

  updateLights(dt: number): void {
    for (const f of this.flickers) {
      if (f.dropTimer > 0) f.dropTimer -= dt;
      else if (Math.random() < f.rate * dt) f.dropTimer = 0.04 + Math.random() * 0.22;
      const target = f.dropTimer > 0 ? 0.05 + Math.random() * 0.3 : 1;
      f.level += (target - f.level) * Math.min(1, dt * 30);
      f.light.intensity = f.base * f.level;
      f.emissive.forEach((m, i) => (m.emissiveIntensity = f.emissiveBase[i] * f.level));
    }
  }
}

/** Multiplies a geometry's UVs (for tiling a texture across a large surface). */
export function scaleUVs(geo: BufferGeometry, su: number, sv: number): void {
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

/**
 * Rewrites BoxGeometry UVs so each face tiles at `tile` metres per repeat
 * instead of stretching one texture copy over the whole face.
 */
export function worldScaleBoxUVs(geo: BoxGeometry, w: number, h: number, d: number, tile: number): void {
  const uv = geo.getAttribute('uv');
  // Face order: +x, -x, +y, -y, +z, -z (4 vertices each with default segments).
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let face = 0; face < 6; face++) {
    const [fu, fv] = dims[face];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, (uv.getX(i) * fu) / tile, (uv.getY(i) * fv) / tile);
    }
  }
  uv.needsUpdate = true;
}
