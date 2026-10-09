import type { WeaponDef } from './WeaponDefs';

/** Ammo, fire-rate and reload bookkeeping for one owned weapon. No rendering. */
export class WeaponState {
  mag: number;
  reserve: number;
  reloading = false;
  private cooldown = 0;
  private reloadTimer = 0;

  constructor(readonly def: WeaponDef) {
    this.mag = def.magSize;
    this.reserve = def.maxReserve;
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }
  }

  get canFire(): boolean {
    return !this.reloading && this.cooldown <= 0 && this.mag > 0;
  }

  get canReload(): boolean {
    return !this.reloading && this.mag < this.def.magSize && this.reserve > 0;
  }

  /** 0..1 while reloading, otherwise null. */
  get reloadProgress(): number | null {
    if (!this.reloading) return null;
    return 1 - Math.max(0, this.reloadTimer) / this.def.reloadTime;
  }

  get ammoFull(): boolean {
    return this.mag === this.def.magSize && this.reserve === this.def.maxReserve;
  }

  /** Consumes one round if the weapon can fire. */
  tryFire(): boolean {
    if (!this.canFire) return false;
    this.mag--;
    this.cooldown = 1 / this.def.fireRate;
    return true;
  }

  startReload(): boolean {
    if (!this.canReload) return false;
    this.reloading = true;
    this.reloadTimer = this.def.reloadTime;
    return true;
  }

  cancelReload(): void {
    this.reloading = false;
    this.reloadTimer = 0;
  }

  refill(): void {
    this.cancelReload();
    this.mag = this.def.magSize;
    this.reserve = this.def.maxReserve;
  }

  private finishReload(): void {
    const take = Math.min(this.def.magSize - this.mag, this.reserve);
    this.mag += take;
    this.reserve -= take;
    this.reloading = false;
    this.reloadTimer = 0;
  }
}
