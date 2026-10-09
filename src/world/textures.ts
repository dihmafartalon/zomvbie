import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from 'three';
import type { WeaponModel } from '../weapons/WeaponDefs';

/**
 * Procedural canvas textures, so the prototype ships with zero binary assets.
 * Real texture art can replace these one function at a time.
 */

export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, rx = 1, ry = 1): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, rand: () => number, lo: number, hi: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(lo + rand() * (hi - lo));
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rand()})`;
    const s = 1 + rand() * 2;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

function stains(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, rand: () => number, color: string): void {
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 10 + rand() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

export function asphaltTexture(repeat: number): CanvasTexture {
  const rand = seededRandom(11);
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#1d1e21';
  ctx.fillRect(0, 0, 512, 512);
  speckle(ctx, 512, 512, 9000, rand, 20, 75, 0.9);
  stains(ctx, 512, 512, 10, rand, 'rgba(5,5,8,0.55)');
  ctx.strokeStyle = 'rgba(8,8,10,0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let x = rand() * 512;
    let y = rand() * 512;
    ctx.moveTo(x, y);
    for (let j = 0; j < 8; j++) {
      x += (rand() - 0.5) * 60;
      y += (rand() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return finish(c, repeat, repeat);
}

export function dirtTexture(repeat: number): CanvasTexture {
  const rand = seededRandom(23);
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#17160f';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const g = 20 + rand() * 30;
    ctx.fillStyle = `rgba(${g},${g + 8 * rand()},${g * 0.6},${rand()})`;
    ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  return finish(c, repeat, repeat);
}

export function concreteTexture(repeat: number): CanvasTexture {
  const rand = seededRandom(37);
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#5c5a55';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 3000, rand, 60, 130, 0.5);
  stains(ctx, 256, 256, 6, rand, 'rgba(20,18,14,0.35)');
  return finish(c, repeat, repeat);
}

export function tileTexture(rx: number, ry: number): CanvasTexture {
  const rand = seededRandom(41);
  const [c, ctx] = makeCanvas(256, 256);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#77736a' : '#4b4943';
      ctx.fillRect(x * 32, y * 32, 32, 32);
    }
  }
  stains(ctx, 256, 256, 12, rand, 'rgba(25,20,10,0.4)');
  speckle(ctx, 256, 256, 1500, rand, 10, 60, 0.4);
  return finish(c, rx, ry);
}

export function wallTexture(rx: number, ry: number): CanvasTexture {
  const rand = seededRandom(53);
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#6f6757';
  ctx.fillRect(0, 0, 256, 256);
  // Cinder block courses.
  ctx.strokeStyle = 'rgba(30,26,20,0.5)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
    const off = (y / 32) % 2 ? 32 : 0;
    for (let x = off; x < 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 32);
      ctx.stroke();
    }
  }
  // Water streaks.
  for (let i = 0; i < 30; i++) {
    const x = rand() * 256;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(20,18,12,0.45)');
    g.addColorStop(1, 'rgba(20,18,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 2 + rand() * 6, 80 + rand() * 170);
  }
  speckle(ctx, 256, 256, 2000, rand, 40, 120, 0.4);
  return finish(c, rx, ry);
}

export function fenceTexture(repeatX: number, repeatY: number): CanvasTexture {
  const [c, ctx] = makeCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = '#8d9399';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(64, 64);
  ctx.moveTo(64, 0);
  ctx.lineTo(0, 64);
  ctx.stroke();
  return finish(c, repeatX, repeatY);
}

export function roadSignTexture(): CanvasTexture {
  const [c, ctx] = makeCanvas(512, 340);
  ctx.fillStyle = '#0d0d0f';
  ctx.fillRect(0, 0, 512, 340);
  ctx.strokeStyle = '#b3241c';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, 492, 320);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4433';
  ctx.font = 'bold 86px Impact, "Arial Black", sans-serif';
  ctx.fillText('LAST STOP', 256, 115);
  ctx.fillStyle = '#e8e2d0';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.fillText('FUEL  ·  SNACKS  ·  ICE', 256, 175);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 64px "Courier New", monospace';
  ctx.fillText('REG  -.--', 256, 270);
  return finish(c);
}

export function storeSignTexture(): CanvasTexture {
  const [c, ctx] = makeCanvas(512, 80);
  ctx.fillStyle = '#16120e';
  ctx.fillRect(0, 0, 512, 80);
  ctx.fillStyle = '#d8cfa8';
  ctx.textAlign = 'center';
  ctx.font = 'bold 54px Impact, "Arial Black", sans-serif';
  ctx.fillText('LAST STOP MARKET', 256, 60);
  // Dead letters.
  ctx.fillStyle = 'rgba(22,18,14,0.85)';
  ctx.fillRect(300, 12, 30, 60);
  return finish(c);
}

/** Chalk outline of a weapon with its name and price, like a COD wall-buy. */
export function chalkTexture(name: string, price: number, model: WeaponModel): CanvasTexture {
  const rand = seededRandom(name.length * 97 + price);
  const [c, ctx] = makeCanvas(512, 256);
  ctx.clearRect(0, 0, 512, 256);
  ctx.strokeStyle = 'rgba(235,235,225,0.9)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const shapes: Record<WeaponModel, [number, number][][]> = {
    pistol: [[[180, 70], [330, 70], [330, 100], [260, 100], [250, 160], [215, 160], [222, 100], [180, 100], [180, 70]]],
    smg: [
      [[110, 75], [380, 75], [380, 110], [300, 110], [290, 170], [262, 170], [268, 110], [220, 110], [215, 180], [190, 180], [195, 110], [110, 110], [110, 75]],
      [[380, 88], [420, 88]],
      [[110, 85], [60, 95], [60, 120], [110, 105]],
    ],
    shotgun: [
      [[60, 85], [450, 85], [450, 100], [60, 100]],
      [[200, 100], [300, 100], [300, 115], [200, 115]],
      [[60, 85], [20, 105], [20, 140], [80, 110], [120, 110], [120, 100]],
    ],
    rifle: [
      [[100, 80], [360, 80], [360, 112], [100, 112], [100, 80]],
      [[360, 92], [460, 92]],
      [[200, 112], [215, 180], [240, 180], [235, 112]],
      [[100, 85], [40, 100], [40, 130], [100, 108]],
      [[170, 80], [170, 62], [290, 62], [290, 80]],
    ],
  };

  for (let pass = 0; pass < 3; pass++) {
    ctx.lineWidth = 5 - pass;
    for (const line of shapes[model]) {
      ctx.beginPath();
      line.forEach(([x, y], i) => {
        const jx = x + (rand() - 0.5) * 4;
        const jy = y + (rand() - 0.5) * 4;
        if (i === 0) ctx.moveTo(jx, jy);
        else ctx.lineTo(jx, jy);
      });
      ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(235,235,225,0.92)';
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px "Comic Sans MS", "Segoe Print", cursive';
  ctx.fillText(name.toUpperCase(), 256, 222);
  ctx.font = 'bold 28px "Comic Sans MS", "Segoe Print", cursive';
  ctx.fillText(`${price}`, 256, 252);

  const t = finish(c);
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return t;
}

export function glowTexture(inner: string, outer: string): CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return finish(c);
}
