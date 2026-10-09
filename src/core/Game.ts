import {
  ACESFilmicToneMapping,
  type Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  Timer,
  Vector3,
  WebGLRenderer,
} from 'three';
import { PLAYER, POINTS, ZOMBIE } from '../config/balance';
import { Effects } from '../effects/Effects';
import type { Zombie, ZombieHitData } from '../enemies/Zombie';
import { ZombieManager } from '../enemies/ZombieManager';
import { RoundManager } from '../game/RoundManager';
import { Wallet } from '../game/Wallet';
import { Player } from '../player/Player';
import { HUD } from '../ui/HUD';
import { Menus } from '../ui/Menus';
import { TouchControls } from '../ui/TouchControls';
import { getWeapon, STARTING_WEAPON } from '../weapons/WeaponDefs';
import { ViewModel } from '../weapons/ViewModel';
import { type RayHit, WeaponSystem } from '../weapons/WeaponSystem';
import type { GameMap, WallBuySpot } from '../world/GameMap';
import { GasStationMap } from '../world/GasStationMap';
import { AudioSystem } from './AudioSystem';
import { type FrameInput, Input } from './Input';
import { loadSettings, saveSettings, type Settings } from './Settings';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

const WALL_BUY_RADIUS = 1.6;
const MAX_DT = 1 / 20;

export function detectTouchDevice(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.has('touch')) return params.get('touch') !== '0';
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/**
 * Top-level orchestrator: owns the renderer, the game state machine and the
 * wiring between systems. Systems never reference each other directly; they
 * talk through the callbacks set up here.
 */
