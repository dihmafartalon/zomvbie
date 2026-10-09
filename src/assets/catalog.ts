/**
 * Runtime catalog of the optimized assets produced by `npm run assets`
 * (see tools/assets/manifest.mjs and ASSETS.md for sources and licenses).
 */

export interface ModelEntry {
  readonly file: string;
  /**
   * Real-world height in metres (from the source asset's documented
   * dimensions). Instances whose authored height is off by more than 25% are
   * rescaled to it, which guards against unit mistakes in source files.
   */
  readonly height?: number;
}

export const MODELS = {
  covered_car: { file: 'models/covered_car.glb', height: 1.41 },
  concrete_barrier: { file: 'models/concrete_road_barrier_02.glb', height: 1.11 },
  utility_box: { file: 'models/utility_box_02.glb', height: 1.12 },
  aircon: { file: 'models/exterior_aircon_unit.glb', height: 0.93 },
  trash_can: { file: 'models/metal_trash_can.glb', height: 0.91 },
  trashbag: { file: 'models/trashbag.glb', height: 0.57 },
  cardboard_box: { file: 'models/cardboard_box_01.glb', height: 0.34 },
  tyre: { file: 'models/old_tyre.glb', height: 0.6 },
  barrel_hazard: { file: 'models/Barrel_01.glb', height: 0.88 },
  barrel_blue: { file: 'models/barrel_03.glb', height: 0.93 },
  propane_tank: { file: 'models/propane_tank.glb', height: 0.55 },
  generator: { file: 'models/portable_generator.glb', height: 0.58 },
  shelves: { file: 'models/steel_frame_shelves_01.glb', height: 2.14 },
  cash_register: { file: 'models/CashRegister_01.glb', height: 0.62 },
  wet_floor_sign: { file: 'models/WetFloorSign_01.glb', height: 0.63 },
  security_light: { file: 'models/security_light.glb', height: 0.53 },
  fluorescent: { file: 'models/mounted_fluorescent_lights.glb' },
  shutter_door: { file: 'models/rollershutter_door.glb', height: 2.4 },
  shutter_window: { file: 'models/rollershutter_window_01.glb', height: 1.85 },
  hydrant: { file: 'models/fire_hydrant.glb', height: 0.8 },
  manhole: { file: 'models/water_manhole_cover.glb' },
  fence_kit: { file: 'models/modular_chainlink_fence.glb' },
} as const satisfies Record<string, ModelEntry>;

export type ModelKey = keyof typeof MODELS;

export const TEXTURE_SETS = [
  'asphalt_02',
  'aerial_asphalt_01',
  'concrete_floor_worn_001',
  'dirty_concrete',
  'painted_worn_brick',
  'plastered_wall_05',
  'old_linoleum_flooring_01',
  'corrugated_iron_02',
  'painted_metal_shutter',
  'green_metal_rust',
  'forest_ground_04',
] as const;

export type TextureSetKey = (typeof TEXTURE_SETS)[number];

export const HDRI = 'hdri/kloppenheim_02_1k.hdr';
