# DEAD SIGNAL — Development Progress

Tracking document for the project. Reviewer: GPT-6 (architecture & code review).

## Experience Overhaul (branch `feature/experience-overhaul`)

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Rebuild Last Stop Fuel with licensed assets and PBR materials | ✅ Done, awaiting review |
| 2 | First-person feel: movement, camera, weapons, ADS, recoil, HUD, shotgun aggregation fix | ⏳ Next |
| 3 | Rigged, animated zombies; navigation and crowd spacing | ⏳ |
| 4 | Audio and atmosphere (licensed SFX, ambience, music, volume buses) | ⏳ |
| 5 | Performance: texture compression, LOD, mobile budgets | ⏳ (draw-call/FPS readout already added) |

### Phase 1: Last Stop Fuel rebuild ✅

**Asset sourcing.** All third-party content is CC0 from Poly Haven and is
listed with authors and links in [ASSETS.md](ASSETS.md). That file is generated
from `tools/assets/manifest.mjs`.

- 22 models: covered cars, concrete barriers, steel shelving, cash register,
  security lights, fluorescent fixtures, roller shutters (plain and graffiti),
  utility box, AC units, trash cans and bags, barrels, propane, generator,
  hydrant, manholes, and the chain-link fence kit.
- 11 PBR texture sets: two asphalts, two concretes, painted brick, plaster,
  linoleum, corrugated iron, painted metal, rusted metal, forest ground.
- 1 night HDRI (`kloppenheim_02`), used for image-based lighting and reflections.
- **Quaternius Zombie Apocalypse Kit:** this is the planned source for rigged
  zombies and weapon models in Phases 2–3. Its Google Drive host returned
  "quota exceeded" for most files, so it isn't integrated yet. I'll retry, and
  Poly Pizza is a fallback mirror.
- **Rejected:** Poly Haven trees (7–17M triangles, 0.5–1 GB each) and the
  Victorian street lamps (wrong period).

**Asset pipeline.** `npm run assets` handles everything:
- Downloads to `.asset-cache/` (gitignored).
- Simplifies heavy meshes with meshoptimizer (e.g. hydrant 86k → 8k
  triangles, fence 89k → 23k).
- Converts textures to WebP and caps their resolution per asset.
- Applies meshopt compression and writes GLBs to `public/assets/`.
- Shipped total: about 13 MB (5.0 MB models, 5.6 MB textures, 1.7 MB HDRI).

**Runtime.**
- `src/assets/AssetLibrary.ts` preloads everything, drives a progress bar, and
  decodes meshopt.
- It extracts single variants from multi-variant source files and re-pivots
  models onto the ground.
- It rescales models whose authored units are wrong. The shelf asset is
  authored at 10× scale.
- If an asset fails, the game keeps running: a magenta placeholder appears and
  a corner notice lists the failures.

**Map structure.**
- `world/MapBuilder.ts` provides real-world UV tiling, prop placement that
  registers collision and bullet blocking, and budgeted flickering lights.
- `world/lastStop/` holds one module per area: `forecourt`, `canopy`, `store`,
  `surroundings`, `sky`, plus the `LastStopFuelMap` compositor.
- The old single-file `GasStationMap.ts` is removed.
- Gameplay layout is unchanged: store footprint, doorway, nav nodes, spawns and
  wall-buy positions. Collision and pathfinding therefore stay valid.

**What changed visually** (screenshots in `docs/screenshots/phase1/`, same
camera positions before and after):
- **Forecourt:** cracked PBR asphalt with oil stains, glossy puddles that catch
  the lights, road paint, kerbs, and a store apron.
- **Canopy:** damaged corrugated fascia with a torn-off and hanging panel, a lit
  "LAST STOP" brand sign with a dead letter, recessed light panels (two dead,
  one flickering), and weathered columns with hazard collars.
- **Pumps:** modelled dispensers with rounded cabinets, weathered paint, lit or
  cracked displays, holsters, nozzles and drooping hoses.
- **Store exterior:** painted brick, graffiti roller shutters, a lit box sign
  with a dead letter, an aluminium door hanging open, sodium security lights,
  and a service yard with AC units, a utility box, bins, propane and a generator.
- **Store interior:** painted block walls, linoleum floor, steel shelving with
  stock and a toppled unit, a counter with a vintage register, glowing fridges,
  and flickering fluorescents.
