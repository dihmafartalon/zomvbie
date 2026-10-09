import { describe, expect, it } from 'vitest';
import { defaultSettings, sanitizeSettings } from '../src/core/Settings';
import { Wallet } from '../src/game/Wallet';

describe('Wallet', () => {
  it('spends only when affordable', () => {
    const w = new Wallet(500);
    expect(w.spend(1000)).toBe(false);
    expect(w.points).toBe(500);
    w.add(600);
    expect(w.spend(1000)).toBe(true);
    expect(w.points).toBe(100);
  });

  it('ignores negative additions', () => {
    const w = new Wallet(10);
    w.add(-50);
    expect(w.points).toBe(10);
  });
});

describe('sanitizeSettings', () => {
  const defaults = defaultSettings(false);

  it('falls back on garbage', () => {
    expect(sanitizeSettings('nope', defaults)).toEqual(defaults);
    expect(sanitizeSettings(null, defaults)).toEqual(defaults);
  });

  it('clamps out-of-range values and rejects bad types', () => {
    const s = sanitizeSettings({ fov: 500, masterVolume: -1, quality: 'ultra', invertY: 'yes', mouseSensitivity: 2 }, defaults);
    expect(s.fov).toBe(100);
    expect(s.masterVolume).toBe(0);
    expect(s.quality).toBe(defaults.quality);
    expect(s.invertY).toBe(defaults.invertY);
    expect(s.mouseSensitivity).toBe(2);
  });

  it('touch devices default to low quality', () => {
    expect(defaultSettings(true).quality).toBe('low');
  });
});
