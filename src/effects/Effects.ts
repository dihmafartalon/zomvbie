import { BoxGeometry, Mesh, MeshBasicMaterial, type Scene, Vector3 } from 'three';

interface Particle {
  mesh: Mesh;
  vel: Vector3;
  life: number;
  maxLife: number;
  size: number;
}

const POOL_SIZE = 160;
const GRAVITY = 9;

/** Pooled particle bursts for bullet impacts and blood. */
export class Effects {
  private readonly free: Mesh[] = [];
  private readonly active: Particle[] = [];
  private readonly mats = {
    spark: new MeshBasicMaterial({ color: 0xffd27a }),
    dust: new MeshBasicMaterial({ color: 0x6d6a62 }),
    blood: new MeshBasicMaterial({ color: 0x5a0a08 }),
  };

  constructor(private readonly scene: Scene) {
    const geo = new BoxGeometry(1, 1, 1);
    for (let i = 0; i < POOL_SIZE; i++) {
      const m = new Mesh(geo, this.mats.dust);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.free.push(m);
    }
  }

  impact(point: Vector3, normal: Vector3 | null): void {
    const n = normal ?? new Vector3(0, 1, 0);
    for (let i = 0; i < 6; i++) {
      this.emit(point, n, i < 2 ? this.mats.spark : this.mats.dust, 2.5, 0.05, 0.35);
    }
  }

  blood(point: Vector3): void {
    for (let i = 0; i < 9; i++) this.emit(point, null, this.mats.blood, 2.2, 0.07, 0.5);
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.free.push(p.mesh);
        this.active.splice(i, 1);
        continue;
      }
      p.vel.y -= GRAVITY * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02;
        p.vel.set(0, 0, 0);
      }
      p.mesh.scale.setScalar(p.size * (p.life / p.maxLife));
    }
  }

  clear(): void {
    for (const p of this.active) {
      p.mesh.visible = false;
      this.free.push(p.mesh);
    }
    this.active.length = 0;
  }

  dispose(): void {
    this.clear();
    for (const m of this.free) this.scene.remove(m);
  }

  private emit(at: Vector3, normal: Vector3 | null, mat: MeshBasicMaterial, speed: number, size: number, life: number): void {
    const mesh = this.free.pop() ?? this.recycleOldest();
    if (!mesh) return;
    mesh.material = mat;
    mesh.visible = true;
    mesh.position.copy(at);
    const vel = new Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize();
    if (normal) vel.addScaledVector(normal, 1.2).normalize();
    vel.multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    const l = life * (0.6 + Math.random() * 0.6);
    this.active.push({ mesh, vel, life: l, maxLife: l, size: size * (0.6 + Math.random() * 0.8) });
  }

  private recycleOldest(): Mesh | undefined {
    const p = this.active.shift();
    return p?.mesh;
  }
}
