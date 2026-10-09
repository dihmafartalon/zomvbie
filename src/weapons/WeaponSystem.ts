import { type PerspectiveCamera, type PointLight, Quaternion, Vector3 } from 'three';
import type { AudioSystem } from '../core/AudioSystem';
import type { FrameInput } from '../core/Input';
import type { HitPart, Zombie } from '../enemies/Zombie';
import { getWeapon, type WeaponId } from './WeaponDefs';
import { WeaponState } from './WeaponState';
import type { ViewModel } from './ViewModel';

export interface RayHit {
  point: Vector3;
  normal: Vector3 | null;
  zombie: Zombie | null;
  part: HitPart;
}

export interface WeaponSystemDeps {
  camera: PerspectiveCamera;
  viewModel: ViewModel;
  audio: AudioSystem;
  /** World-space flash light that briefly lights the surroundings on each shot. */
  muzzleLight: PointLight;
  castRay(origin: Vector3, dir: Vector3, range: number): RayHit | null;
  onZombieHit(zombie: Zombie, damage: number, headshot: boolean, point: Vector3): void;
  onWorldHit(point: Vector3, normal: Vector3 | null): void;
  onRecoil(kick: number): void;
}

const SLOT_COUNT = 2;
const RAISE_TIME = 0.35;

const origin = new Vector3();
const dir = new Vector3();
const spreadQuat = new Quaternion();

/**
 * Owns the player's weapon slots and turns input into shots: fire rate,
 * reloads, swapping, aim-down-sights and hitscan resolution.
 */
export class WeaponSystem {
  readonly slots: (WeaponState | null)[] = [null, null];
  active = 0;
  /** 0 = hip, 1 = fully aimed. */
  aimAmount = 0;
  shotsFired = 0;
  private raiseTimer = 0;
  private flashTimer = 0;
  private readonly pending = new Map<Zombie, { damage: number; headshot: boolean; point: Vector3 }>();

  constructor(private readonly deps: WeaponSystemDeps) {}

  get current(): WeaponState {
    const w = this.slots[this.active];
    if (!w) throw new Error('No active weapon');
    return w;
  }

  get isAiming(): boolean {
    return this.aimAmount > 0.5;
  }

  reset(startingWeapon: WeaponId): void {
    this.slots.fill(null);
    this.slots[0] = new WeaponState(getWeapon(startingWeapon));
    this.active = 0;
    this.aimAmount = 0;
    this.shotsFired = 0;
    this.equip(0);
  }

  find(id: WeaponId): WeaponState | null {
    return this.slots.find((w) => w?.def.id === id) ?? null;
  }

  /** Gives a weapon: fills an empty slot, otherwise replaces the active one. */
  give(id: WeaponId): void {
    const state = new WeaponState(getWeapon(id));
    const empty = this.slots.indexOf(null);
    const slot = empty >= 0 ? empty : this.active;
    this.slots[slot] = state;
    this.equip(slot);
  }

  update(dt: number, input: FrameInput, moving: number): void {
    // Slot switching.
    if (input.slotPressed >= 0 && input.slotPressed < SLOT_COUNT && input.slotPressed !== this.active && this.slots[input.slotPressed]) {
      this.equip(input.slotPressed);
    } else if (input.swapPressed) {
      const next = (this.active + 1) % SLOT_COUNT;
      if (this.slots[next]) this.equip(next);
    }

    const weapon = this.current;
    weapon.update(dt);
    this.raiseTimer = Math.max(0, this.raiseTimer - dt);

    if (input.reloadPressed && weapon.startReload()) {
      this.deps.audio.reload(weapon.def.reloadTime);
    }

    const wantsAim = input.aimHeld && !weapon.reloading && this.raiseTimer <= 0;
    this.aimAmount = approach(this.aimAmount, wantsAim ? 1 : 0, dt / 0.15);

    const wantsFire = weapon.def.automatic ? input.fireHeld : input.firePressed;
    if (wantsFire && this.raiseTimer <= 0 && !weapon.reloading) {
      if (weapon.mag === 0) {
        if (weapon.startReload()) this.deps.audio.reload(weapon.def.reloadTime);
        else if (input.firePressed) this.deps.audio.dryFire();
      } else if (weapon.tryFire()) {
        this.fire(weapon, moving);
      }
    }

    // Auto-reload once the magazine runs dry and the trigger is released.
    if (weapon.mag === 0 && !input.fireHeld && weapon.startReload()) {
      this.deps.audio.reload(weapon.def.reloadTime);
    }

    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.deps.muzzleLight.intensity = this.flashTimer > 0 ? 6 : 0;

    const cam = this.deps.camera;
    this.deps.viewModel.update(dt, cam, {
      ads: this.aimAmount,
      moving,
      reload: weapon.reloadProgress,
      lookX: input.lookX,
      lookY: input.lookY,
    });
  }

  private equip(slot: number): void {
    const prev = this.slots[this.active];
    if (prev && slot !== this.active) prev.cancelReload();
    this.active = slot;
    this.raiseTimer = RAISE_TIME;
    this.deps.viewModel.setModel(this.current.def.model);
  }

  private fire(weapon: WeaponState, moving: number): void {
    const { camera, audio, viewModel } = this.deps;
    const def = weapon.def;
    this.shotsFired++;
    audio.gunshot(def.model);
    viewModel.kick(def.pellets > 1 ? 1 : 0.6);
    this.deps.onRecoil(def.recoil * (1 - this.aimAmount * 0.4) * (0.7 + Math.random() * 0.6));

    camera.getWorldPosition(origin);
    this.flashTimer = 0.05;
    this.deps.muzzleLight.position.copy(origin);
    camera.getWorldQuaternion(spreadQuat);

    const hipSpread = def.hipSpread * (1 + Math.min(1, moving) * 0.6);
    const spread = hipSpread + (def.adsSpread - hipSpread) * this.aimAmount;
    const tan = Math.tan(spread);

    this.pending.clear();
    for (let i = 0; i < def.pellets; i++) {
      // Uniform sample inside the spread cone.
      const r = Math.sqrt(Math.random()) * tan;
      const a = Math.random() * Math.PI * 2;
      dir.set(Math.cos(a) * r, Math.sin(a) * r, -1).normalize().applyQuaternion(spreadQuat);
      const hit = this.deps.castRay(origin, dir, def.range);
      if (!hit) continue;
      if (hit.zombie) {
        const headshot = hit.part === 'head';
        const dmg = def.damage * (headshot ? def.headshotMultiplier : 1);
        const entry = this.pending.get(hit.zombie);
        if (entry) {
          entry.damage += dmg;
          entry.headshot ||= headshot;
        } else {
          this.pending.set(hit.zombie, { damage: dmg, headshot, point: hit.point });
        }
      } else {
        this.deps.onWorldHit(hit.point, hit.normal);
      }
    }
    // Pellets are aggregated so a shotgun blast counts as one hit per zombie.
    for (const [zombie, h] of this.pending) this.deps.onZombieHit(zombie, h.damage, h.headshot, h.point);
  }
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}
