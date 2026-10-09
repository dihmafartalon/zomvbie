import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from 'three';
import type { WeaponModel } from '../weapons/WeaponDefs';

/**
 * Original canvas-generated textures for content no licensed asset covers:
 * lit signage, pump displays, decals, chalk wall-buys and the treeline.
 * Surface materials (asphalt, brick, metal...) come from Poly Haven PBR sets.
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

function clampTex(t: CanvasTexture): CanvasTexture {
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return t;
}

/** Grime overlay: darkens a sign face unevenly and adds rust bleed. */
function grime(ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number, amount: number): void {
  for (let i = 0; i < 40 * amount; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 10 + rand() * w * 0.12;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(20,14,8,${0.25 * rand()})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 12 * amount; i++) {
    const x = rand() * w;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(90,40,10,0.35)');
    grad.addColorStop(1, 'rgba(90,40,10,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 1 + rand() * 3, h * (0.2 + rand() * 0.6));
  }
}

/**
 * Backlit lettering where some letters are dead (unlit). Returns the face and
 * a matching emissive mask so dead letters stay dark at night.
 */
function litLetters(
  text: string,
  w: number,
  h: number,
  font: string,
  color: string,
  bg: string,
  dead: readonly number[],
  seed: number,
): { map: CanvasTexture; emissive: CanvasTexture } {
  const rand = seededRandom(seed);
  const [c, ctx] = makeCanvas(w, h);
  const [ec, ectx] = makeCanvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, w, h);
  for (const g of [ctx, ectx]) {
    g.font = font;
    g.textBaseline = 'middle';
  }
  const total = ctx.measureText(text).width;
  let x = (w - total) / 2;
  [...text].forEach((ch, i) => {
    const cw = ctx.measureText(ch).width;
    const isDead = dead.includes(i);
    ctx.fillStyle = isDead ? '#3a3a3a' : color;
    ctx.fillText(ch, x, h / 2);
    if (!isDead && ch !== ' ') {
      ectx.fillStyle = color;
      ectx.fillText(ch, x, h / 2);
    }
    x += cw;
  });
  grime(ctx, w, h, rand, 1);
  return { map: clampTex(finish(c)), emissive: clampTex(finish(ec)) };
}

export function canopyBrandTextures(): { map: CanvasTexture; emissive: CanvasTexture } {
  return litLetters('LAST STOP', 1024, 128, 'bold 104px Impact, "Arial Black", sans-serif', '#ff3d2e', '#d9d4c8', [5], 7);
}

export function storeSignTextures(): { map: CanvasTexture; emissive: CanvasTexture } {
  return litLetters('LAST STOP MARKET', 1024, 128, 'bold 96px Impact, "Arial Black", sans-serif', '#f4e7c0', '#15120f', [13], 21);
}

