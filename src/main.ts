import './styles.css';
import { ACESFilmicToneMapping, PCFShadowMap, WebGLRenderer } from 'three';
import { AssetLibrary } from './assets/AssetLibrary';
import { detectTouchDevice, Game } from './core/Game';
import { LoadingScreen } from './ui/LoadingScreen';

async function boot(): Promise<void> {
  const container = document.getElementById('game-root');
  if (!container) throw new Error('Missing #game-root');
  const loading = new LoadingScreen();

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: !detectTouchDevice(), powerPreference: 'high-performance' });
  } catch {
    loading.fail('WebGL is not available in this browser.');
    return;
  }
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  container.appendChild(renderer.domElement);

  const assets = new AssetLibrary(import.meta.env.BASE_URL);
  await assets.load(renderer, (p) => loading.update(p));

  const game = new Game(renderer, assets);
  game.start();
  loading.finish(assets.failures);

  // Handy for poking at systems from the browser console during development.
  if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
}

void boot();
