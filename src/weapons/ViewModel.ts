import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type PerspectiveCamera,
  PointLight,
  type Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { glowTexture } from '../world/textures';
import type { WeaponModel } from './WeaponDefs';

interface ModelInfo {
  group: Group;
  muzzle: Vector3;
  /** Height of the sight line above the model origin, for ADS alignment. */
  sightY: number;
}

export interface ViewModelState {
  /** 0 = hip, 1 = fully aimed. */
  ads: number;
  /** Player movement amount (0..~1.5). */
  moving: number;
  /** 0..1 while reloading, else null. */
  reload: number | null;
  lookX: number;
  lookY: number;
}

const HIP = new Vector3(0.19, -0.19, -0.5);

/**
 * First-person weapon models, rendered in a separate scene on top of the world
 * so they never clip into walls. Purely visual: no gameplay state lives here.
 */
export class ViewModel {
  private readonly root = new Group();
  private readonly pivot = new Group();
  private readonly models = new Map<WeaponModel, ModelInfo>();
  private current: ModelInfo | null = null;
  private readonly flash: Sprite;
  private readonly flashLight: PointLight;

  private recoil = 0;
  private flashTime = 0;
  private bobPhase = 0;
  private swayX = 0;
  private swayY = 0;
  private raise = 0;

  private readonly mats = {
    metal: new MeshStandardMaterial({ color: 0x4a4d54, roughness: 0.4, metalness: 0.25 }),
    poly: new MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.75 }),
    wood: new MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 }),
    sleeve: new MeshStandardMaterial({ color: 0x46553f, roughness: 0.95 }),
    glove: new MeshStandardMaterial({ color: 0x3a312a, roughness: 0.9 }),
  };

  constructor(viewScene: Scene) {
    viewScene.add(new HemisphereLight(0xa0b0d8, 0x2a2a2a, 1.6));
    const key = new DirectionalLight(0xd8e0ff, 1.4);
    key.position.set(-1, 2, 1);
    viewScene.add(key);

    this.root.add(this.pivot);
    viewScene.add(this.root);

    this.flash = new Sprite(
      new SpriteMaterial({
        map: glowTexture('rgba(255,250,220,1)', 'rgba(255,170,60,0.7)'),
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.flash.visible = false;
    this.pivot.add(this.flash);
    this.flashLight = new PointLight(0xffb060, 0, 2, 2);
    this.pivot.add(this.flashLight);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  setModel(model: WeaponModel): void {
    if (this.current) this.pivot.remove(this.current.group);
    let info = this.models.get(model);
    if (!info) {
      info = this.build(model);
      this.models.set(model, info);
    }
    this.current = info;
    this.pivot.add(info.group);
    this.flash.position.copy(info.muzzle);
    this.flashLight.position.copy(info.muzzle);
    this.raise = 1;
  }

  /** Called once per shot. */
  kick(strength: number): void {
    this.recoil = Math.min(1, this.recoil + strength);
    this.flashTime = 0.05;
  }

  update(dt: number, camera: PerspectiveCamera, s: ViewModelState): void {
    this.root.position.copy(camera.position);
    this.root.quaternion.copy(camera.quaternion);

    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.raise = Math.max(0, this.raise - dt / 0.35);
    const moving = Math.min(1.4, s.moving);
    this.bobPhase += dt * 8.5 * moving;
    const sway = 1 - Math.exp(-10 * dt);
    this.swayX += (clamp(-s.lookX * 3, -0.06, 0.06) - this.swayX) * sway;
    this.swayY += (clamp(s.lookY * 3, -0.06, 0.06) - this.swayY) * sway;

    const sightY = this.current?.sightY ?? 0.05;
    const ads = s.ads;
    const bobScale = 1 - ads * 0.85;
    const dip = s.reload === null ? 0 : Math.sin(s.reload * Math.PI);

    this.pivot.position.set(
      lerp(HIP.x, 0, ads) + Math.sin(this.bobPhase) * 0.014 * moving * bobScale + this.swayX * bobScale,
      lerp(HIP.y, -sightY, ads) - Math.abs(Math.cos(this.bobPhase)) * 0.012 * moving * bobScale + this.swayY * bobScale - this.raise * 0.35 - dip * 0.1,
      lerp(HIP.z, -0.42, ads) + this.recoil * 0.06,
    );
    this.pivot.rotation.set(this.recoil * 0.12 - dip * 0.55 - this.raise * 0.6, 0, dip * 0.45);

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flash.visible = true;
      this.flash.material.rotation = Math.random() * Math.PI;
      this.flash.scale.setScalar(0.12 + Math.random() * 0.08);
      this.flashLight.intensity = 3;
    } else {
      this.flash.visible = false;
      this.flashLight.intensity = 0;
    }
  }

  private build(model: WeaponModel): ModelInfo {
    const g = new Group();
    const { metal, poly, wood, sleeve, glove } = this.mats;
    const box = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, rx = 0, ry = 0): Mesh => {
      const m = new Mesh(new BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      g.add(m);
      return m;
    };
    const tube = (r: number, len: number, mat: Material, x: number, y: number, z: number): Mesh => {
      const m = new Mesh(new CylinderGeometry(r, r, len, 10), mat);
      m.rotation.x = Math.PI / 2;
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };

    let muzzle: Vector3;
    let sightY: number;
    let twoHanded = true;
    switch (model) {
      case 'pistol':
        box(0.045, 0.05, 0.21, metal, 0, 0.02, -0.03);
        box(0.04, 0.03, 0.17, poly, 0, -0.015, -0.02);
        box(0.04, 0.11, 0.055, poly, 0, -0.075, 0.05, 0.2);
        box(0.01, 0.012, 0.01, metal, 0, 0.051, -0.12);
        muzzle = new Vector3(0, 0.02, -0.16);
        sightY = 0.055;
        twoHanded = false;
        break;
      case 'smg':
        box(0.055, 0.075, 0.3, metal, 0, 0, -0.05);
        tube(0.012, 0.12, metal, 0, 0.01, -0.26);
        box(0.035, 0.15, 0.05, poly, 0, -0.1, -0.08);
        box(0.04, 0.1, 0.05, poly, 0, -0.08, 0.06, 0.25);
        box(0.03, 0.05, 0.18, poly, 0, -0.005, 0.19);
        box(0.02, 0.02, 0.2, metal, 0, 0.048, -0.05);
        muzzle = new Vector3(0, 0.01, -0.34);
        sightY = 0.062;
        break;
      case 'shotgun':
        tube(0.018, 0.62, metal, 0, 0.02, -0.25);
        tube(0.015, 0.5, metal, 0, -0.015, -0.22);
        box(0.05, 0.045, 0.14, wood, 0, -0.015, -0.28);
        box(0.055, 0.07, 0.16, metal, 0, 0, 0.02);
        box(0.045, 0.09, 0.26, wood, 0, -0.03, 0.2, -0.1);
        muzzle = new Vector3(0, 0.02, -0.58);
        sightY = 0.045;
        break;
      case 'rifle':
        box(0.05, 0.08, 0.32, metal, 0, 0, -0.02);
        tube(0.011, 0.32, metal, 0, 0.01, -0.33);
        box(0.06, 0.06, 0.2, poly, 0, 0.005, -0.22);
        box(0.035, 0.14, 0.06, poly, 0, -0.1, -0.06, 0.2);
        box(0.04, 0.08, 0.22, poly, 0, -0.01, 0.24);
        tube(0.022, 0.16, poly, 0, 0.075, -0.03);
        muzzle = new Vector3(0, 0.01, -0.51);
        sightY = 0.075;
        break;
    }

    // Right hand + sleeve.
    box(0.06, 0.07, 0.09, glove, 0.005, -0.07, 0.06, 0.2);
    box(0.085, 0.085, 0.28, sleeve, 0.05, -0.15, 0.21, 0.35);
    if (twoHanded) {
      box(0.06, 0.06, 0.09, glove, -0.02, -0.05, -0.2);
      box(0.085, 0.085, 0.42, sleeve, -0.12, -0.11, -0.02, 0.3, -0.55);
    } else {
      box(0.055, 0.065, 0.08, glove, -0.035, -0.08, 0.05, 0.2);
      box(0.085, 0.085, 0.28, sleeve, -0.13, -0.17, 0.19, 0.35, -0.3);
    }
    return { group: g, muzzle, sightY };
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