/** Roadside pylon sign: brand, services and a price board with dead digits. */
export function pylonSignTextures(): { map: CanvasTexture; emissive: CanvasTexture } {
  const rand = seededRandom(5);
  const W = 512;
  const H = 360;
  const [c, ctx] = makeCanvas(W, H);
  const [ec, ectx] = makeCanvas(W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e7e0cf';
  ctx.fillRect(0, 0, W, 170);
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 170, W, H - 170);
  ctx.fillStyle = '#b8261c';
  ctx.fillRect(0, 150, W, 20);
  for (const g of [ctx, ectx]) {
    g.textAlign = 'center';
    g.font = 'bold 92px Impact, "Arial Black", sans-serif';
    g.fillStyle = '#c42a1f';
    g.fillText('LAST STOP', W / 2, 105);
  }
  ctx.fillStyle = '#d8d0b8';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('FUEL  ·  FOOD  ·  ICE  ·  24 HR', W / 2, 140);
  ectx.fillStyle = '#5a5040';
  ectx.font = ctx.font;
  ectx.fillText('FUEL  ·  FOOD  ·  ICE  ·  24 HR', W / 2, 140);
  // Price board: LED digits, one row dead.
  const rows: [string, string, boolean][] = [
    ['REGULAR', '3.4_', true],
    ['PREMIUM', '-.--', false],
    ['DIESEL', '3.9_', true],
  ];
  rows.forEach(([label, price, lit], i) => {
    const y = 215 + i * 52;
    ctx.fillStyle = '#9a9a90';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 34, y);
    ctx.textAlign = 'right';
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.fillStyle = lit ? '#ffb340' : '#3b2d1a';
    ctx.fillText(price, W - 34, y + 4);
    if (lit) {
      ectx.textAlign = 'right';
      ectx.font = ctx.font;
      ectx.fillStyle = '#ffb340';
      ectx.fillText(price, W - 34, y + 4);
    }
  });
  // Smashed corner panel.
  ctx.fillStyle = '#0b0b0b';
  ctx.beginPath();
  ctx.moveTo(W, 0);
  ctx.lineTo(W - 120, 0);
  ctx.lineTo(W - 70, 60);
  ctx.lineTo(W - 95, 95);
  ctx.lineTo(W, 120);
  ctx.fill();
  ectx.fillStyle = '#000';
  ectx.fill();
  grime(ctx, W, H, rand, 1.5);
  return { map: clampTex(finish(c)), emissive: clampTex(finish(ec)) };
}

/** Pump display: amber "SEE ATTENDANT" / dashes, or a dead cracked screen. */
export function pumpDisplayTexture(dead: boolean): CanvasTexture {
  const [c, ctx] = makeCanvas(256, 160);
  ctx.fillStyle = dead ? '#060606' : '#0d0a04';
  ctx.fillRect(0, 0, 256, 160);
  if (dead) {
    ctx.strokeStyle = 'rgba(200,200,200,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 20);
    ctx.lineTo(110, 70);
    ctx.lineTo(90, 140);
    ctx.moveTo(110, 70);
    ctx.lineTo(200, 90);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#ffae2a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText('0000.00', 128, 62);
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText('SEE ATTENDANT', 128, 118);
  }
  return clampTex(finish(c));
}

/** Soft blot mask for oil stains (used as an alphaMap: white = opaque). */
export function stainTexture(seed: number): CanvasTexture {
  const rand = seededRandom(seed);
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9; i++) {
    const x = 128 + (rand() - 0.5) * 120;
    const y = 128 + (rand() - 0.5) * 120;
    const r = 20 + rand() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.35 + rand() * 0.3})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  return clampTex(finish(c));
}

/** Irregular puddle mask (white = water) for glossy wet patches. */
export function puddleTexture(seed: number): CanvasTexture {
  const rand = seededRandom(seed);
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 256);
  ctx.filter = 'blur(6px)';
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(128 + (rand() - 0.5) * 110, 128 + (rand() - 0.5) * 110, 25 + rand() * 50, 15 + rand() * 35, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return clampTex(finish(c));
}

