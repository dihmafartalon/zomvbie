import type { GraphicsQuality, Settings } from '../core/Settings';
import { byId } from './dom';

export type MenuScreen = 'main' | 'pause' | 'settings' | 'gameover' | 'none';

export interface MenuHandlers {
  play(): void;
  resume(): void;
  restart(): void;
  quit(): void;
  settingsChanged(settings: Settings): void;
}

export interface GameSummary {
  round: number;
  kills: number;
  headshots: number;
  points: number;
}

/** Main, pause, settings and game-over screens (static markup in index.html). */
export class Menus {
  private current: MenuScreen = 'main';
  private settingsReturn: MenuScreen = 'main';
  private readonly screens: Record<Exclude<MenuScreen, 'none'>, HTMLElement> = {
    main: byId('menu-main'),
    pause: byId('menu-pause'),
    settings: byId('menu-settings'),
    gameover: byId('menu-gameover'),
  };
  private readonly overlay = byId('menus');
  private readonly hint = byId('pause-hint');

  constructor(private readonly handlers: MenuHandlers, private readonly settings: Settings) {
    this.bindButtons();
    this.bindSettings();
    this.show('main');
  }

  get screen(): MenuScreen {
    return this.current;
  }

  show(screen: MenuScreen): void {
    this.current = screen;
    this.overlay.classList.toggle('hidden', screen === 'none');
    for (const [name, el] of Object.entries(this.screens)) el.classList.toggle('hidden', name !== screen);
    if (screen !== 'pause') this.setPauseHint('');
  }

  setPauseHint(text: string): void {
    this.hint.textContent = text;
  }

  showGameOver(s: GameSummary): void {
    byId('go-rounds').textContent = `You survived ${s.round} ${s.round === 1 ? 'round' : 'rounds'}`;
    byId('go-kills').textContent = String(s.kills);
    byId('go-headshots').textContent = String(s.headshots);
    byId('go-points').textContent = String(s.points);
    this.show('gameover');
  }

  private bindButtons(): void {
    const on = (id: string, fn: () => void): void => byId(id).addEventListener('click', fn);
    on('btn-play', () => this.handlers.play());
    on('btn-settings-main', () => this.openSettings('main'));
    on('btn-controls', () => byId('controls-panel').classList.toggle('hidden'));
    on('btn-resume', () => this.handlers.resume());
    on('btn-settings-pause', () => this.openSettings('pause'));
    on('btn-restart', () => this.handlers.restart());
    on('btn-quit', () => this.handlers.quit());
    on('btn-settings-back', () => this.show(this.settingsReturn));
    on('btn-again', () => this.handlers.restart());
    on('btn-gameover-menu', () => this.handlers.quit());
  }

  private openSettings(from: MenuScreen): void {
    this.settingsReturn = from;
    this.show('settings');
  }

  private bindSettings(): void {
    const s = this.settings;
    const changed = (): void => this.handlers.settingsChanged(s);

    const range = (id: string, get: () => number, set: (v: number) => void, fmt: (v: number) => string): void => {
      const input = byId<HTMLInputElement>(id);
      const label = byId(`${id}-value`);
      input.value = String(get());
      label.textContent = fmt(get());
      input.addEventListener('input', () => {
        set(Number(input.value));
        label.textContent = fmt(get());
        changed();
      });
    };
    const check = (id: string, get: () => boolean, set: (v: boolean) => void): void => {
      const input = byId<HTMLInputElement>(id);
      input.checked = get();
      input.addEventListener('change', () => {
        set(input.checked);
        changed();
      });
    };

    range('set-mouse', () => s.mouseSensitivity, (v) => (s.mouseSensitivity = v), (v) => v.toFixed(2));
    range('set-touch', () => s.touchSensitivity, (v) => (s.touchSensitivity = v), (v) => v.toFixed(2));
    range('set-fov', () => s.fov, (v) => (s.fov = v), (v) => `${v}°`);
    range('set-volume', () => Math.round(s.masterVolume * 100), (v) => (s.masterVolume = v / 100), (v) => `${v}%`);
    check('set-invert', () => s.invertY, (v) => (s.invertY = v));
    check('set-fps', () => s.showFps, (v) => (s.showFps = v));

    const quality = byId<HTMLSelectElement>('set-quality');
    quality.value = s.quality;
    quality.addEventListener('change', () => {
      s.quality = quality.value as GraphicsQuality;
      changed();
    });
  }
}
