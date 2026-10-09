import { byId } from './dom';

/**
 * In-game heads-up display. DOM writes only happen when a value changes so
 * the per-frame cost stays negligible.
 */
export class HUD {
  private readonly root = byId('hud');
  private readonly round = byId('round');
  private readonly points = byId('points');
  private readonly popups = byId('point-popups');
  private readonly weaponName = byId('weapon-name');
  private readonly ammoMag = byId('ammo-mag');
  private readonly ammoReserve = byId('ammo-reserve');
  private readonly reloadHint = byId('reload-hint');
  private readonly healthFill = byId('health-fill');
  private readonly vignette = byId('damage-vignette');
  private readonly crosshair = byId('crosshair');
  private readonly hitmarker = byId('hitmarker');
  private readonly prompt = byId('prompt');
  private readonly message = byId('center-message');
  private readonly fps = byId('fps');

  private readonly cache = new Map<string, string | number | boolean>();
  private damageFlash = 0;
  private hitTimer = 0;
  private messageTimer = 0;

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  setRound(round: number): void {
    if (this.changed('round', round)) this.round.textContent = round > 0 ? String(round) : '';
  }

  setPoints(points: number): void {
    if (this.changed('points', points)) this.points.textContent = String(points);
  }

  /** Floating "+60" / "-1000" next to the points counter. */
  popup(delta: number): void {
    const el = document.createElement('div');
    el.className = `popup ${delta >= 0 ? 'gain' : 'loss'}`;
    el.textContent = `${delta >= 0 ? '+' : ''}${delta}`;
    el.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 40)}px`);
    this.popups.appendChild(el);
    window.setTimeout(() => el.remove(), 900);
  }

  setWeapon(name: string, mag: number, reserve: number, magSize: number, reloading: boolean): void {
    if (this.changed('weapon', name)) this.weaponName.textContent = name;
    if (this.changed('mag', mag)) this.ammoMag.textContent = String(mag);
    if (this.changed('reserve', reserve)) this.ammoReserve.textContent = String(reserve);
    const low = mag <= Math.ceil(magSize * 0.25);
    if (this.changed('low', low)) this.ammoMag.classList.toggle('low', low);
    const hint = reloading ? 'RELOADING' : mag === 0 && reserve === 0 ? 'NO AMMO' : low && reserve > 0 ? 'RELOAD' : '';
    if (this.changed('hint', hint)) this.reloadHint.textContent = hint;
  }

  setHealth(fraction: number): void {
    const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    if (this.changed('health', pct)) {
      this.healthFill.style.width = `${pct}%`;
      this.healthFill.classList.toggle('critical', pct <= 35);
    }
    // Persistent red edge while hurt, plus a flash on each hit.
    const hurt = (1 - fraction) * 0.7;
    this.vignette.style.opacity = String(Math.min(1, hurt + this.damageFlash));
  }

  damage(): void {
    this.damageFlash = 0.6;
  }

  hit(kill: boolean): void {
    this.hitTimer = 0.18;
    this.hitmarker.classList.add('show');
    this.hitmarker.classList.toggle('kill', kill);
  }

  setCrosshair(visible: boolean, spread: number): void {
    if (this.changed('xhair', visible)) this.crosshair.classList.toggle('hidden', !visible);
    const px = Math.round(6 + spread * 260);
    if (this.changed('spread', px)) this.crosshair.style.setProperty('--gap', `${px}px`);
  }

  setPrompt(text: string | null): void {
    if (this.changed('prompt', text ?? '')) {
      this.prompt.textContent = text ?? '';
      this.prompt.classList.toggle('hidden', !text);
    }
  }

  showMessage(text: string, seconds: number): void {
    this.message.textContent = text;
    this.message.classList.add('show');
    this.messageTimer = seconds;
  }

  /** FPS, draw calls and triangles; null hides the readout. */
  setPerf(perf: { fps: number; calls: number; triangles: number } | null): void {
    const text = perf === null ? '' : `${Math.round(perf.fps)} FPS · ${perf.calls} draws · ${(perf.triangles / 1000).toFixed(0)}k tris`;
    if (this.changed('fps', text)) this.fps.textContent = text;
  }

  update(dt: number): void {
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.5);
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.hitmarker.classList.remove('show');
    }
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message.classList.remove('show');
    }
  }

  reset(): void {
    this.cache.clear();
    this.damageFlash = 0;
    this.messageTimer = 0;
    this.message.classList.remove('show');
    this.popups.replaceChildren();
    this.setPrompt(null);
  }

  private changed(key: string, value: string | number | boolean): boolean {
    if (this.cache.get(key) === value) return false;
    this.cache.set(key, value);
    return true;
  }
}
