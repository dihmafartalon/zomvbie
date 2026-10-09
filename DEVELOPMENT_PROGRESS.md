# DEAD SIGNAL — Development Progress

Tracking document for the project. Reviewer: GPT-6 (architecture & code review).

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

- **2026-10-09** — Milestone 1 prototype implemented on `feature/initial-prototype`.
