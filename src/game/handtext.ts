// Hand-drawn text for Phaser scenes (boot screen, intro, world UI).
//
// Same sprite strips and metrics as the DOM dialogue font (handfont.ts): each
// glyph is a 7-frame strip — idle 1-5 loop as a line boil, 6-7 are the
// left-hand glitch frames. Strips are white ink so `color` works as a tint.
//
// HandText is a Container of Images laid out from the metrics, so it can be
// positioned, faded, tweened and camera-ignored like any other GameObject.

import Phaser from 'phaser';
import { HANDFONT } from './content/handfont-metrics';

type Glyph = { file: string; cw: number; lsb: number; adv: number };
const glyphs = HANDFONT.glyphs as Record<string, Glyph>;

const ASSET_BASE = '/assets/handfont/';
const DENSITY = 2; // strips are exported at 2x their CSS size
const IDLE_FRAMES = 5;
const FRAME_MS = 125; // 8 fps
const GLITCH_MIN_GAP_MS = 2500;
const GLITCH_MAX_GAP_MS = 6000;
// Cap height of the metrics' 1x size, in px. `size` options are cap heights.
const METRIC_CAP = 20;

const ALIASES: Record<string, string> = {
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '—': '-',
  '–': '-',
};

const keyFor = (g: Glyph) => `hand-${g.file}`;
const glyphFor = (ch: string): Glyph | undefined => glyphs[ALIASES[ch] ?? ch];

/** Queue every glyph strip on a scene's loader. Call from a preload(). */
export function preloadHandText(scene: Phaser.Scene): void {
  const frameHeight = Math.round(HANDFONT.cellHeight * DENSITY);
  for (const g of Object.values(glyphs)) {
    if (scene.textures.exists(keyFor(g))) continue;
    scene.load.spritesheet(keyFor(g), `${ASSET_BASE}${g.file}.png`, {
      frameWidth: Math.round(g.cw * DENSITY),
      frameHeight,
    });
  }
  // pixelArt:true makes every texture NEAREST, which shreds crayon strokes
  // when they're scaled down. These are painted, not pixel art: smooth them.
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    for (const g of Object.values(glyphs)) {
      if (scene.textures.exists(keyFor(g))) {
        scene.textures.get(keyFor(g)).setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
  });
}

export type HandTextStyle = {
  /** Cap height in px. */
  size?: number;
  color?: string | number;
  align?: 'left' | 'center' | 'right';
  /** Wrap lines longer than this (px). */
  wrapWidth?: number;
  /** Extra px between lines. */
  lineSpacing?: number;
  backgroundColor?: string | number;
  padding?: { left?: number; right?: number; top?: number; bottom?: number };
};

type Unit = { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text; phase: number };

const toColor = (c: string | number): number =>
  typeof c === 'number' ? c : Phaser.Display.Color.HexStringToColor(c).color;

