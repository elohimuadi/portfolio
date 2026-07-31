import Phaser from 'phaser';

const PLAYER_SPRITE_SCALE = 1.25;
const CHAR_FADE_MS = 800;
const CHAR_HOLD_MS = 400;

export class TransitionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Transition' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#ffffff');

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const player = this.add
      .sprite(cx, cy, 'player', 0)
      .setOrigin(0.5, 0.5)
      .setScale(PLAYER_SPRITE_SCALE)
      .setAlpha(0);
    player.anims.play('idle-down');

    this.tweens.add({
      targets: player,
      alpha: 1,
      duration: CHAR_FADE_MS,
    });

    this.time.delayedCall(CHAR_FADE_MS + CHAR_HOLD_MS, () => {
      this.scene.start('World');
    });
  }
}
