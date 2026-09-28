import Phaser from 'phaser';
import { preloadHandText } from '../handtext';
import { BLOOM_FRAME_COUNT, bloomKey } from './BootScene';

// Loads what the loading screen itself needs before anything else: the
// hand-drawn font (~0.5 MB) and the 25 flower frames (~1.2 MB of WebP).
export class FontScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Font' });
  }

  preload(): void {
    preloadHandText(this);
    for (let i = 1; i <= BLOOM_FRAME_COUNT; i++) {
      this.load.image(bloomKey(i), `/assets/loading/${i}.webp`);
    }
    // Painted, not pixel art: smooth scaling instead of pixelArt's NEAREST.
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      for (let i = 1; i <= BLOOM_FRAME_COUNT; i++) {
        this.textures.get(bloomKey(i)).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    });
  }

  create(): void {
    this.scene.start('Boot');
  }
}
