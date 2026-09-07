import Phaser from 'phaser';

const MAP_KEY = 'map';
const PLAYER_SHEET_KEY = 'player';
// Shared NPC spritesheet: frames 0-1 are gojocat's idle loop, frames 2-3 are
// pompompurin's idle loop, frames 4-6 are Shoya's idle loop, frames 7-8 are
// Claude's blink loop, frame 9 is Golang's static idle frame (row-major frame
// order over a 5×4 grid of 32×32 cells — frames 10-13 are Golang's
// look-left/look-right/annoyed-left/annoyed-right, set directly via
// setFrame() by WorldScene rather than played as animations).
export const NPC_SHEET_KEY = 'npc-sheet';
export const GOJOCAT_IDLE_KEY = 'idle-gojocat';
export const POMPOMPURIN_IDLE_KEY = 'idle-pompompurin';
export const SHOYA_IDLE_KEY = 'idle-shoya';
export const CLAUDE_IDLE_KEY = 'idle-claude';
export const GOLANG_IDLE_KEY = 'idle-golang';
export const N_IDLE_KEY = 'idle-n';
const GOJOCAT_IDLE_FRAMES = [0, 1];
const POMPOMPURIN_IDLE_FRAMES = [2, 3];
const SHOYA_IDLE_FRAMES = [4, 5, 6];
const CLAUDE_IDLE_FRAMES = [7, 8];
// Single-frame "loop" — same idiom as the player's per-facing idle anims
// below (one frame, frameRate 1, repeat -1), since Golang's idle is static.
const GOLANG_IDLE_FRAME = 9;
const NPC_IDLE_FRAME_MS = 400;
export const MAP_SHEET_KEY = 'map-sheet';

// Typewriter blip played once per printed character in both the intro
// screen and the in-world dialogue box.
export const DIALOGUE_SFX_KEY = 'sfx-dialogue';
// Played once each time the choice-UI selection (▶ arrow) moves between
// options.
export const SELECT_SFX_KEY = 'sfx-select';

// Decorative prop spritesheet (smollitems-Sheet.png): a 7×7 grid of 32×32
// cells holding assorted room fixtures. Frame ranges below were identified by
// visually inspecting the sheet. Frames 0 and 1 are two distinct static
// flowers (a sparse single-stalk lavender and a fuller bushy one) — not two
// sway-frames of the same plant, so neither gets an animation.
export const PROP_SHEET_KEY = 'prop-sheet';
export const CROSS_ANIM_KEY = 'idle-cross';
export const MUSIC_PLAYER_ANIM_KEY = 'idle-music-player';
// Cross has a subtle sparkle that cycles through 17 frames (11-27).
const CROSS_FRAMES = Array.from({ length: 17 }, (_, i) => 11 + i);
// Music player (handheld device with earbud cord) animates across 13 frames.
const MUSIC_PLAYER_FRAMES = Array.from({ length: 13 }, (_, i) => 30 + i);
const CROSS_FRAME_MS = 90;
const MUSIC_PLAYER_FRAME_MS = 120;
const TILESET_TEXTURE_KEYS = {
  grassdirt: 'tiles-grassdirt',
  largeitem: 'tiles-largeitem',
  miditem: 'tiles-miditem',
  smallitems: 'tiles-smallitems',
} as const;
const BAR_WIDTH = 160;
const BAR_HEIGHT = 8;

// Spritesheet is 4 cols × 3 rows physically, but frames flow sequentially
// in row-major order: 12 frames grouped as 4 direction-triplets of 3 frames.
// Row order on the sheet is down, up, left, right.
// Within a triplet: 0=idle, 1=walk-a, 2=walk-b.
const FACINGS = ['down', 'left', 'right', 'up'] as const;
type Facing = (typeof FACINGS)[number];
const FACING_FRAME_START: Record<Facing, number> = {
  down: 0,
  up: 3,
  left: 6,
  right: 9,
};
const IDLE_OFFSET = 0;
const WALK_A_OFFSET = 1;
const WALK_B_OFFSET = 2;
const WALK_FRAME_RATE = 8;