/** A long strip of conifer silhouettes for the distant treeline (alpha). */
export function treelineTexture(): CanvasTexture {
  const rand = seededRandom(77);
  const W = 2048;
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#05070a';
  let x = 0;
  while (x < W) {
    const tw = 18 + rand() * 40;
    const th = H * (0.35 + rand() * 0.6);
    ctx.beginPath();
    ctx.moveTo(x, H);
    const tiers = 5 + Math.floor(rand() * 4);
    for (let t = 0; t <= tiers; t++) {
      const yy = H - (th * t) / tiers;
      const spread = (tw / 2) * (1 - t / tiers) * (0.8 + rand() * 0.4);
      ctx.lineTo(x + tw / 2 - spread, yy);
      ctx.lineTo(x + tw / 2 - spread * 0.4, yy - th / tiers / 2);
    }
    ctx.lineTo(x + tw / 2, H - th);
    for (let t = tiers; t >= 0; t--) {
      const yy = H - (th * t) / tiers;
      const spread = (tw / 2) * (1 - t / tiers) * (0.8 + rand() * 0.4);
      ctx.lineTo(x + tw / 2 + spread * 0.4, yy - th / tiers / 2);
      ctx.lineTo(x + tw / 2 + spread, yy);
    }
    ctx.lineTo(x + tw, H);
    ctx.fill();
    x += tw * (0.45 + rand() * 0.5);
    if (rand() < 0.06) x += 40 + rand() * 120; // clearings
  }
  ctx.fillRect(0, H - 20, W, 20);
  const t = finish(c, 3, 1);
  t.wrapT = ClampToEdgeWrapping;
  return t;
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

/** Off-white paint with grime, drips, scuffs and rust bloom; tint via material colour. */
export function weatheredPaintTexture(seed: number): CanvasTexture {
  const rand = seededRandom(seed);
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#f2f0ea';
  ctx.fillRect(0, 0, 512, 512);
  grime(ctx, 512, 512, rand, 2.5);
  // Scuffs and chipped paint.
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(${60 + rand() * 40},${45 + rand() * 30},${30 + rand() * 20},${0.15 + rand() * 0.4})`;
    ctx.fillRect(rand() * 512, rand() * 512, 2 + rand() * 9, 1 + rand() * 4);
  }
  // Rust bloom along the bottom edge.
  const g = ctx.createLinearGradient(0, 512, 0, 380);
  g.addColorStop(0, 'rgba(95,45,15,0.75)');
  g.addColorStop(1, 'rgba(95,45,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 380, 512, 132);
  return finish(c);
}

export type NoticeKind = 'evacuation' | 'missing' | 'warning';

/** Paper notices pinned up around the store — environmental storytelling. */
export function noticeTexture(kind: NoticeKind, seed: number): CanvasTexture {
  const rand = seededRandom(seed);
  const [c, ctx] = makeCanvas(256, 340);
  ctx.fillStyle = kind === 'warning' ? 'rgba(0,0,0,0)' : '#e6dfcc';
  ctx.fillRect(0, 0, 256, 340);
  ctx.textAlign = 'center';
  if (kind === 'evacuation') {
    ctx.fillStyle = '#9b1b14';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText('EVACUATION', 128, 44);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 17px Arial, sans-serif';
    ['ROUTE 9 IS CLOSED', 'PROCEED TO', 'COUNTY SHELTER', 'DO NOT TRAVEL', 'AFTER DARK', '', 'DO NOT APPROACH', 'THE INFECTED'].forEach((l, i) => ctx.fillText(l, 128, 102 + i * 26));
  } else if (kind === 'missing') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 40px Impact, sans-serif';
    ctx.fillText('MISSING', 128, 50);
    ctx.fillStyle = '#8d867a';
    ctx.fillRect(58, 70, 140, 150);
    ctx.fillStyle = '#5b554b';
    ctx.beginPath();
    ctx.arc(128, 125, 34, 0, Math.PI * 2);
    ctx.fillRect(78, 165, 100, 55);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('LAST SEEN ON ROUTE 9', 128, 250);
    ctx.fillText('IF FOUND CALL', 128, 274);
    ctx.fillText('555-01' + Math.floor(10 + rand() * 89), 128, 298);
  } else {
    ctx.fillStyle = 'rgba(150,20,14,0.85)';
    ctx.font = 'bold 44px "Segoe Print", "Comic Sans MS", cursive';
    ctx.save();
    ctx.translate(128, 170);
    ctx.rotate(-0.12);
    ctx.fillText('THEY', 0, -50);
    ctx.fillText('COME AT', 0, 0);
    ctx.fillText('NIGHT', 0, 50);
    ctx.restore();
  }
  if (kind !== 'warning') grime(ctx, 256, 340, rand, 1.2);
  return clampTex(finish(c));
}
