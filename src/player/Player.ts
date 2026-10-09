import { type PerspectiveCamera, Vector3 } from 'three';
import { PLAYER } from '../config/balance';
import type { FrameInput } from '../core/Input';
import type { CollisionWorld } from '../world/Collision';

const PITCH_LIMIT = Math.PI / 2 - 0.05;

/** First-person character: look, walk/sprint, jump, collision, health. */
export class Player {
  /** Feet position. */
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  yaw = 0;
  pitch = 0;
  health: number = PLAYER.maxHealth;
  onGround = true;
  sprinting = false;
  /** Horizontal speed relative to walk speed (0..~1.5), for view bob. */
  moveAmount = 0;

  private sinceDamage = Infinity;
  private bobPhase = 0;

  constructor(private readonly camera: PerspectiveCamera) {
    camera.rotation.order = 'YXZ';
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  reset(spawn: Vector3, yaw: number): void {
    this.position.copy(spawn);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.health = PLAYER.maxHealth;
    this.sinceDamage = Infinity;
    this.onGround = true;
    this.syncCamera();
  }

  damage(amount: number): void {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    this.sinceDamage = 0;
  }

  /** Weapon recoil nudges the view upward. */
  addRecoil(kick: number): void {
    this.pitch = Math.min(PITCH_LIMIT, this.pitch + kick);
  }

  update(dt: number, input: FrameInput, world: CollisionWorld, aiming: boolean): void {
    // Look.
    this.yaw -= input.lookX;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch - input.lookY));

    // Desired horizontal velocity in world space.
    this.sprinting = input.sprintHeld && input.moveY > 0.3 && !aiming;
    let speed: number = this.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (aiming) speed *= PLAYER.adsSpeedMultiplier;
    let mx = input.moveX;
    let my = input.moveY;
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Forward is -Z rotated by yaw; right is +X rotated by yaw.
    const wishX = (-sin * my + cos * mx) * speed;
    const wishZ = (-cos * my - sin * mx) * speed;
    const accel = this.onGround ? 14 : 3;
    const blend = 1 - Math.exp(-accel * dt);
    this.velocity.x += (wishX - this.velocity.x) * blend;
    this.velocity.z += (wishZ - this.velocity.z) * blend;

    // Vertical.
    if (this.onGround && input.jumpPressed) {
      this.velocity.y = PLAYER.jumpVelocity;
      this.onGround = false;
    }
    this.velocity.y -= PLAYER.gravity * dt;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.onGround = true;
    }
    world.resolveCylinder(this.position, PLAYER.radius, this.position.y + 0.1, this.position.y + PLAYER.height);

    // Health regeneration.
    this.sinceDamage += dt;
    if (!this.isDead && this.sinceDamage > PLAYER.regenDelay) {
      this.health = Math.min(PLAYER.maxHealth, this.health + PLAYER.regenRate * dt);
    }

    const horizontal = Math.hypot(this.velocity.x, this.velocity.z);
    this.moveAmount = this.onGround ? horizontal / PLAYER.walkSpeed : 0;
    this.bobPhase += dt * horizontal * 1.9;
    this.syncCamera();
  }

  syncCamera(): void {
    const bob = Math.sin(this.bobPhase) * 0.04 * Math.min(1, this.moveAmount);
    this.camera.position.set(this.position.x, this.position.y + PLAYER.eyeHeight + bob, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
