import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { ZOMBIE } from '../config/balance';
import type { CollisionWorld, XZ } from '../world/Collision';
import type { NavGraph } from '../world/NavGraph';

export type ZombieState = 'rising' | 'chasing' | 'attacking' | 'dying' | 'dead';
export type HitPart = 'head' | 'body';

/** Data stored on every zombie mesh so raycasts can map hits back to a zombie. */
export interface ZombieHitData {
  zombie: Zombie;
  part: HitPart;
}

export interface ZombieContext {
  readonly playerPos: Vector3;
  readonly world: CollisionWorld;
  readonly nav: NavGraph;
  readonly others: readonly Zombie[];
  /** Called when a swing connects with the player. */
  onStrike(zombie: Zombie): void;
}

const GEO = {
  leg: new BoxGeometry(0.18, 0.85, 0.2),
  torso: new BoxGeometry(0.5, 0.65, 0.28),
  head: new BoxGeometry(0.3, 0.32, 0.3),
  arm: new BoxGeometry(0.13, 0.66, 0.13),
  eye: new BoxGeometry(0.07, 0.04, 0.02),
};
const EYE_MAT = new MeshBasicMaterial({ color: 0xffa21f });
const SKIN = [0x7d8b6a, 0x8a8f78, 0x6f7a63, 0x9a9583];
const SHIRT = [0x3b3f4a, 0x4a3a2c, 0x2e3a2f, 0x5a4d44, 0x3a2f3f, 0x5c2a24];
const PANTS = [0x2a2d33, 0x33302a, 0x22282a, 0x2f2a33];
const HIP_HEIGHT = 0.85;
const ARM_REACH = -1.35;

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

function dampAngle(current: number, target: number, rate: number, dt: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * Math.min(1, rate * dt);
}

/** One zombie: a low-poly rig plus a small chase/attack/death state machine. */
export class Zombie {
  readonly root = new Group();
  /** Meshes that can be shot (head, torso, limbs). */
  readonly hitMeshes: Mesh[] = [];
  readonly maxHealth: number;
  readonly speed: number;
  state: ZombieState = 'rising';
  health: number;
  /** Seconds until this zombie next groans (driven by the manager). */
  groanTimer: number;

  private stateTime = 0;
  private struck = false;
  private walkPhase: number;
  private repathTimer = 0;
  private waypoint: XZ | null = null;
  private stuckTime = 0;
  private sidestepTime = 0;
  private sidestepSign = 1;
  private flash = 0;

  private readonly body = new Group();
  private readonly legL = new Group();
  private readonly legR = new Group();
  private readonly armL = new Group();
  private readonly armR = new Group();
  private readonly head: Mesh;
  private readonly flashMats: MeshStandardMaterial[];
  private readonly ownedMats: MeshStandardMaterial[];

