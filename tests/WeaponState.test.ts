import { describe, expect, it } from 'vitest';
import { getWeapon, WEAPONS } from '../src/weapons/WeaponDefs';
import { WeaponState } from '../src/weapons/WeaponState';

describe('WeaponState', () => {
  const pistol = getWeapon('p9');

  it('starts full', () => {
    const w = new WeaponState(pistol);
    expect(w.mag).toBe(pistol.magSize);
    expect(w.reserve).toBe(pistol.maxReserve);
    expect(w.ammoFull).toBe(true);
  });

  it('fires once per cooldown and consumes ammo', () => {
    const w = new WeaponState(pistol);
    expect(w.tryFire()).toBe(true);
    expect(w.tryFire()).toBe(false);
    w.update(1 / pistol.fireRate + 0.001);
    expect(w.tryFire()).toBe(true);
    expect(w.mag).toBe(pistol.magSize - 2);
  });

  it('cannot fire with an empty magazine', () => {
    const w = new WeaponState(pistol);
    w.mag = 0;
    expect(w.tryFire()).toBe(false);
  });

  it('reload moves rounds from reserve after reloadTime', () => {
    const w = new WeaponState(pistol);
    w.mag = 3;
    expect(w.startReload()).toBe(true);
    expect(w.tryFire()).toBe(false);
    w.update(pistol.reloadTime / 2);
    expect(w.mag).toBe(3);
    w.update(pistol.reloadTime);
    expect(w.mag).toBe(pistol.magSize);
    expect(w.reserve).toBe(pistol.maxReserve - (pistol.magSize - 3));
    expect(w.reloading).toBe(false);
  });

  it('partial reload when reserve is short', () => {
    const w = new WeaponState(pistol);
    w.mag = 0;
    w.reserve = 2;
    w.startReload();
    w.update(pistol.reloadTime + 0.01);
    expect(w.mag).toBe(2);
    expect(w.reserve).toBe(0);
  });

  it('refuses pointless reloads', () => {
    const w = new WeaponState(pistol);
    expect(w.startReload()).toBe(false);
    w.mag = 0;
    w.reserve = 0;
    expect(w.startReload()).toBe(false);
  });

  it('cancelReload keeps ammo unchanged', () => {
    const w = new WeaponState(pistol);
    w.mag = 1;
    w.startReload();
    w.cancelReload();
    w.update(10);
    expect(w.mag).toBe(1);
  });

  it('refill restores everything', () => {
    const w = new WeaponState(pistol);
    w.mag = 0;
    w.reserve = 0;
    w.refill();
    expect(w.ammoFull).toBe(true);
  });

  it('every weapon definition is sane', () => {
    for (const def of Object.values(WEAPONS)) {
      expect(def.magSize).toBeGreaterThan(0);
      expect(def.fireRate).toBeGreaterThan(0);
      expect(def.pellets).toBeGreaterThanOrEqual(1);
      expect(def.adsSpread).toBeLessThanOrEqual(def.hipSpread);
      expect(def.adsZoom).toBeLessThanOrEqual(1);
    }
    expect(() => getWeapon('nope')).toThrow();
  });
});
