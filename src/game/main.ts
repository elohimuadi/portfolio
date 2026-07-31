import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { IntroScene } from './scenes/IntroScene';
import { TransitionScene } from './scenes/TransitionScene';
import { WorldScene } from './scenes/WorldScene';

// Reference dimensions used by scenes that need a sensible fallback before
// the scale manager has measured the parent. At runtime, RESIZE mode makes
// the actual game size match the parent (100vw × 100vh); scenes should
// prefer `this.scale.width` / `this.scale.height` for positioning.
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 240;

let instance: Phaser.Game | null = null;

export function startGame(parentId: string): Phaser.Game {
  if (instance) return instance;

  instance = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: '#ffffff',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
      autoRound: true,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, IntroScene, TransitionScene, WorldScene],
  });

  return instance;
}