export class BootScene extends Phaser.Scene {
  private barFill?: Phaser.GameObjects.Rectangle;
  private titleText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const frame = this.add.rectangle(cx, cy + 12, BAR_WIDTH + 4, BAR_HEIGHT + 4);
    frame.setStrokeStyle(1, 0x111111);

    this.barFill = this.add
      .rectangle(cx - BAR_WIDTH / 2, cy + 12 - BAR_HEIGHT / 2, 0, BAR_HEIGHT, 0x111111)
      .setOrigin(0, 0);

    this.add
      .text(cx, cy - 16, 'LOADING', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#111111',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      if (this.barFill) this.barFill.width = BAR_WIDTH * value;
    });

    this.load.spritesheet(PLAYER_SHEET_KEY, '/assets/s-sheet.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    this.load.spritesheet(NPC_SHEET_KEY, '/assets/npc-sheet.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    this.load.image(MAP_SHEET_KEY, '/assets/map.png');

    this.load.spritesheet(PROP_SHEET_KEY, '/assets/smollitems-sheet.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    this.load.audio(DIALOGUE_SFX_KEY, '/assets/dialogue.wav');
    this.load.audio(SELECT_SFX_KEY, '/assets/blip-select.wav');

    this.load.tilemapTiledJSON(MAP_KEY, '/assets/map.tmj');
    this.load.image(TILESET_TEXTURE_KEYS.grassdirt, '/assets/tiles/grassdirt.png');
    this.load.image(TILESET_TEXTURE_KEYS.largeitem, '/assets/tiles/largeitems.png');
    this.load.image(TILESET_TEXTURE_KEYS.miditem, '/assets/tiles/miditems.png');
    this.load.image(TILESET_TEXTURE_KEYS.smallitems, '/assets/tiles/smollitems.png');
  }

  create(): void {
    this.registerPlayerAnimations();
    this.registerNpcAnimations();
    this.registerPropAnimations();
    // pixelArt: true at the game config should already default new textures to
    // NEAREST, but a stray LINEAR filter on a tileset atlas produces the classic
    // 1-px "gap between tiles" at any non-integer camera scale — force it here
    // so there's no ambiguity.
    for (const key of Object.values(TILESET_TEXTURE_KEYS)) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.children.removeAll();

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.titleText = this.add
      .text(cx, cy - 16, 'PORTFOLIO', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#111111',
      })
      .setOrigin(0.5);

    this.promptText = this.add
      .text(cx, cy + 16, 'PRESS START', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#111111',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: this.promptText,
      alpha: 0.2,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
    });

    const start = () => this.scene.start('Intro');
    this.input.keyboard?.once('keydown-SPACE', start);
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.once('pointerdown', start);
  }

  private handleResize(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.titleText?.setPosition(cx, cy - 16);
    this.promptText?.setPosition(cx, cy + 16);
  }

  private registerNpcAnimations(): void {
    // Sheet cells 16 and 17 (one-based) are N's open/closed eyes.
    if (!this.anims.exists(N_IDLE_KEY)) {
      this.anims.create({
        key: N_IDLE_KEY,
        frames: this.anims.generateFrameNumbers(NPC_SHEET_KEY, { frames: [15, 16] }),
        frameRate: 1000 / 900,
        yoyo: true,
        repeat: -1,
      });
    }
    // Two-frame idles at 400ms per frame → 2.5 fps, shared across NPCs on the
    // combined spritesheet.
    if (!this.anims.exists(GOJOCAT_IDLE_KEY)) {
      this.anims.create({
        key: GOJOCAT_IDLE_KEY,
        frames: this.anims.generateFrameNumbers(NPC_SHEET_KEY, {
          frames: GOJOCAT_IDLE_FRAMES,
        }),
        frameRate: 1000 / NPC_IDLE_FRAME_MS,
        repeat: -1,
      });
    }

    if (!this.anims.exists(POMPOMPURIN_IDLE_KEY)) {
      this.anims.create({
        key: POMPOMPURIN_IDLE_KEY,
        frames: this.anims.generateFrameNumbers(NPC_SHEET_KEY, {
          frames: POMPOMPURIN_IDLE_FRAMES,
        }),
        frameRate: 1000 / NPC_IDLE_FRAME_MS,
        repeat: -1,
      });
    }

    if (!this.anims.exists(SHOYA_IDLE_KEY)) {
      // yoyo: true plays 4→5→6→5→4→... (open→half-closed→closed→half-closed→open)
      // instead of holding on frame 6 and snapping back to frame 4.
      this.anims.create({
        key: SHOYA_IDLE_KEY,
        frames: this.anims.generateFrameNumbers(NPC_SHEET_KEY, {
          frames: SHOYA_IDLE_FRAMES,
        }),
        frameRate: 1000 / NPC_IDLE_FRAME_MS,
        yoyo: true,
        repeat: -1,
      });
    }

    if (!this.anims.exists(CLAUDE_IDLE_KEY)) {
      // yoyo: true plays 7→8→7→... (eyes open→closed→open) so the blink
      // ping-pongs naturally instead of holding on frame 8 and snapping back.
      this.anims.create({
        key: CLAUDE_IDLE_KEY,
        frames: this.anims.generateFrameNumbers(NPC_SHEET_KEY, {
          frames: CLAUDE_IDLE_FRAMES,
        }),
        frameRate: 1000 / NPC_IDLE_FRAME_MS,
        yoyo: true,
        repeat: -1,
      });
    }

    if (!this.anims.exists(GOLANG_IDLE_KEY)) {
      this.anims.create({
        key: GOLANG_IDLE_KEY,
        frames: [{ key: NPC_SHEET_KEY, frame: GOLANG_IDLE_FRAME }],
        frameRate: 1,
        repeat: -1,
      });
    }
  }

  private registerPropAnimations(): void {
    const loops: Array<{ key: string; frames: number[]; frameMs: number }> = [
      { key: CROSS_ANIM_KEY, frames: CROSS_FRAMES, frameMs: CROSS_FRAME_MS },
      { key: MUSIC_PLAYER_ANIM_KEY, frames: MUSIC_PLAYER_FRAMES, frameMs: MUSIC_PLAYER_FRAME_MS },
    ];

    for (const loop of loops) {
      if (this.anims.exists(loop.key)) continue;
      this.anims.create({
        key: loop.key,
        frames: this.anims.generateFrameNumbers(PROP_SHEET_KEY, { frames: loop.frames }),
        frameRate: 1000 / loop.frameMs,
        repeat: -1,
      });
    }
  }

  private registerPlayerAnimations(): void {
    FACINGS.forEach((facing) => {
      const idleKey = `idle-${facing}` satisfies `idle-${Facing}`;
      const walkKey = `walk-${facing}` satisfies `walk-${Facing}`;
      const base = FACING_FRAME_START[facing];

      if (!this.anims.exists(idleKey)) {
        this.anims.create({
          key: idleKey,
          frames: [{ key: PLAYER_SHEET_KEY, frame: base + IDLE_OFFSET }],
          frameRate: 1,
          repeat: -1,
        });
      }

      if (!this.anims.exists(walkKey)) {
        // Classic 4-step walk cycle: step-a → idle → step-b → idle.
        this.anims.create({
          key: walkKey,
          frames: this.anims.generateFrameNumbers(PLAYER_SHEET_KEY, {
            frames: [
              base + WALK_A_OFFSET,
              base + IDLE_OFFSET,
              base + WALK_B_OFFSET,
              base + IDLE_OFFSET,
            ],
          }),
          frameRate: WALK_FRAME_RATE,
          repeat: -1,
        });
      }
    });
  }
}