  constructor(spawn: Vector3, health: number, speed: number, rand: () => number = Math.random) {
    this.maxHealth = health;
    this.health = health;
    this.speed = speed * (0.9 + rand() * 0.2);
    this.walkPhase = rand() * Math.PI * 2;
    this.groanTimer = 1 + rand() * 6;

    const skin = new MeshStandardMaterial({ color: pick(SKIN, rand), roughness: 0.9 });
    const shirt = new MeshStandardMaterial({ color: pick(SHIRT, rand), roughness: 0.95 });
    const pants = new MeshStandardMaterial({ color: pick(PANTS, rand), roughness: 0.95 });
    this.flashMats = [skin, shirt];
    this.ownedMats = [skin, shirt, pants];

    const part = (geo: BoxGeometry, mat: MeshStandardMaterial | MeshBasicMaterial, hit: HitPart): Mesh => {
      const mesh = new Mesh(geo, mat);
      mesh.castShadow = true;
      const data: ZombieHitData = { zombie: this, part: hit };
      mesh.userData = data;
      this.hitMeshes.push(mesh);
      return mesh;
    };

    this.root.add(this.body);
    this.body.position.y = HIP_HEIGHT;

    for (const [leg, x] of [[this.legL, -0.12], [this.legR, 0.12]] as const) {
      leg.position.x = x;
      const m = part(GEO.leg, pants, 'body');
      m.position.y = -0.425;
      leg.add(m);
      this.body.add(leg);
    }

    const upper = new Group();
    upper.rotation.x = 0.2 + rand() * 0.15; // hunched forward
    this.body.add(upper);
    const torso = part(GEO.torso, shirt, 'body');
    torso.position.y = 0.325;
    upper.add(torso);

    this.head = part(GEO.head, skin, 'head');
    this.head.position.set(0, 0.82, 0.02);
    this.head.rotation.z = (rand() - 0.5) * 0.4;
    upper.add(this.head);
    for (const x of [-0.07, 0.07]) {
      const eye = part(GEO.eye, EYE_MAT, 'head');
      eye.castShadow = false;
      eye.position.set(x, 0.03, 0.155);
      this.head.add(eye);
    }

    for (const [arm, x] of [[this.armL, -0.32], [this.armR, 0.32]] as const) {
      arm.position.set(x, 0.6, 0);
      arm.rotation.x = ARM_REACH + (rand() - 0.5) * 0.4;
      const m = part(GEO.arm, x < 0 ? skin : shirt, 'body');
      m.position.y = -0.3;
      arm.add(m);
      upper.add(arm);
    }

    this.root.position.set(spawn.x, -1.9, spawn.z);
    this.root.rotation.y = rand() * Math.PI * 2;
  }

  get position(): Vector3 {
    return this.root.position;
  }

  get isAlive(): boolean {
    return this.state !== 'dying' && this.state !== 'dead';
  }

  /** Applies damage. Returns true if this hit killed the zombie. */
  takeDamage(amount: number, headshot: boolean): boolean {
    if (!this.isAlive) return false;
    this.health -= amount;
    this.flash = 1;
    if (this.health > 0) return false;
    this.health = 0;
    if (headshot) this.head.visible = false;
    this.setState('dying');
    return true;
  }

