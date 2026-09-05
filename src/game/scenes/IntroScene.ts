import Phaser from 'phaser';
import { DIALOGUE_SFX_KEY } from './BootScene';

const INTRO_LINES = [
  'There lives a boy named Josh that loves lavenders,',
  'he loved lavenders so much he built a garden full of them and took all his favorite things and put inside this garden',
] as const;

const CHAR_INTERVAL_MS = 40;
const TEXT_COLOR = '#ffffff';
const BG_COLOR = '#000000';
const BODY_FONT_SIZE = 12;
const PROMPT_FONT_SIZE = 10;
const SIDE_PADDING = 24;
const PROMPT_MARGIN = 12;
const DIALOGUE_SFX_VOLUME = 0.35;
const DIALOGUE_SFX_MIN_RATE = 0.9;
const DIALOGUE_SFX_MAX_RATE = 1.1;

export class IntroScene extends Phaser.Scene {
  private bodyText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;
  private promptTween?: Phaser.Tweens.Tween;
  private typeEvent?: Phaser.Time.TimerEvent;
  private typeSfx?: Phaser.Sound.BaseSound;
  private fullText = '';
  private charIndex = 0;
  private typingDone = false;
  private advanced = false;

  constructor() {
    super({ key: 'Intro' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.fullText = INTRO_LINES.join('\n');
    this.charIndex = 0;
    this.typingDone = false;
    this.advanced = false;

    const { cx, cy } = this.center();

    this.bodyText = this.add
      .text(cx, cy, '', {
        fontFamily: 'monospace',
        fontSize: `${BODY_FONT_SIZE}px`,
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: this.wrapWidth() },
      })
      .setOrigin(0.5);

    this.typeSfx = this.sound.add(DIALOGUE_SFX_KEY, { volume: DIALOGUE_SFX_VOLUME });

    this.promptText = this.add
      .text(0, 0, '[ click to continue ]', {
        fontFamily: 'monospace',
        fontSize: `${PROMPT_FONT_SIZE}px`,
        color: TEXT_COLOR,
      })
      .setOrigin(1, 1)
      .setVisible(false);
    this.positionPrompt();

    this.typeEvent = this.time.addEvent({
      delay: CHAR_INTERVAL_MS,
      loop: true,
      callback: this.tickTyping,
      callbackScope: this,
    });

    this.input.keyboard?.on('keydown-SPACE', this.handleAdvance, this);
    this.input.keyboard?.on('keydown-ENTER', this.handleAdvance, this);
    this.input.on('pointerdown', this.handleAdvance, this);

    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
      this.typeEvent?.remove(false);
      this.promptTween?.stop();
      this.typeSfx?.destroy();
    });
  }

  private tickTyping(): void {
    if (!this.bodyText) return;
    this.charIndex += 1;
    this.bodyText.setText(this.fullText.slice(0, this.charIndex));
    this.playTypeSfx();
    if (this.charIndex >= this.fullText.length) {
      this.finishTyping();
    }
  }

  // Stopping before re-playing (rather than letting each call overlap the
  // last) is what gives the clipped, staccato "RPG chatter" sound instead of
  // a blurred wall of overlapping tones.
  private playTypeSfx(): void {
    if (!this.typeSfx) return;
    this.typeSfx.stop();
    const rate = Phaser.Math.FloatBetween(DIALOGUE_SFX_MIN_RATE, DIALOGUE_SFX_MAX_RATE);
    this.typeSfx.play({ rate });
  }

  private finishTyping(): void {
    if (this.typingDone) return;
    this.typingDone = true;
    this.typeEvent?.remove(false);
    this.typeEvent = undefined;
    this.bodyText?.setText(this.fullText);
    if (this.promptText) {
      this.promptText.setVisible(true);
      this.promptTween = this.tweens.add({
        targets: this.promptText,
        alpha: 0.2,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private handleAdvance(): void {
    if (!this.typingDone) {
      this.finishTyping();
      return;
    }
    if (this.advanced) return;
    this.advanced = true;
    // Skip TransitionScene — the character-on-white fade is now staged inside
    // WorldScene itself, so the character renders at his real spawn coords and
    // real effective on-screen scale (camera zoom × sprite scale) from frame 1.
    // No repositioning or resize when the world reveals around him.
    this.scene.start('World');
  }

  private handleResize(): void {
    const { cx, cy } = this.center();
    this.bodyText?.setPosition(cx, cy);
    this.bodyText?.setWordWrapWidth(this.wrapWidth());
    this.positionPrompt();
  }

  private positionPrompt(): void {
    this.promptText?.setPosition(
      this.scale.width - PROMPT_MARGIN,
      this.scale.height - PROMPT_MARGIN,
    );
  }

  private wrapWidth(): number {
    return Math.max(120, this.scale.width - SIDE_PADDING * 2);
  }

  private center(): { cx: number; cy: number } {
    return { cx: this.scale.width / 2, cy: this.scale.height / 2 };
  }
}
