import './styles.css';
import { Game } from './core/Game';

const container = document.getElementById('game-root');
if (!container) throw new Error('Missing #game-root');

const game = new Game(container);
game.start();

// Handy for poking at systems from the browser console during development.
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
