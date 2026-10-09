export type GraphicsQuality = 'low' | 'high';

export interface Settings {
  mouseSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  fov: number;
  /** 0..1 */
  masterVolume: number;
  quality: GraphicsQuality;
  showFps: boolean;
}

const STORAGE_KEY = 'deadsignal.settings.v1';

export function defaultSettings(isTouch: boolean): Settings {
  return {
    mouseSensitivity: 1,
    touchSensitivity: 1,
    invertY: false,
    fov: 75,
    masterVolume: 0.8,
    quality: isTouch ? 'low' : 'high',
    showFps: false,
  };
}

/** Validates untrusted (stored) settings, falling back field-by-field. */
export function sanitizeSettings(raw: unknown, fallback: Settings): Settings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, d: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
  return {
    mouseSensitivity: num(r.mouseSensitivity, 0.1, 3, fallback.mouseSensitivity),
    touchSensitivity: num(r.touchSensitivity, 0.2, 3, fallback.touchSensitivity),
    invertY: bool(r.invertY, fallback.invertY),
    fov: num(r.fov, 60, 100, fallback.fov),
    masterVolume: num(r.masterVolume, 0, 1, fallback.masterVolume),
    quality: r.quality === 'low' || r.quality === 'high' ? r.quality : fallback.quality,
    showFps: bool(r.showFps, fallback.showFps),
  };
}

export function loadSettings(isTouch: boolean): Settings {
  const defaults = defaultSettings(isTouch);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw), defaults) : defaults;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); settings
    // still apply for this session.
  }
}