  update(dt: number, ctx: ZombieContext): void {
    this.stateTime += dt;
    switch (this.state) {
      case 'rising':
        this.updateRising();
        break;
      case 'chasing':
        this.updateChasing(dt, ctx);
        break;
      case 'attacking':
        this.updateAttacking(dt, ctx);
        break;
      case 'dying':
        this.updateDying();
        break;
      case 'dead':
        break;
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 6);
      for (const m of this.flashMats) m.emissive.setRGB(this.flash * 0.6, 0, 0);
    }
  }

  dispose(): void {
    for (const m of this.ownedMats) m.dispose();
  }

  private setState(state: ZombieState): void {
    this.state = state;
    this.stateTime = 0;
    this.struck = false;
  }

  private updateRising(): void {
    const t = Math.min(1, this.stateTime / ZOMBIE.riseTime);
    const eased = 1 - Math.pow(1 - t, 3);
    this.root.position.y = -1.9 * (1 - eased);
    this.armL.rotation.x = ARM_REACH - 1.2 * (1 - t);
    this.armR.rotation.x = ARM_REACH - 1.2 * (1 - t);
    if (t >= 1) {
      this.root.position.y = 0;
      this.setState('chasing');
    }
  }

  private updateChasing(dt: number, ctx: ZombieContext): void {
    const p = this.root.position;
    const player = ctx.playerPos;
    const distToPlayer = Math.hypot(player.x - p.x, player.z - p.z);
    if (distToPlayer < ZOMBIE.attackRange) {
      this.setState('attacking');
      return;
    }

    this.repathTimer -= dt;
    if (this.repathTimer <= 0 || !this.waypoint) {
      this.repathTimer = 0.25 + Math.random() * 0.15;
      const wp = ctx.nav.nextWaypoint(p, player);
      // `wp === player` means a straight chase; keep tracking the live position.
      this.waypoint = wp === player ? null : wp;
    }
    const target = this.waypoint ?? player;

    let dirX = target.x - p.x;
    let dirZ = target.z - p.z;
    let len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len;
    dirZ /= len;

    if (this.sidestepTime > 0) {
      this.sidestepTime -= dt;
      const sx = -dirZ * this.sidestepSign;
      const sz = dirX * this.sidestepSign;
      dirX = dirX * 0.3 + sx;
      dirZ = dirZ * 0.3 + sz;
      len = Math.hypot(dirX, dirZ) || 1;
      dirX /= len;
      dirZ /= len;
    }

    // Separation so the horde spreads instead of stacking into one body.
    let sepX = 0;
    let sepZ = 0;
    for (const o of ctx.others) {
      if (o === this || !o.isAlive || o.state === 'rising') continue;
      const dx = p.x - o.root.position.x;
      const dz = p.z - o.root.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.64 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (0.8 - d) / 0.8;
        sepX += (dx / d) * push;
        sepZ += (dz / d) * push;
      }
    }

    const step = this.speed * dt;
    const startX = p.x;
    const startZ = p.z;
    p.x += dirX * step + sepX * dt * 2;
    p.z += dirZ * step + sepZ * dt * 2;
    ctx.world.resolveCylinder(p, ZOMBIE.radius, 0.2, 1.7);

    // Unstick: if we barely moved, strafe sideways for a moment.
    const moved = Math.hypot(p.x - startX, p.z - startZ);
    if (moved < step * 0.3) this.stuckTime += dt;
    else this.stuckTime = Math.max(0, this.stuckTime - dt * 0.5);
    if (this.stuckTime > 0.4) {
      this.stuckTime = 0;
      this.sidestepTime = 0.7 + Math.random() * 0.5;
      this.sidestepSign = Math.random() < 0.5 ? -1 : 1;
    }

    this.root.rotation.y = dampAngle(this.root.rotation.y, Math.atan2(dirX, dirZ), 8, dt);
    this.animateWalk(dt);
  }

  private updateAttacking(dt: number, ctx: ZombieContext): void {
    const p = this.root.position;
    const player = ctx.playerPos;
    const dx = player.x - p.x;
    const dz = player.z - p.z;
    const dist = Math.hypot(dx, dz);
    this.root.rotation.y = dampAngle(this.root.rotation.y, Math.atan2(dx, dz), 10, dt);

    const swing = Math.sin(Math.min(1, this.stateTime / ZOMBIE.attackDuration) * Math.PI);
    this.armL.rotation.x = ARM_REACH - swing * 0.9;
    this.armR.rotation.x = ARM_REACH - swing * 0.7;

    if (!this.struck && this.stateTime >= ZOMBIE.attackWindup) {
      this.struck = true;
      if (dist < ZOMBIE.attackRange + 0.45) ctx.onStrike(this);
    }
    if (this.stateTime >= ZOMBIE.attackDuration) {
      this.setState(dist < ZOMBIE.attackRange ? 'attacking' : 'chasing');
    }
  }

  private updateDying(): void {
    const t = Math.min(1, this.stateTime / 0.55);
    const k = t * t;
    this.body.rotation.x = (-k * Math.PI) / 2;
    // Topple backwards, then sink into the ground during the last second.
    const sink = Math.max(0, this.stateTime - (ZOMBIE.corpseTime - 1)) * 1.2;
    this.root.position.y = -0.7 * k - sink;
    if (this.stateTime > ZOMBIE.corpseTime) this.setState('dead');
  }

  private animateWalk(dt: number): void {
    this.walkPhase += dt * this.speed * 3.2;
    const swing = Math.sin(this.walkPhase) * Math.min(0.7, 0.25 + this.speed * 0.12);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = ARM_REACH + swing * 0.25;
    this.armR.rotation.x = ARM_REACH - swing * 0.25;
    this.body.position.y = HIP_HEIGHT + Math.abs(Math.cos(this.walkPhase)) * 0.04;
  }
}
