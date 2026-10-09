import type { LoadProgress } from '../assets/AssetLibrary';
import { byId } from './dom';

/** Boot overlay with a progress bar; reports assets that failed to load. */
export class LoadingScreen {
  private readonly root = byId('loading');
  private readonly bar = byId('loading-bar');
  private readonly label = byId('loading-label');
  private readonly warning = byId('loading-warning');

  update(p: LoadProgress): void {
    const pct = Math.round((p.loaded / Math.max(1, p.total)) * 100);
    this.bar.style.width = `${pct}%`;
    this.label.textContent = `Loading ${p.item.replaceAll('_', ' ')} · ${pct}%`;
  }

  /** Hides the overlay. Failed assets are listed in a corner notice instead of blocking play. */
  finish(failures: readonly string[]): void {
    if (failures.length > 0) {
      this.warning.textContent = `${failures.length} asset(s) failed to load and use placeholders: ${failures.join(', ')}`;
      this.warning.classList.remove('hidden');
      window.setTimeout(() => this.warning.classList.add('hidden'), 12000);
    }
    this.root.classList.add('done');
    window.setTimeout(() => this.root.classList.add('hidden'), 600);
  }

  fail(message: string): void {
    this.label.textContent = message;
    this.root.classList.add('error');
  }
}