export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  /** First-person weapon layer, drawn after the world with a cleared depth buffer. */
  private readonly viewScene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly timer = new Timer();
  private readonly raycaster = new Raycaster();
  private readonly rayTargets: Object3D[] = [];

  private readonly isTouch = detectTouchDevice();
  private readonly settings: Settings;
  private readonly input: Input;
  private readonly audio = new AudioSystem();
  private readonly hud = new HUD();
  private readonly menus: Menus;
  private readonly touch: TouchControls | null;

  private readonly map: GameMap;
  private readonly player: Player;
  private readonly zombies: ZombieManager;
  private readonly rounds: RoundManager;
  private readonly weapons: WeaponSystem;
  private readonly effects: Effects;
  private readonly wallet = new Wallet(PLAYER.startingPoints);

  private state: GameState = 'menu';
  private menuOrbit = 0;
  private fpsSmoothed = 60;
  private readonly stats = { kills: 0, headshots: 0, pointsEarned: 0 };

  constructor(container: HTMLElement) {
    document.body.classList.toggle('touch', this.isTouch);
    this.settings = loadSettings(this.isTouch);

    this.renderer = new WebGLRenderer({ antialias: !this.isTouch, powerPreference: 'high-performance' });
    this.renderer.autoClear = false;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new PerspectiveCamera(this.settings.fov, 1, 0.05, 260);
    this.scene.add(this.camera);

    this.input = new Input(this.renderer.domElement);
    this.touch = this.isTouch ? new TouchControls(this.input) : null;

    this.map = new GasStationMap(this.scene);
    this.player = new Player(this.camera);
    this.effects = new Effects(this.scene);

    this.zombies = new ZombieManager(this.scene, this.map, {
      onStrike: this.onZombieStrike,
      onGroan: (_z, distance) => {
        if (this.state === 'playing' && distance < 28) this.audio.zombieGroan(1 - distance / 28);
      },
    });

    this.rounds = new RoundManager({
      onRoundStart: (round) => {
        this.hud.setRound(round);
        this.hud.showMessage(`ROUND ${round}`, 3);
        this.audio.roundStart();
      },
      onRoundComplete: (round) => {
        this.hud.showMessage(`ROUND ${round} SURVIVED`, 3);
        this.audio.roundEnd();
      },
    });

    const muzzleLight = new PointLight(0xffc070, 0, 9, 2);
    this.scene.add(muzzleLight);
    const viewModel = new ViewModel(this.viewScene);
    this.weapons = new WeaponSystem({
      camera: this.camera,
      viewModel,
      audio: this.audio,
      muzzleLight,
      castRay: this.castRay,
      onZombieHit: this.onZombieHit,
      onWorldHit: (point, normal) => this.effects.impact(point, normal),
      onRecoil: (kick) => this.player.addRecoil(kick),
    });

    this.menus = new Menus(
      {
        play: () => this.startNewGame(),
        resume: () => this.requestPlay(),
        restart: () => this.startNewGame(),
        quit: () => this.quitToMenu(),
        settingsChanged: (s) => {
          this.applySettings(s);
          saveSettings(s);
        },
      },
      this.settings,
    );

    this.applySettings(this.settings);
    this.bindWindowEvents();
    this.onResize();
    this.hud.setVisible(false);
  }

  start(): void {
    this.timer.connect(document);
    this.renderer.setAnimationLoop(this.frame);
  }

  // ---- State transitions --------------------------------------------------------

  private startNewGame(): void {
    this.audio.unlock();
    this.zombies.clear();
    this.effects.clear();
    this.rounds.reset();
    this.wallet.set(PLAYER.startingPoints);
    this.stats.kills = 0;
    this.stats.headshots = 0;
    this.stats.pointsEarned = 0;
    this.player.reset(this.map.playerSpawn.position, this.map.playerSpawn.yaw);
    this.weapons.reset(STARTING_WEAPON);
    this.hud.reset();
    this.hud.setRound(0);
    this.hud.setVisible(true);
    this.input.releaseAll();
    this.state = 'paused';
    this.requestPlay();
  }

  /**
   * Enters (or resumes) play. On desktop, play only begins once pointer lock is
   * granted — see onPointerLockChange — so the mouse is always captured.
   */
  private requestPlay(): void {
    this.audio.unlock();
    if (this.isTouch) {
      this.enterPlaying();
      this.tryFullscreen();
      return;
    }
    this.menus.show('none');
    try {
      const result = this.renderer.domElement.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => this.onPointerLockError());
    } catch {
      this.onPointerLockError();
    }
  }

  private enterPlaying(): void {
    this.state = 'playing';
    this.menus.show('none');
    this.hud.setVisible(true);
    this.touch?.setVisible(true);
    this.input.releaseAll();
    this.timer.reset();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseAll();
    this.touch?.setVisible(false);
    this.menus.show('pause');
    if (this.input.pointerLocked) document.exitPointerLock();
  }

  private gameOver(): void {
    this.state = 'gameover';
    this.touch?.setVisible(false);
    this.hud.setVisible(false);
    this.audio.gameOver();
    if (this.input.pointerLocked) document.exitPointerLock();
    this.menus.showGameOver({
      round: Math.max(0, this.rounds.round - (this.rounds.phase === 'active' ? 1 : 0)),
      kills: this.stats.kills,
      headshots: this.stats.headshots,
      points: this.stats.pointsEarned,
    });
  }

  private quitToMenu(): void {
    this.state = 'menu';
    this.zombies.clear();
    this.effects.clear();
    this.hud.setVisible(false);
    this.touch?.setVisible(false);
    if (this.input.pointerLocked) document.exitPointerLock();
    this.menus.show('main');
  }

  private readonly onPointerLockChange = (): void => {
    if (this.input.pointerLocked) {
      if (this.state === 'paused') this.enterPlaying();
    } else if (this.state === 'playing') {
      this.pause();
    }
  };

  private onPointerLockError(): void {
    // Browsers refuse re-locking for ~1s after Esc; let the player click again.
    if (this.state === 'paused') {
      this.menus.show('pause');
      this.menus.setPauseHint('Click Resume to capture the mouse.');
    }
  }

  // ---- Frame loop ------------------------------------------------------------------

  private readonly frame = (time: number): void => {
    this.timer.update(time);
    const rawDt = this.timer.getDelta();
    const dt = Math.min(rawDt, MAX_DT);
    if (rawDt > 0) this.fpsSmoothed += (1 / rawDt - this.fpsSmoothed) * 0.05;

    if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'menu') this.updateMenuCamera(dt);

    this.map.update(dt);
    this.effects.update(dt);
    this.hud.update(dt);
    this.hud.setFps(this.settings.showFps ? this.fpsSmoothed : null);
    this.render();
  };

  private updatePlaying(dt: number): void {
    const input = this.input.consume();
    if (input.pausePressed) {
      this.pause();
      return;
    }

    this.player.update(dt, input, this.map.collision, this.weapons.isAiming);
    this.weapons.update(dt, input, this.player.moveAmount);
    this.updateInteraction(input);

    const spawns = this.rounds.update(dt, this.zombies.aliveCount);
    for (let i = 0; i < spawns; i++) this.zombies.spawn(this.rounds.round, this.player.position);
    this.zombies.update(dt, this.player.position);

    this.updateCameraFov();
    this.updateHud();

    if (this.player.isDead) this.gameOver();
  }

  private updateMenuCamera(dt: number): void {
    const { target, radius, height } = this.map.menuCamera;
    this.menuOrbit += dt * 0.05;
    this.camera.position.set(
      target.x + Math.cos(this.menuOrbit) * radius,
      height,
      target.z + Math.sin(this.menuOrbit) * radius,
    );
    this.camera.lookAt(target);
  }

  private updateCameraFov(): void {
    const zoom = this.weapons.current.def.adsZoom;
    const fov = this.settings.fov * (1 + (zoom - 1) * this.weapons.aimAmount);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private updateHud(): void {
    const w = this.weapons.current;
    this.hud.setPoints(this.wallet.points);
    this.hud.setWeapon(w.def.name, w.mag, w.reserve, w.def.magSize, w.reloading);
    this.hud.setHealth(this.player.health / PLAYER.maxHealth);
    const hipSpread = w.def.hipSpread * (1 + Math.min(1, this.player.moveAmount) * 0.6);
    this.hud.setCrosshair(this.weapons.aimAmount < 0.5, hipSpread);
  }

  private render(): void {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.state !== 'menu') {
      this.renderer.clearDepth();
      this.renderer.render(this.viewScene, this.camera);
    }
  }

  // ---- Combat wiring -----------------------------------------------------------------

  private readonly castRay = (origin: Vector3, dir: Vector3, range: number): RayHit | null => {
    this.raycaster.set(origin, dir);
    this.raycaster.far = range;
    const targets = this.rayTargets;
    targets.length = 0;
    for (const b of this.map.bulletBlockers) targets.push(b);
    for (const z of this.zombies.getHittables()) targets.push(z);
    const hit = this.raycaster.intersectObjects(targets, true)[0];
    if (!hit) return null;
    const data = hit.object.userData as Partial<ZombieHitData>;
    const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null;
    return { point: hit.point, normal, zombie: data.zombie ?? null, part: data.part ?? 'body' };
  };

  private readonly onZombieHit = (zombie: Zombie, damage: number, headshot: boolean, point: Vector3): void => {
    if (!zombie.isAlive) return;
    const killed = zombie.takeDamage(damage, headshot);
    this.effects.blood(point);
    this.hud.hit(killed);
    this.audio.hitmarker(killed);
    if (killed) {
      this.stats.kills++;
      if (headshot) this.stats.headshots++;
      this.earn(headshot ? POINTS.headshotKill : POINTS.kill);
    } else {
      this.earn(POINTS.hit);
    }
  };

  private readonly onZombieStrike = (): void => {
    if (this.state !== 'playing') return;
    this.player.damage(ZOMBIE.attackDamage);
    this.hud.damage();
    this.audio.zombieAttack();
    this.audio.playerHurt();
  };

  private earn(points: number): void {
    this.wallet.add(points);
    this.stats.pointsEarned += points;
    this.hud.popup(points);
  }

  // ---- Wall-buys ----------------------------------------------------------------------

  private updateInteraction(input: FrameInput): void {
    const spot = this.nearestWallBuy();
    if (!spot) {
      this.hud.setPrompt(null);
      return;
    }
    const def = getWeapon(spot.weaponId);
    const owned = this.weapons.find(spot.weaponId);
    const action = this.isTouch ? 'Tap USE' : 'Press F';
    const cost = owned ? def.ammoPrice : def.price;
    if (owned && owned.ammoFull) {
      this.hud.setPrompt(`${def.name} — ammo full`);
    } else {
      this.hud.setPrompt(`${action} to buy ${owned ? `${def.name} ammo` : def.name} [${cost}]`);
    }
    if (!input.interactPressed || (owned && owned.ammoFull)) return;

    if (!this.wallet.spend(cost)) {
      this.audio.denied();
      return;
    }
    this.hud.popup(-cost);
    this.audio.purchase();
    if (owned) owned.refill();
    else this.weapons.give(spot.weaponId);
  }

  private nearestWallBuy(): WallBuySpot | null {
    const p = this.player.position;
    let best: WallBuySpot | null = null;
    let bestDist = WALL_BUY_RADIUS;
    for (const spot of this.map.wallBuys) {
      const d = Math.hypot(spot.position.x - p.x, spot.position.z - p.z);
      if (d < bestDist) {
        best = spot;
        bestDist = d;
      }
    }
    return best;
  }

  // ---- Settings & window ----------------------------------------------------------------

  private applySettings(s: Settings): void {
    this.input.mouseSensitivity = s.mouseSensitivity;
    this.input.touchSensitivity = s.touchSensitivity;
    this.input.invertY = s.invertY;
    this.audio.setVolume(s.masterVolume);
    const high = s.quality === 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1));
    this.map.setShadowsEnabled(high);
    if (this.state !== 'playing') {
      this.camera.fov = s.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private bindWindowEvents(): void {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', () => this.onPointerLockError());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
  }

  private readonly onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private tryFullscreen(): void {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => {
        const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        return orientation.lock?.('landscape');
      })
      .catch(() => {
        // Fullscreen / orientation lock are best-effort (unsupported on iOS Safari).
      });
  }
}
