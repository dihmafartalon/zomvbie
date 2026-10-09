import {
  Box3,
  BoxGeometry,
  type DataTexture,
  EquirectangularReflectionMapping,
  Group,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { HDRI, MODELS, type ModelEntry, type ModelKey, TEXTURE_SETS, type TextureSetKey } from './catalog';

export interface LoadProgress {
  loaded: number;
  total: number;
  /** Most recently finished item. */
  item: string;
}

export interface ModelOptions {
  /** Keep only meshes whose centre lies in this X range (picks one variant from side-by-side source files). */
  pickX?: [number, number];
  /** Keep only nodes with exactly these names (and their children). */
  nodes?: readonly string[];
  castShadow?: boolean;
}

export interface PbrOptions {
  /** Texture repeats across the surface. */
  repeat?: [number, number];
  /** Multiplies the albedo (use to tint or darken a set). */
  color?: number;
  /** Drop the albedo map and use `color` only, keeping normal/roughness detail. */
  noAlbedo?: boolean;
  /** Replace the albedo with another texture (e.g. a weathering overlay), tinted by `color`. */
  albedo?: Texture;
  normalScale?: number;
  roughness?: number;
  metalness?: number;
}

interface TextureSet {
  diff: Texture;
  nor: Texture;
  arm: Texture;
}

const tmpBox = new Box3();
const tmpSize = new Vector3();
const tmpCenter = new Vector3();

/**
 * Loads every shipped asset up front (with progress) and hands out ready-to-use
 * instances. Missing assets never crash the game: they are reported in
 * `failures` and replaced with clearly marked fallback geometry.
 */
export class AssetLibrary {
  readonly failures: string[] = [];
  environment: DataTexture | null = null;

  private readonly models = new Map<ModelKey, Object3D>();
  private readonly textures = new Map<TextureSetKey, TextureSet>();
  private readonly materialCache = new Map<string, MeshStandardMaterial>();
  private anisotropy = 4;

  constructor(private readonly baseUrl: string) {}

  async load(renderer: WebGLRenderer, onProgress: (p: LoadProgress) => void): Promise<void> {
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const manager = new LoadingManager();
    const gltf = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
    const tex = new TextureLoader(manager);
    const hdr = new HDRLoader(manager);

    const jobs: { label: string; run: () => Promise<void> }[] = [];
    jobs.push({
      label: 'night sky',
      run: async () => {
        const t = await hdr.loadAsync(this.url(HDRI));
        t.mapping = EquirectangularReflectionMapping;
        this.environment = t;
      },
    });
    for (const key of TEXTURE_SETS) {
      jobs.push({
        label: key,
        run: async () => {
          const dir = this.url(`textures/${key}`);
          const [diff, nor, arm] = await Promise.all([
            tex.loadAsync(`${dir}/diff.webp`),
            tex.loadAsync(`${dir}/nor.webp`),
            tex.loadAsync(`${dir}/arm.webp`),
          ]);
          diff.colorSpace = SRGBColorSpace;
          for (const t of [diff, nor, arm]) {
            t.wrapS = t.wrapT = RepeatWrapping;
            t.anisotropy = this.anisotropy;
          }
          this.textures.set(key, { diff, nor, arm });
        },
      });
    }
    for (const [key, entry] of Object.entries(MODELS) as [ModelKey, ModelEntry][]) {
      jobs.push({
        label: key,
        run: async () => {
          const result = await gltf.loadAsync(this.url(entry.file));
          this.models.set(key, result.scene);
        },
      });
    }

    let loaded = 0;
    await Promise.all(
      jobs.map(async (job) => {
        try {
          await job.run();
        } catch (err) {
          this.failures.push(job.label);
          console.warn(`[assets] failed to load ${job.label}`, err);
        }
        loaded++;
        onProgress({ loaded, total: jobs.length, item: job.label });
      }),
    );
  }

  /**
   * A new instance of a model, re-pivoted so its footprint is centred on the
   * origin and it rests on y = 0. Geometry and materials are shared.
   */
  model(key: ModelKey, opts: ModelOptions = {}): Group {
    const wrapper = new Group();
    wrapper.name = key;
    const source = this.models.get(key);
    if (!source) {
      wrapper.add(this.fallback((MODELS[key] as ModelEntry).height ?? 0.5));
      return wrapper;
    }

    const inner = source.clone(true);
    inner.updateMatrixWorld(true);
    if (opts.nodes || opts.pickX) this.filterNodes(inner, opts);

    const castShadow = opts.castShadow ?? true;
    inner.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = castShadow;
        o.receiveShadow = true;
      }
    });

    tmpBox.setFromObject(inner);
    tmpBox.getSize(tmpSize);
    const expected = (MODELS[key] as ModelEntry).height;
    let scale = 1;
    if (expected && tmpSize.y > 0 && Math.abs(tmpSize.y / expected - 1) > 0.25) scale = expected / tmpSize.y;
    inner.scale.multiplyScalar(scale);
    inner.updateMatrixWorld(true);
    tmpBox.setFromObject(inner);
    tmpBox.getCenter(tmpCenter);
    inner.position.x -= tmpCenter.x;
    inner.position.z -= tmpCenter.z;
    inner.position.y -= tmpBox.min.y;
    wrapper.add(inner);
    return wrapper;
  }

  /** The raw loaded scene for a model (for extracting parts, e.g. instancing). */
  source(key: ModelKey): Object3D | null {
    return this.models.get(key) ?? null;
  }

  /**
   * PBR material from a Poly Haven texture set (albedo, OpenGL normal and
   * packed AO/roughness/metalness). Cached per unique option set.
   */
  pbr(key: TextureSetKey, opts: PbrOptions = {}): MeshStandardMaterial {
    const { albedo, ...rest } = opts;
    const cacheKey = `${key}:${JSON.stringify(rest)}:${albedo?.uuid ?? ''}`;
    const cached = this.materialCache.get(cacheKey);
    if (cached) return cached;

    const set = this.textures.get(key);
    const mat = new MeshStandardMaterial({ color: opts.color ?? 0xffffff, roughness: opts.roughness ?? 1, metalness: opts.metalness ?? 0 });
    if (set) {
      const [rx, ry] = opts.repeat ?? [1, 1];
      const rep = (t: Texture): Texture => {
        const c = t.clone();
        c.repeat.set(rx, ry);
        c.needsUpdate = true;
        return c;
      };
      if (albedo) mat.map = albedo;
      else if (!opts.noAlbedo) mat.map = rep(set.diff);
      mat.normalMap = rep(set.nor);
      const n = opts.normalScale ?? 1;
      mat.normalScale.set(n, n);
      const arm = rep(set.arm);
      mat.aoMap = arm;
      mat.roughnessMap = arm;
      mat.metalnessMap = arm;
    } else {
      mat.color.set(0xff00ff); // loud fallback so missing textures are obvious in testing
    }
    this.materialCache.set(cacheKey, mat);
    return mat;
  }

  private url(rel: string): string {
    return `${this.baseUrl}assets/${rel}`;
  }

  private filterNodes(root: Object3D, opts: ModelOptions): void {
    const keep = new Set<Object3D>();
    root.traverse((o) => {
      if (!(o as Mesh).isMesh) return;
      let ok = true;
      if (opts.nodes) {
        let p: Object3D | null = o;
        ok = false;
        while (p && p !== root) {
          if (opts.nodes.includes(p.name)) ok = true;
          p = p.parent;
        }
      }
      if (ok && opts.pickX) {
        tmpBox.setFromObject(o).getCenter(tmpCenter);
        ok = tmpCenter.x >= opts.pickX[0] && tmpCenter.x <= opts.pickX[1];
      }
      if (ok) keep.add(o);
    });
    const remove: Object3D[] = [];
    root.traverse((o) => {
      if ((o as Mesh).isMesh && !keep.has(o)) remove.push(o);
    });
    for (const o of remove) o.removeFromParent();
  }

  private fallback(height: number): Mesh {
    const mesh = new Mesh(new BoxGeometry(height * 0.8, height, height * 0.8), new MeshStandardMaterial({ color: 0xff00ff }));
    mesh.position.y = height / 2;
    return mesh;
  }
}
