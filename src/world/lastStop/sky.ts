import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { glowTexture, seededRandom, treelineTexture } from '../textures';

export const SKY = {
  /** Fog colour; the dome's horizon matches it so the ground fades seamlessly. */
  horizon: 0x0c1019,
  zenith: 0x010207,
  /** Direction the moon (and the moonlight) comes from. */
  moonDir: new Vector3(-0.45, 0.62, -0.64).normalize(),
};

/** Night sky dome, stars, moon and two layers of treeline silhouette. */
export function buildSky(root: Object3D): void {
  const dome = new Mesh(
    new SphereGeometry(280, 32, 16),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        horizon: { value: new Color(SKY.horizon) },
        zenith: { value: new Color(SKY.zenith) },
        glowDir: { value: new Vector3(0.8, 0, 0.6).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 horizon;
        uniform vec3 zenith;
        uniform vec3 glowDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.45));
          // Faint sodium light pollution from a distant town on one horizon.
          float town = pow(max(dot(normalize(vec3(vDir.x, 0.0, vDir.z)), glowDir), 0.0), 6.0) * (1.0 - smoothstep(0.0, 0.25, h));
          col += vec3(0.09, 0.05, 0.02) * town;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.renderOrder = -10;
  root.add(dome);

  // Stars: denser and dimmer towards the horizon.
  const rand = seededRandom(99);
  const pos: number[] = [];
  const col: number[] = [];
  for (let i = 0; i < 1800; i++) {
    const theta = rand() * Math.PI * 2;
    const y = Math.pow(rand(), 0.7) * 0.97 + 0.03;
    const r = Math.sqrt(1 - y * y);
    pos.push(Math.cos(theta) * r * 260, y * 260, Math.sin(theta) * r * 260);
    const b = (0.35 + rand() * 0.65) * Math.min(1, y * 3);
    col.push(b * 0.85, b * 0.9, b);
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new Float32BufferAttribute(col, 3));
  root.add(new Points(starGeo, new PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false })));

  // Moon with a soft halo.
  const moonPos = SKY.moonDir.clone().multiplyScalar(240);
  const moon = new Mesh(new SphereGeometry(5, 24, 16), new MeshBasicMaterial({ color: 0xe8eeff, fog: false }));
  moon.position.copy(moonPos);
  root.add(moon);
  const halo = new Sprite(
    new SpriteMaterial({ map: glowTexture('rgba(190,205,255,0.45)', 'rgba(110,130,210,0.1)'), fog: false, blending: AdditiveBlending, depthWrite: false }),
  );
  halo.position.copy(moonPos);
  halo.scale.setScalar(70);
  root.add(halo);

  // Treeline: a far, slightly lighter layer and a nearer, darker one for depth.
  const tex = treelineTexture();
  for (const [radius, height, color, rot] of [
    [230, 30, 0x0b0e15, 0.7],
    [175, 22, 0x05070b, 0],
  ] as const) {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(radius > 200 ? 4 : 3, 1);
    const ring = new Mesh(
      new CylinderGeometry(radius, radius, height, 72, 1, true),
      new MeshBasicMaterial({ map: t, color, transparent: true, alphaTest: 0.5, side: BackSide, fog: false, depthWrite: false }),
    );
    ring.position.y = height / 2 - 1;
    ring.rotation.y = rot;
    ring.renderOrder = -9;
    root.add(ring);
  }
}
