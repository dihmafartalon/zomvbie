# DEAD SIGNAL

A browser-based 3D zombie survival FPS inspired by round-based zombies modes.
Built with **Three.js + TypeScript + Vite**. No binary assets yet: geometry,
textures and sound effects are all generated procedurally.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

Append `?touch=1` to the URL to force the mobile touch UI on a desktop browser
(useful for testing; it also skips pointer lock).

## Controls

| Action | Keyboard & mouse | Touch |
| --- | --- | --- |
| Move | WASD / arrows | Left-side floating stick |
| Look | Mouse (pointer lock) | Drag on the right side |
| Fire | Left mouse | FIRE (hold; drag to steer while firing) |
| Aim down sights | Right mouse | AIM (toggle) |
| Reload | R | RELOAD |
| Sprint | Shift | Push stick fully forward |
| Jump | Space | JUMP |
| Buy weapon / ammo | F (or E) | USE |
| Switch weapon | 1 / 2, Q, mouse wheel | SWAP |
| Pause | Esc / P | ❚❚ |

## Architecture

```
src/
  main.ts                 entry point
  core/
    Game.ts               orchestrator: renderer, state machine, system wiring
    Input.ts              device-agnostic FrameInput (keyboard/mouse + virtual touch)
    AudioSystem.ts        procedural WebAudio SFX
    Settings.ts           persisted settings + validation
  config/balance.ts       ALL gameplay tuning (pure data / pure functions)
  player/Player.ts        first-person controller, health/regen
  weapons/
    WeaponDefs.ts         weapon stat table
    WeaponState.ts        ammo / fire-rate / reload bookkeeping (pure)
    WeaponSystem.ts       slots, firing, spread, hitscan, ADS
    ViewModel.ts          first-person gun models + animation (visual only)
  enemies/
    Zombie.ts             zombie rig + chase/attack/death state machine
    ZombieManager.ts      spawning, updates, cleanup
  game/
    RoundManager.ts       round progression (pure)
    Wallet.ts             points (pure)
  world/
    GameMap.ts            interface every map implements
    GasStationMap.ts      Map 1: "Last Stop Fuel"
    Collision.ts          AABB world + cylinder resolution
    NavGraph.ts           visibility-graph path finding
    textures.ts           procedural canvas textures
  effects/Effects.ts      pooled impact/blood particles
  ui/                     HUD, menus, touch controls (DOM overlays from index.html)
tests/                    vitest unit tests for the pure modules
```

Design rules:

- **Systems don't reference each other.** `Game` wires them with callbacks
  (e.g. `WeaponSystem` asks `castRay` and reports `onZombieHit`; it never
  touches zombies or points directly).
- **Gameplay logic is separated from rendering** where practical
  (`WeaponState`, `RoundManager`, `Wallet`, `Collision`, `NavGraph`,
  `balance.ts`) so it can be unit tested in Node.
- **Maps are pluggable** through the `GameMap` interface (collision, nav graph,
  spawns, wall-buys, bullet blockers).
- The weapon view model is rendered in a separate scene after clearing depth,
  so guns never clip into walls.

See [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md) for status and roadmap.
