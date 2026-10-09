/**
 * Third-party asset manifest. Every asset shipped in public/assets must be
 * listed here with its source and license; `npm run assets` downloads,
 * optimizes and writes ASSETS.md (the attribution/license record) from it.
 *
 * Model options:
 *   simplify    - target triangle ratio for meshoptimizer (1 = untouched)
 *   texSize     - max texture edge in px (textures are converted to WebP)
 */

const POLYHAVEN_LICENSE = { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };

/** Poly Haven models (glTF, 1k source textures). */
export const polyhavenModels = [
  { id: 'covered_car', simplify: 1, texSize: 1024, use: 'Abandoned vehicles' },
  { id: 'concrete_road_barrier_02', simplify: 0.15, texSize: 512, use: 'Road blocks' },
  { id: 'utility_box_02', simplify: 1, texSize: 512, use: 'Store exterior electrical box' },
  { id: 'exterior_aircon_unit', simplify: 0.3, texSize: 512, use: 'Store exterior AC units' },
  { id: 'metal_trash_can', simplify: 0.3, texSize: 512, use: 'Trash cans' },
  { id: 'trashbag', simplify: 0.5, texSize: 512, use: 'Garbage piles' },
  { id: 'cardboard_box_01', simplify: 0.1, texSize: 512, use: 'Clutter' },
  { id: 'old_tyre', simplify: 1, texSize: 512, use: 'Tyre stacks' },
  { id: 'Barrel_01', simplify: 1, texSize: 512, use: 'Hazard barrels' },
  { id: 'barrel_03', simplify: 1, texSize: 512, use: 'Barrels' },
  { id: 'propane_tank', simplify: 0.5, texSize: 512, use: 'Propane exchange cage' },
  { id: 'portable_generator', simplify: 0.3, texSize: 512, use: 'Generator landmark' },
  { id: 'steel_frame_shelves_01', simplify: 1, texSize: 512, use: 'Store aisles' },
  { id: 'CashRegister_01', simplify: 0.5, texSize: 512, use: 'Store counter' },
  { id: 'WetFloorSign_01', simplify: 1, texSize: 256, use: 'Store clutter' },
  { id: 'security_light', simplify: 0.5, texSize: 512, use: 'Wall / pole flood lights' },
  { id: 'mounted_fluorescent_lights', simplify: 0.25, texSize: 256, use: 'Store ceiling lights' },
  { id: 'rollershutter_door', simplify: 1, texSize: 1024, use: 'Store rear door' },
  { id: 'rollershutter_window_01', simplify: 1, texSize: 1024, use: 'Shuttered store windows' },
  { id: 'fire_hydrant', simplify: 0.08, texSize: 512, use: 'Roadside hydrant' },
  { id: 'water_manhole_cover', simplify: 0.3, texSize: 512, use: 'Lot detail' },
  { id: 'modular_chainlink_fence', simplify: 0.25, texSize: 1024, use: 'Perimeter fence' },
];

/** Poly Haven PBR texture sets (diffuse, OpenGL normal, AO/rough/metal). */
export const polyhavenTextures = [
  { id: 'asphalt_02', texSize: 1024, use: 'Forecourt asphalt' },
  { id: 'aerial_asphalt_01', texSize: 1024, use: 'Highway' },
  { id: 'concrete_floor_worn_001', texSize: 1024, use: 'Pump islands, curbs' },
  { id: 'dirty_concrete', texSize: 1024, use: 'Store apron, slab' },
  { id: 'painted_worn_brick', texSize: 1024, use: 'Store exterior walls' },
  { id: 'plastered_wall_05', texSize: 1024, use: 'Store interior walls' },
  { id: 'old_linoleum_flooring_01', texSize: 1024, use: 'Store floor' },
  { id: 'corrugated_iron_02', texSize: 1024, use: 'Canopy fascia, roof edges' },
  { id: 'painted_metal_shutter', texSize: 1024, use: 'Canopy soffit' },
  { id: 'green_metal_rust', texSize: 1024, use: 'Painted metal (pumps, dumpster)' },
  { id: 'forest_ground_04', texSize: 1024, use: 'Dirt shoulder beyond the lot' },
];

/** Poly Haven HDRIs. */
export const polyhavenHdris = [{ id: 'kloppenheim_02', res: '1k', use: 'Night sky + image-based lighting' }];

export const licenses = { polyhaven: POLYHAVEN_LICENSE };