- **Storytelling details:** evacuation notices, missing-person flyers, and
  "THEY COME AT NIGHT" scrawled inside.
- **Surroundings:** an instanced chain-link perimeter, highway roadblocks
  where the road leaves the arena (one shoved aside), a pylon price sign with
  dead digits and a smashed corner, power lines receding into fog, covered
  abandoned cars, a burn barrel, and a sodium lot light.
- **Sky:** a gradient dome matched to the fog with faint distant-town light
  pollution, a starfield, a moon with a halo, and a two-layer treeline
  silhouette.
- **Readability:** wall-buys now sit on slate backing boards so the chalk reads
  on any wall.
- **Touch layout:** points and ammo moved to the top-left, and the touch
  buttons compact on short landscape phones. The old layout overlapped on
  phones.

**Performance readout.** Settings → Show FPS now shows FPS, draw calls and
triangles, counted across both render passes.

### Phase 1 verification (2026-10-09)

- **Automated:** `npm run build` (strict TypeScript + Vite) passes, and
  `npm test` passes 34 tests, including new UV-tiling tests.
- **Browser:** headless Edge on the real GPU (NVIDIA RTX 5070, D3D11). A bot
  aims at the nearest zombie's head and fires through the real input and
  hit-detection path, alternating rounds between the forecourt and the store
  interior.

| Run | Result | Avg FPS* | Min FPS | Peak draw calls | Peak triangles |
| --- | --- | --- | --- | --- | --- |
| Desktop 1920×1080, High (shadows) | Rounds 1–5 cleared, 69 kills, zombies reached the bot inside the store | 364 | 112 | 833 | 882k |
| Phone landscape (iPhone 13 emulation), Low | Rounds 1–2 cleared | 362 | 124 | 499 | 551k |
| Static views, High, no zombies | — | — | — | 193 | 204k |

\* Uncapped headless frame rate on a desktop GPU. **This does not reflect
real phone hardware**, which still needs testing on a device.

**Also verified:**
- Loading screen and progress.
- Main menu over the orbiting map.
- Pause → settings → resume.
- Wall-buy prompt and purchase.
- Reload.
- Phone and tablet touch layouts.
- No console errors. The only output is an ANGLE/D3D shader-compiler precision
  notice (X4122) that comes from Three.js shaders on Direct3D and is harmless.

### Known limitations after Phase 1

- **Draw calls with a full horde.** Placeholder zombies are 9 meshes each, so
  24 of them plus the shadow pass produce ~800 draw calls. Phase 3 (skinned
  zombies with shared materials) and Phase 5 (shadow-caster culling, Low-preset
  budgets) target this.
- **Weapon view models** are still primitive placeholders (Phase 2).
- **Mobile performance** is unmeasured on real hardware. The Low preset
  disables shadows and caps pixel ratio at 1. No KTX2 GPU texture compression
  yet (Phase 5).
- **Collision boxes for rotated props** are axis-aligned and slightly generous.
- **Zombies treat the store as the only path-finding obstacle.** Cars and
  props are handled by sliding (Phase 3).
- **Fridge glass** is a flat emissive panel with no product detail.

## Milestone 1 — First playable prototype ✅ (branch `feature/initial-prototype`)

| # | Goal | Status | Where |
| --- | --- | --- | --- |
| 1 | Three.js + TypeScript + Vite project | ✅ | `package.json`, `tsconfig.json`, `vite.config.ts` |
| 2 | Playable first-person controller | ✅ | `src/player/Player.ts` |
| 3 | Map 1: abandoned gas station at night | ✅ | `src/world/GasStationMap.ts` |
| 4 | Zombie AI, spawning, round progression | ✅ | `src/enemies/*`, `src/game/RoundManager.ts`, `src/world/NavGraph.ts` |
| 5 | Weapons: shooting, reloading, hit detection | ✅ | `src/weapons/*` |
| 6 | Mouse & keyboard controls | ✅ | `src/core/Input.ts` |
| 7 | Mobile touch controls | ✅ | `src/ui/TouchControls.ts` |
| 8 | Main, pause and settings menus (+ game over) | ✅ | `index.html`, `src/ui/Menus.ts` |
| 9 | Health, ammo, points, round counter HUD | ✅ | `src/ui/HUD.ts` |
| 10 | Build, test, fix errors | ✅ | see *Verification* below |