export class HandText extends Phaser.GameObjects.Container {
  private content: string;
  private styleOpts: Required<Omit<HandTextStyle, 'backgroundColor' | 'wrapWidth'>> &
    Pick<HandTextStyle, 'backgroundColor' | 'wrapWidth'>;
  private units: Unit[] = []; // one per character of `content` (null-ish for spaces)
  private charUnits: (Unit | null)[] = [];
  private bg?: Phaser.GameObjects.Rectangle;
  private anchorX = 0;
  private anchorY = 0;
  private tick = 0;
  private boilTimer?: Phaser.Time.TimerEvent;
  private glitchTimer?: Phaser.Time.TimerEvent;
  private visibleCount = Infinity;
  // How far children are currently shifted to honour the origin.
  private originShift: [number, number] = [0, 0];

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, style: HandTextStyle = {}) {
    super(scene, x, y);
    this.content = text;
    this.styleOpts = {
      size: style.size ?? 12,
      color: style.color ?? '#111111',
      align: style.align ?? 'left',
      wrapWidth: style.wrapWidth,
      lineSpacing: style.lineSpacing ?? 0,
      backgroundColor: style.backgroundColor,
      padding: style.padding ?? {},
    };
    scene.add.existing(this);
    this.layout();

    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      this.boilTimer = scene.time.addEvent({
        delay: FRAME_MS,
        loop: true,
        callback: () => {
          this.tick += 1;
          for (const u of this.units) {
            if (u.obj instanceof Phaser.GameObjects.Image) {
              u.obj.setFrame((this.tick + u.phase) % IDLE_FRAMES);
            }
          }
        },
      });
      this.scheduleGlitch();
    }
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.boilTimer?.remove(false);
      this.glitchTimer?.remove(false);
    });
  }

  private scheduleGlitch(): void {
    const gap = Phaser.Math.Between(GLITCH_MIN_GAP_MS, GLITCH_MAX_GAP_MS);
    this.glitchTimer = this.scene.time.delayedCall(gap, () => {
      const shown = this.units.filter(
        (u) => u.obj instanceof Phaser.GameObjects.Image && u.obj.visible
      );
      const pick = shown[Math.floor(Math.random() * shown.length)];
      if (pick) (pick.obj as Phaser.GameObjects.Image).setFrame(IDLE_FRAMES + Phaser.Math.Between(0, 1));
      this.scheduleGlitch();
    });
  }

  private get scaleK(): number {
    return this.styleOpts.size / METRIC_CAP;
  }

  private measureWord(word: string): number {
    const k = this.scaleK;
    let w = 0;
    for (const ch of word) {
      const g = glyphFor(ch);
      w += g ? (g.adv + HANDFONT.tracking) * k : this.fallbackWidth(ch);
    }
    return w;
  }

  private fallbackWidth(ch: string): number {
    return ch.length * this.styleOpts.size * 0.75;
  }

  private layout(): void {
    this.removeAll(true);
    this.originShift = [0, 0];
    this.units = [];
    this.charUnits = [];
    this.bg = undefined;

    const k = this.scaleK;
    const { size, align, wrapWidth, lineSpacing, color, padding } = this.styleOpts;
    const space = HANDFONT.space * k;
    const lineHeight = size * 1.6 + lineSpacing;
    const tint = toColor(color);

    // Break into lines of words, remembering each character's source index.
    type Word = { text: string; start: number };
    const lines: Word[][] = [];
    let idx = 0;
    for (const para of this.content.split('\n')) {
      let line: Word[] = [];
      let lineW = 0;
      const words = para.split(' ');
      for (let wi = 0; wi < words.length; wi++) {
        const text = words[wi];
        const w = this.measureWord(text);
        const add = (line.length ? space : 0) + w;
        if (wrapWidth && line.length && lineW + add > wrapWidth) {
          lines.push(line);
          line = [];
          lineW = 0;
        }
        lineW += (line.length ? space : 0) + w;
        line.push({ text, start: idx });
        idx += text.length + 1; // +1 for the space or newline that follows
      }
      lines.push(line);
    }

    const lineWidths = lines.map(
      (l) => l.reduce((s, w, i) => s + this.measureWord(w.text) + (i ? space : 0), 0)
    );
    const blockW = Math.max(0, ...lineWidths);
    const blockH = lines.length * lineHeight - lineSpacing;
    const baselineOffset = size * 1.25; // first baseline below the block top

    this.charUnits = new Array(this.content.length).fill(null);
    let glyphIndex = 0;
    lines.forEach((line, li) => {
      let pen =
        align === 'center' ? (blockW - lineWidths[li]) / 2 : align === 'right' ? blockW - lineWidths[li] : 0;
      const baseY = li * lineHeight + baselineOffset;
      line.forEach((word, wi) => {
        if (wi) pen += space;
        for (let ci = 0; ci < word.text.length; ci++) {
          const ch = word.text[ci];
          const g = glyphFor(ch);
          let unit: Unit;
          if (g && this.scene.textures.exists(keyFor(g))) {
            const img = this.scene.add
              .image(pen - g.lsb * k, baseY - HANDFONT.baseline * k, keyFor(g), glyphIndex % IDLE_FRAMES)
              .setOrigin(0, 0)
              .setScale(k / DENSITY)
              .setTint(tint);
            unit = { obj: img, phase: glyphIndex % IDLE_FRAMES };
            pen += (g.adv + HANDFONT.tracking) * k;
            glyphIndex += 1;
          } else {
            const t = this.scene.add
              .text(pen, baseY, ch, {
                fontFamily: 'monospace',
                fontSize: `${Math.round(size * 1.1)}px`,
                fontStyle: 'bold',
                color: typeof color === 'string' ? color : `#${color.toString(16).padStart(6, '0')}`,
              })
              .setOrigin(0, 0.8);
            unit = { obj: t, phase: 0 };
            pen += this.fallbackWidth(ch);
          }
          this.units.push(unit);
          this.charUnits[word.start + ci] = unit;
        }
      });
    });

    const padL = padding.left ?? 0;
    const padR = padding.right ?? 0;
    const padT = padding.top ?? 0;
    const padB = padding.bottom ?? 0;
    const totalW = blockW + padL + padR;
    const totalH = blockH + padT + padB;
    for (const u of this.units) {
      u.obj.x += padL;
      u.obj.y += padT;
    }
    if (this.styleOpts.backgroundColor !== undefined) {
      this.bg = this.scene.add
        .rectangle(0, 0, totalW, totalH, toColor(this.styleOpts.backgroundColor))
        .setOrigin(0, 0);
      this.addAt(this.bg, 0);
    }
    this.add(this.units.map((u) => u.obj));
    this.setSize(totalW, totalH);
    this.applyOrigin();
    this.applyVisibleCount();
  }

  // Containers position children relative to (x, y); emulate Text's origin
  // by shifting every child so (x, y) lands on the chosen anchor.
  private applyOrigin(): void {
    const dx = -this.width * this.anchorX;
    const dy = -this.height * this.anchorY;
    const [px, py] = this.originShift;
    for (const child of this.list as unknown as Phaser.GameObjects.Components.Transform[]) {
      child.x += dx - px;
      child.y += dy - py;
    }
    this.originShift = [dx, dy];
  }

  setOrigin(x: number, y: number = x): this {
    this.anchorX = x;
    this.anchorY = y;
    this.applyOrigin();
    return this;
  }

  setText(text: string): this {
    if (text === this.content) return this;
    this.content = text;
    this.layout();
    return this;
  }

  get text(): string {
    return this.content;
  }

  setWordWrapWidth(width: number): this {
    this.styleOpts.wrapWidth = width;
    this.layout();
    return this;
  }

  /** Cap height in px (mirrors Text#setFontSize for callers that shrink to fit). */
  setFontSize(size: number): this {
    this.styleOpts.size = size;
    this.layout();
    return this;
  }

  get fontSize(): number {
    return this.styleOpts.size;
  }

  /** Typewriter support: show only the first `n` characters (layout stays fixed). */
  setVisibleCount(n: number): this {
    this.visibleCount = n;
    this.applyVisibleCount();
    return this;
  }

  private applyVisibleCount(): void {
    this.charUnits.forEach((u, i) => {
      if (u) u.obj.setVisible(i < this.visibleCount);
    });
  }
}
