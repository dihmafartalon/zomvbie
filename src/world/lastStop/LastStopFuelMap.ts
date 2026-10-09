import { DirectionalLight, FogExp2, HemisphereLight, type Scene, Vector3 } from 'three';
import type { AssetLibrary } from '../../assets/AssetLibrary';
import type { GameMap, WallBuySpot } from '../GameMap';
import { MapBuilder } from '../MapBuilder';
import { NavGraph } from '../NavGraph';
import { buildCanopy } from './canopy';
import { buildForecourt } from './forecourt';
import { buildSky, SKY } from './sky';
import { buildStore } from './store';
import { buildSurroundings, HALF } from './surroundings';

/**
 * Map 1 — "Last Stop Fuel": an abandoned roadside gas station at night.
 * Asset-led rebuild: Poly Haven PBR surfaces and props, original signage.
 * Layout (store footprint, doorway, spawns, wall-buys) matches the
 * prototype so collision and navigation stay valid.
 */
export class LastStopFuelMap implements GameMap {
  readonly name = 'Last Stop Fuel';
  readonly root;
  readonly collision;
  readonly nav: NavGraph;
  readonly bulletBlockers;
  readonly zombieSpawns: Vector3[] = [];
  readonly playerSpawn = { position: new Vector3(0, 0, 1.5), yaw: 0 };
  readonly wallBuys: WallBuySpot[] = [];
  readonly menuCamera = { target: new Vector3(0, 2, -4), radius: 21, height: 6.5 };
  /** Strength of the HDRI image-based lighting. */
  readonly environmentIntensity = 0.32;

  private readonly builder: MapBuilder;
  private readonly moon: DirectionalLight;
  private readonly updaters: ((dt: number) => void)[] = [];

  constructor(scene: Scene, assets: AssetLibrary) {
    const b = new MapBuilder(assets);
    this.builder = b;
    this.root = b.root;
    this.collision = b.collision;
    this.bulletBlockers = b.bulletBlockers;

    scene.fog = new FogExp2(SKY.horizon, 0.021);
    this.moon = this.buildLighting();

    buildSky(b.root);
    buildForecourt(b);
    buildCanopy(b);
    buildStore(b, this.wallBuys);
    this.updaters.push(buildSurroundings(b));

    const e = HALF - 2.5;
    for (const [x, z] of [
      [-e, -14], [-e, 0], [-e, 14], [-e, 25],
      [e, -12], [e, 5], [e, 20],
      [-15, e], [0, e], [15, e],
      [-22, -25], [22, -24], [0, -28],
    ]) {
      this.zombieSpawns.push(new Vector3(x, 0, z));
    }

    // Nav nodes ring the store (the only large obstacle) and its doorway.
    this.nav = new NavGraph(this.collision, [
      { x: -9.4, z: 3.7 },
      { x: 9.4, z: 3.7 },
      { x: -9.4, z: 16.3 },
      { x: 9.4, z: 16.3 },
      { x: 0, z: 3.4 },
      { x: 0, z: 6.6 },
      { x: -1, z: 10.8 },
      { x: 1.5, z: 11 },
    ]);

    scene.add(this.root);
  }

  update(dt: number): void {
    this.builder.updateLights(dt);
    for (const u of this.updaters) u(dt);
  }

  setShadowsEnabled(enabled: boolean): void {
    this.moon.castShadow = enabled;
  }

  private buildLighting(): DirectionalLight {
    this.root.add(new HemisphereLight(0x3d4a6b, 0x0b0b0e, 0.25));
    const moon = new DirectionalLight(0xa8b8ff, 0.75);
    moon.position.copy(SKY.moonDir).multiplyScalar(80);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const cam = moon.shadow.camera;
    cam.left = -42;
    cam.right = 42;
    cam.top = 42;
    cam.bottom = -42;
    cam.near = 1;
    cam.far = 200;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.04;
    this.root.add(moon, moon.target);
    return moon;
  }
}
