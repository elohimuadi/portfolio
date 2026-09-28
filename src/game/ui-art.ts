// Josh's hand-drawn UI pieces (boxes, arrows, squiggle), shared by the DOM
// dialogue (Game.astro) and the Phaser scenes. All images live in
// /assets/ui and are exported at 2x their on-screen size.

export const UI_BASE = '/assets/ui/';
export const UI_DENSITY = 2;
export const UI_FRAME_MS = 125; // 8 fps boil, same as the letters
// Boxes boil at half speed (4 fps) so the text stays the thing that moves.
export const BOX_FRAME_MS = 250;

// Whole-box drawings used as 9-slice frames. The inside is already filled
// white, following the drawn outline.
export const TEXTBOX_FRAMES = 6;
export const TITLEBOX_FRAMES = 12;
export const textboxUrl = (i: number) => `${UI_BASE}textbox-${i + 1}.png`;
export const titleboxUrl = (i: number) => `${UI_BASE}titlebox-${i + 1}.png`;
// How far in from each edge (image px) the corners end, for 9-slicing.
export const TEXTBOX_SLICE = 80;
export const TITLEBOX_SLICE = 40;

// Frame strips: one row, frames left to right.
export const SQUIGGLE = {
  key: 'ui-squiggle',
  url: `${UI_BASE}squiggle.png`,
  frameWidth: 56,
  frameHeight: 50,
  // First `growth` frames draw the squiggle in (bound to typing progress);
  // the remaining `complete` frames are finished squiggles that loop.
  growth: 24,
  complete: 11,
} as const;

export const ARROW_RIGHT = {
  key: 'ui-arrow-right',
  url: `${UI_BASE}arrow-right.png`,
  frameWidth: 60,
  frameHeight: 47,
  frames: 7,
} as const;

export const MARKER_DOWN = {
  key: 'ui-marker-down',
  url: `${UI_BASE}marker-down.png`,
  frameWidth: 53,
  frameHeight: 58,
  frames: 7,
} as const;

// "Look" prompt at the bottom of the screen: an eye with an E in it. Frames
// 0-3 open it (closed -> half), frames 4-8 are the fully open loop.
export const EYE = {
  key: 'ui-eye',
  url: `${UI_BASE}eye.png`,
  frameWidth: 135,
  frameHeight: 67,
  frames: 9,
  opening: 4,
} as const;

// Lavender sprig that grows in behind the selected choice (left to right).
export const SELECT = {
  key: 'ui-select',
  url: `${UI_BASE}select.png`,
  frameWidth: 340,
  frameHeight: 90,
  frames: 7,
  frameMs: 40, // quick grow: ~0.3s for the whole sprig
} as const;
