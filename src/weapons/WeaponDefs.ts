export type WeaponModel = 'pistol' | 'smg' | 'shotgun' | 'rifle';

export interface WeaponDef {
  readonly id: string;
  readonly name: string;
  readonly model: WeaponModel;
  /** Damage per pellet (per bullet for single-projectile weapons). */
  readonly damage: number;
  readonly headshotMultiplier: number;
  readonly pellets: number;
  /** Shots per second. */
  readonly fireRate: number;
  readonly automatic: boolean;
  readonly magSize: number;
  readonly maxReserve: number;
  /** Seconds. */
  readonly reloadTime: number;
  /** Cone half-angle in radians when firing from the hip. */
  readonly hipSpread: number;
  /** Cone half-angle in radians when aiming down sights. */
  readonly adsSpread: number;
  readonly range: number;
  /** Camera pitch kick per shot, radians. */
  readonly recoil: number;
  /** Field-of-view multiplier while aiming. */
  readonly adsZoom: number;
  /** Wall-buy price (0 = not purchasable). */
  readonly price: number;
  readonly ammoPrice: number;
}

export const WEAPONS = {
  p9: {
    id: 'p9',
    name: 'P-9 Warden',
    model: 'pistol',
    damage: 50,
    headshotMultiplier: 3,
    pellets: 1,
    fireRate: 6,
    automatic: false,
    magSize: 8,
    maxReserve: 64,
    reloadTime: 1.4,
    hipSpread: 0.025,
    adsSpread: 0.006,
    range: 60,
    recoil: 0.02,
    adsZoom: 0.85,
    price: 0,
    ammoPrice: 250,
  },
  vex: {
    id: 'vex',
    name: 'Vex SMG',
    model: 'smg',
    damage: 38,
    headshotMultiplier: 2,
    pellets: 1,
    fireRate: 11,
    automatic: true,
    magSize: 32,
    maxReserve: 160,
    reloadTime: 2.0,
    hipSpread: 0.045,
    adsSpread: 0.018,
    range: 40,
    recoil: 0.012,
    adsZoom: 0.8,
    price: 1000,
    ammoPrice: 500,
  },
  breacher: {
    id: 'breacher',
    name: 'Breacher-12',
    model: 'shotgun',
    damage: 26,
    headshotMultiplier: 1.5,
    pellets: 9,
    fireRate: 1.3,
    automatic: false,
    magSize: 6,
    maxReserve: 42,
    reloadTime: 2.6,
    hipSpread: 0.09,
    adsSpread: 0.06,
    range: 18,
    recoil: 0.07,
    adsZoom: 0.85,
    price: 1500,
    ammoPrice: 750,
  },
  longwatch: {
    id: 'longwatch',
    name: 'Longwatch AR',
    model: 'rifle',
    damage: 70,
    headshotMultiplier: 2.5,
    pellets: 1,
    fireRate: 7.5,
    automatic: true,
    magSize: 30,
    maxReserve: 180,
    reloadTime: 2.3,
    hipSpread: 0.035,
    adsSpread: 0.004,
    range: 90,
    recoil: 0.016,
    adsZoom: 0.7,
    price: 1200,
    ammoPrice: 600,
  },
} as const satisfies Record<string, WeaponDef>;

export type WeaponId = keyof typeof WEAPONS;

export const STARTING_WEAPON: WeaponId = 'p9';

export function getWeapon(id: string): WeaponDef {
  const def = (WEAPONS as Record<string, WeaponDef>)[id];
  if (!def) throw new Error(`Unknown weapon id: ${id}`);
  return def;
}
