import { BoxGeometry, PlaneGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { scaleUVs, worldScaleBoxUVs } from '../src/world/MapBuilder';

function uvRange(geo: BoxGeometry | PlaneGeometry, from: number, to: number): { u: number; v: number } {
  const uv = geo.getAttribute('uv');
  let u = 0;
  let v = 0;
  for (let i = from; i < to; i++) {
    u = Math.max(u, uv.getX(i));
    v = Math.max(v, uv.getY(i));
  }
  return { u, v };
}

describe('UV tiling helpers', () => {
  it('scales plane UVs by the requested repeat', () => {
    const g = new PlaneGeometry(10, 4);
    scaleUVs(g, 5, 2);
    expect(uvRange(g, 0, 4)).toEqual({ u: 5, v: 2 });
  });

  it('tiles every box face at real-world size', () => {
    // 6m wide, 3m tall, 1m deep wall with a 2m texture tile.
    const g = new BoxGeometry(6, 3, 1);
    worldScaleBoxUVs(g, 6, 3, 1, 2);
    // +z face (index 4) is width x height.
    expect(uvRange(g, 16, 20)).toEqual({ u: 3, v: 1.5 });
    // +x face (index 0) is depth x height.
    expect(uvRange(g, 0, 4)).toEqual({ u: 0.5, v: 1.5 });
    // +y face (index 2) is width x depth.
    expect(uvRange(g, 8, 12)).toEqual({ u: 3, v: 0.5 });
  });
});