### What's in the build

- **Map "Last Stop Fuel"**: pump canopy with flickering lights, enterable
  convenience store (doorway, shelves, counter, glowing fridges, fluorescent
  flicker), road with wrecks, roadside sign, lamp post, dumpster, barrels,
  chain-link perimeter, treeline, moon and stars, fog.
- **Player**: walk / sprint / jump, ADS slow-down, wall sliding, head bob,
  health regen after 4 s without damage.
- **Weapons (4)**: P-9 Warden pistol (start), Vex SMG (1000), Breacher-12
  shotgun (1500), Longwatch AR (1200). Hitscan with spread cone, headshot
  multipliers, shotgun pellets aggregated per zombie, recoil, ADS zoom,
  reload (manual + automatic), 2 weapon slots, chalk wall-buys with ammo refills.
- **Zombies**: rise from the ground, chase via a visibility-graph nav (routes
  around the store and through its door), unstick sidestepping, separation,
  windup melee, hit flash, headshot kills remove the head, topple & sink.
- **Rounds**: COD-style health curve (+100/round to 9, then ×1.1), growing
  counts, sprinters from round 3, 24 active-zombie cap, intermissions.
- **Points**: +10 hit, +60 kill, +100 headshot kill, 500 start.
- **UI**: main menu over an orbiting camera, pause, settings (mouse/touch
  sensitivity, FOV, volume, graphics quality, invert Y, FPS counter; saved to
  localStorage), game-over summary, round banner, hit markers, point popups,
  damage vignette, interaction prompts.
- **Mobile**: floating move stick, drag-look, fire-and-drag, toggle ADS,
  fullscreen + landscape lock attempt, portrait "rotate device" overlay, safe-area
  insets, low quality preset by default.
- **Audio**: procedural WebAudio SFX for guns, reloads, hits, groans,
  attacks, purchases and round transitions.

### Verification (2026-10-09)

- `npm run build` — TypeScript strict typecheck + Vite production build pass.
- `npm test` — 32 unit tests pass (balance curves, round manager, weapon
  state, collision, nav graph, wallet, settings validation).
- Browser smoke test (Edge, software WebGL, touch mode to skip pointer lock):
  menu renders; game starts; round 1 begins and zombies rise and chase;
  hip-fire body hit (+10); ADS headshot kill (+100); reload; wall-buy purchase
  (−1000, weapon swapped in); pause → settings → resume; zombie melee damages
  the player; game over screen. **No console errors or warnings.**
- Not yet verified on real mobile hardware or in Firefox/Safari.

### Known limitations / tuning backlog

- Zombies can only enter the store through the door; small props are handled
  by sliding + sidestep rather than true path-finding, so a zombie can briefly
  hug a car corner.
- Zombies are dark silhouettes away from lights. That suits the mood, but
  readability needs a playtest pass.
- Collision is XZ-only: the player can't stand on props (no step-up).
- Hitscan only; no bullet penetration, no damage falloff.
- All art and audio is procedural placeholder. No music yet.
- Bundle is ~610 kB (157 kB gzip), mostly Three.js; code-splitting is not set up yet.

## Roadmap (proposed, pending architect review)

1. **Milestone 2 — Core loop depth**: barriers/windows zombies tear through and
   players rebuild (+points), perks, mystery box, Pack-a-Punch upgrades,
   power switch, melee (knife), grenades, max ammo / insta-kill / double points
   drops, downed state.
2. **Weapons to 16+**: data-driven additions to `WeaponDefs.ts`, plus new
   view models and per-weapon audio.
3. **Maps 2 & 3** implementing `GameMap`; shared prop library; map select.
4. **Audio**: original music system (round stingers, ambient beds), positional
   3D audio for zombies.
5. **Progressive difficulty**: special zombie types, boss rounds.
6. **Tech**: glTF asset pipeline, instancing/merging for static props,
   code-splitting, mobile performance profiling, GitHub Pages deploy (on approval).

## Changelog

- **2026-10-09** — Experience overhaul Phase 1: Last Stop Fuel rebuilt with CC0 Poly Haven assets, asset pipeline, loading screen, perf readout.
- **2026-10-09** — Milestone 1 prototype implemented on `feature/initial-prototype`.
