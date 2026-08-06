import Phaser from 'phaser';
import {
  EVT_CHOICE_CONFIRMED,
  EVT_HIDE_CHOICES,
  EVT_INTERACT,
  EVT_NEAREST_CHANGED,
  EVT_SHOW_CHOICES,
  interactionState,
  type ChoiceConfirmedDetail,
  type InteractDetail,
  type NearestChangedDetail,
  type ShowChoicesDetail,
} from '../state';
import {
  CLAUDE_IDLE_KEY,
  CROSS_ANIM_KEY,
  GOJOCAT_IDLE_KEY,
  MAP_SHEET_KEY,
  MUSIC_PLAYER_ANIM_KEY,
  NPC_SHEET_KEY,
  POMPOMPURIN_IDLE_KEY,
  PROP_SHEET_KEY,
  SHOYA_IDLE_KEY,
} from './BootScene';

const PLAYER_SIZE = 32; // 32×32 sprite frame
const PLAYER_BODY_WIDTH = 20; // slim horizontal footprint — walls feel like they end at the character's visible edges
const PLAYER_BODY_HEIGHT = 19; // ~bottom 60% of the frame — feet to mid-torso; head slips behind foliage
const PLAYER_SPRITE_SCALE = 1.25; // visual only — body dimensions stay in world units
const PLAYER_SPEED = 76;
const INTERACT_RADIUS = 22;
const MIN_CAMERA_ZOOM = 2; // floor zoom so pixels stay chunky on small viewports
const CAMERA_LERP = 0.35; // higher = snappier follow; low values look laggy on fast movement
// Map overlay image is scaled (up or down) to fill ~80% of the current
// canvas width. MAP_OVERLAY_HEIGHT_RATIO is a safety cap so a tall/narrow
// viewport can't stretch it past 80% of the height either — whichever ratio
// is tighter wins, so aspect ratio is always preserved.
const MAP_OVERLAY_WIDTH_RATIO = 0.8;
const MAP_OVERLAY_HEIGHT_RATIO = 0.8;
const MAP_DOT_RADIUS = 3;
const MAP_DOT_COLOR = 0x8a7a94; // desaturated purple
// Negative offset shifts the follow focus below the player, biasing the viewport
// down so the player sits higher on screen (undoes visible top padding).
const CAMERA_FOLLOW_OFFSET_Y = -40;

// Yes/No choice UI — pure Phaser (Graphics/Text on the UI camera), no DOM
// involved. Positioned above-right of where the DOM dialogue box sits
// (dialogue-layer's own right padding is 16px; CHOICE_BOX_MARGIN_BOTTOM is a
// fixed clearance estimate for the dialogue box's typical rendered height —
// Phaser has no visibility into the DOM box's actual height, so this is an
// approximation, not a measurement).
const CHOICE_BOX_WIDTH = 180;
const CHOICE_ROW_HEIGHT = 26;
const CHOICE_BOX_PADDING = 12;
const CHOICE_BOX_MARGIN_RIGHT = 16;
const CHOICE_BOX_MARGIN_BOTTOM = 210;
const CHOICE_TEXT_START_X = CHOICE_BOX_PADDING + 18; // leaves room for the arrow
const CHOICE_BG_COLOR = 0x000000;
const CHOICE_BORDER_COLOR = 0xf6f4ee;
const CHOICE_BORDER_WIDTH = 3;
const CHOICE_TEXT_COLOR = '#ffffff';

// Wind sway — foliage layers get a subtle intermittent horizontal swing.
// Amplitudes stay in single-pixel territory so any player-vs-wall collision
// wobble stays below what pixel-art rendering can even resolve.
const WIND_SWING_PERIOD_MS = 320;
const WIND_AMP_TREES = 1.4;
const WIND_AMP_BUSHES = 1.1;

// Intro reveal — Omori-style: everything is set to its final position and scale
// during create(), then character alpha ramps up on a solid white background,
// holds briefly, then the world alpha ramps up around him. Zero motion of any
// game object during the reveal — pure opacity transition.
const INTRO_CHAR_FADE_MS = 800;
const INTRO_CHAR_HOLD_MS = 400;
const INTRO_WORLD_REVEAL_MS = 800;
const INTRO_WORLD_START_MS = INTRO_CHAR_FADE_MS + INTRO_CHAR_HOLD_MS;

// NPCs — placed in tile coords (converted to world pixels via TILE_SIZE) so the
// authoring position matches what's visible in Tiled.
const TILE_SIZE = 32;
// Wall/wall2/wal3 tiles (trees, bushes) collide only on their bottom slice so
// the player can walk behind the foliage tops for a 2.5D depth effect.
const WALL_COLLISION_HEIGHT = 12;
// Verified against map.tmj: a 7×7 block of plain grass tiles (id 15), clear
// of wall/wall2/wal3 collision and dirt-path tiles, and away from the other
// interactables/spawn.
const GOJOCAT_TILE_X = 12;
const GOJOCAT_TILE_Y = 12;
const GOJOCAT_ID = 'gojocat';
// Collision box on gojocat's base/body only — the transparent top and the
// visible head/ears have no collision, so the player's body slides past them
// cleanly instead of catching on empty pixels.
const GOJOCAT_BODY_WIDTH = 20;
const GOJOCAT_BODY_HEIGHT = 14;
// Frame indices into NPC_SHEET_KEY for each NPC's first idle frame (matches
// the anim's first frame, used as the sprite's initial static frame before
// the looping anim takes over).
const GOJOCAT_FRAME = 0;

// Verified against map.tmj: a 7×7 block of plain grass tiles (id 15), clear
// of wall/wall2/wal3 collision and dirt-path tiles — in the far southeast
// grass field, well separated from gojocat's spot in the northwest.
const POMPOMPURIN_TILE_X = 69;
const POMPOMPURIN_TILE_Y = 48;
const POMPOMPURIN_ID = 'pompompurin';
const POMPOMPURIN_BODY_WIDTH = 22;
const POMPOMPURIN_BODY_HEIGHT = 16;
const POMPOMPURIN_FRAME = 2;

// Shoya sits in the "top diamond" alongside the hobby items, on the plaza's
// dirt path itself (verified against map.tmj: ground id 29, unblocked,
// >= 2 tiles from the cross at (40,6)).
const SHOYA_TILE_X = 38;
const SHOYA_TILE_Y = 8;
const SHOYA_ID = 'shoya';
const SHOYA_BODY_WIDTH = 20;
const SHOYA_BODY_HEIGHT = 14;
const SHOYA_FRAME = 4;

// Claude sits in the west diamond plaza (verified against map.tmj: ground id
// 29, unblocked, well clear of the corridor at rows 29-30 and the
// project_hakari fallback interactable point near (9,30)).
const CLAUDE_TILE_X = 9;
const CLAUDE_TILE_Y = 26;
const CLAUDE_ID = 'claude';
// Trimmed to Claude's small blob silhouette (full sprite bbox is only 16×12px,
// vs. Shoya's near-full-frame 22×32px) — base-only, same "no collision on the
// head" convention as the other NPCs.
const CLAUDE_BODY_WIDTH = 14;
const CLAUDE_BODY_HEIGHT = 8;
const CLAUDE_FRAME = 7;

// All NPCs use a collision box covering only their base/body — the
// transparent top and visible head have no collision, so the player's body
// slides past them cleanly instead of catching on empty pixels. That base-only
// box means the player can approach much closer from the top (no collision
// there) than from the sides/bottom (blocked by the box); a radius sized for
// the tight approach directions would put the loose one out of INTERACT_RADIUS,
// so NPCs get a wider radius covering the farthest reachable point (the
// blocked approach) so "press E" works from all 4 sides.
const NPC_INTERACT_RADIUS = 30;

// Decorative props from the smollitems spritesheet. Each bbox is the trimmed
// pixel bounds of that prop's first/only frame within its 32×32 cell (top,
// bottom, left, right — all inclusive), used to size and position a
// pixel-accurate static collision box instead of colliding on the full
// transparent frame.
type PropBBox = { top: number; bottom: number; left: number; right: number };
type PropDef = {
  frame: number;
  animKey?: string;
  bbox: PropBBox;
  scale?: number; // defaults to 1
  collides?: boolean; // defaults to true; false = purely decorative, no physics body
  interactable?: boolean; // defaults to true for hobby items; flowers never register one regardless
  offsetX?: number; // sub-tile pixel nudge applied after tile-to-pixel conversion; defaults to 0
  offsetY?: number; // same, vertical; defaults to 0
  // Overrides NPC_INTERACT_RADIUS. Needed for items whose collision box (at
  // their `scale`) is big enough that the interactable's center point ends
  // up inside the solid body — the player can never close the remaining
  // gap on the side where the box extends furthest, so the default radius
  // is unreachable from that direction no matter how the player approaches.
  interactRadius?: number;
};

// Flowers (and the small grass-detail tuft) scatter across every grass tile
// on the map and are purely decorative — collides:false means no physics
// body at all, so the player walks through them freely. Frames 0 and 1 are
// two distinct static flowers (sparse single-stalk lavender vs. a fuller
// bushy one) — not sway-frames of one plant.
const FLOWER_DEFS = {
  lavenderSparse: { frame: 0, bbox: { top: 11, bottom: 26, left: 11, right: 18 }, collides: false, interactable: false },
  lavenderBushy: { frame: 1, bbox: { top: 7, bottom: 25, left: 13, right: 19 }, collides: false, interactable: false },
  forgetMeNot: { frame: 2, bbox: { top: 11, bottom: 25, left: 12, right: 18 }, collides: false, interactable: false },
  marigold: { frame: 3, bbox: { top: 18, bottom: 27, left: 12, right: 18 }, collides: false, interactable: false },
  daisy: { frame: 4, bbox: { top: 17, bottom: 27, left: 13, right: 16 }, collides: false, interactable: false },
  // Small green grass tuft/mark — no bloom, just ground texture detail.
  grassDetail: { frame: 6, bbox: { top: 15, bottom: 22, left: 10, right: 17 }, collides: false, interactable: false },
} as const satisfies Record<string, PropDef>;

// Hobby items are confined to the top diamond's dirt path only (never grass).
const HOBBY_DEFS = {
  cross: {
    frame: 11,
    animKey: CROSS_ANIM_KEY,
    bbox: { top: 4, bottom: 31, left: 7, right: 24 },
    scale: 2,
    collides: true,
    interactable: true,
    offsetX: -50, // -25 previously, nudged another 25px further left
    offsetY: -5,
    // At scale 2 the collision box is 36×56px, big enough that the
    // interactable center sits inside it — approaching from the north, the
    // closest the player's body can get is 49.5px away (verified by
    // computing the box's actual scaled bounds), so the default
    // NPC_INTERACT_RADIUS (30) is geometrically unreachable from that side
    // no matter how the player approaches. This is comfortably above that.
    interactRadius: 55,
  },
  // Sheet's closest sports/achievement icon is a boxing glove — used here for "trophy".
  trophy: { frame: 8, bbox: { top: 2, bottom: 23, left: 6, right: 23 }, collides: true, interactable: true },
  bookDark: { frame: 9, bbox: { top: 5, bottom: 24, left: 1, right: 27 }, collides: true, interactable: true },
  bookPurple: { frame: 10, bbox: { top: 5, bottom: 23, left: 4, right: 30 }, collides: true, interactable: true },
  basketballVolleyball: {
    frame: 28,
    bbox: { top: 9, bottom: 26, left: 2, right: 30 },
    collides: true,
    interactable: true,
  },
  boba: { frame: 29, bbox: { top: 10, bottom: 27, left: 7, right: 24 }, collides: true, interactable: true },
  musicPlayer: {
    frame: 30,
    animKey: MUSIC_PLAYER_ANIM_KEY,
    bbox: { top: 4, bottom: 26, left: 2, right: 26 },
    collides: true,
    interactable: true,
  },
} as const satisfies Record<string, PropDef>;

const PROP_DEFS = { ...FLOWER_DEFS, ...HOBBY_DEFS };
type PropKind = keyof typeof PROP_DEFS;

// All hobby items (including the cross) are interactable; flowers are not.
const HOBBY_KIND_SET = new Set<PropKind>(Object.keys(HOBBY_DEFS) as PropKind[]);
function isHobbyKind(kind: PropKind): boolean {
  return HOBBY_KIND_SET.has(kind);
}

// One of each hobby item except the cross and boba, which get fixed
// positions below.
const HOBBY_SCATTER_KINDS = [
  'trophy',
  'bookDark',
  'bookPurple',
  'basketballVolleyball',
  'musicPlayer',
] as const satisfies ReadonlyArray<keyof typeof HOBBY_DEFS>;

// Lavender (both variants combined) makes up ~50% of all flowers (100 of
// 200); the other 50% splits evenly across forget-me-not/marigold/daisy
// (~33 each). grassDetail is ground texture, not a "flower", so it keeps its
// own count independent of the lavender-dominance ask.
const FLOWER_KIND_INSTANCE_COUNTS: Record<keyof typeof FLOWER_DEFS, number> = {
  lavenderSparse: 50,
  lavenderBushy: 50,
  forgetMeNot: 34,
  marigold: 33,
  daisy: 33,
  grassDetail: 25,
};
const FLOWER_SCATTER_KINDS: ReadonlyArray<keyof typeof FLOWER_DEFS> = (
  Object.keys(FLOWER_DEFS) as Array<keyof typeof FLOWER_DEFS>
).flatMap((kind) => Array(FLOWER_KIND_INSTANCE_COUNTS[kind]).fill(kind));

// Cross and boba swapped spots — boba now sits where the cross used to (dead
// center of the plaza). Row 1 (the diamond's tip) only has 2 valid dirt
// cells (39-40), so there's no room to nudge right while staying there;
// moved one row down to row 2 (dirt cols 38-41) at col 41 — still right at
// the top of the diamond, verified clear dirt, well spaced from boba/Shoya.
const CROSS_TILE_X = 41;
const CROSS_TILE_Y = 2;
const BOBA_TILE_X = 40;
const BOBA_TILE_Y = 6;

// Hard-coded boundary of the top diamond's dirt path, one entry per row —
// verified directly against map.tmj's ground layer: the plaza's path is a
// true rhombus, a 2-tile-wide point at rows 1/10 widening to 10 tiles at
// rows 5-6, centered on col 40. These are the path's own cells (no margin —
// hobby items belong ON the dirt, not the grass around it). Any tile outside
// these exact ranges is never a placement candidate for a hobby item.
const DIAMOND_ROW_BOUNDS: ReadonlyArray<{ row: number; colMin: number; colMax: number }> = [
  { row: 1, colMin: 39, colMax: 40 },
  { row: 2, colMin: 38, colMax: 41 },
  { row: 3, colMin: 37, colMax: 42 },
  { row: 4, colMin: 36, colMax: 43 },
  { row: 5, colMin: 35, colMax: 44 },
  { row: 6, colMin: 35, colMax: 44 },
  { row: 7, colMin: 36, colMax: 43 },
  { row: 8, colMin: 37, colMax: 42 },
  { row: 9, colMin: 38, colMax: 41 },
  { row: 10, colMin: 39, colMax: 40 },
];

// Ground layer tile ids (verified against map.tmj): 15 is plain grass, 29 is
// the dirt/path tile used for the diamond plaza.
const GRASS_TILE_INDEX = 15;
const PATH_TILE_INDEX = 29;

const MIN_PROP_SPACING_TILES = 2;
// Fixed seed so the "natural" scatter is stable across reloads instead of
// reshuffling on every page load.
const PROP_PLACEMENT_SEED = 1337;

type TilePos = { col: number; row: number };

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Ground tile at (col, row) matches expectedIndex and isn't blocked by any of
// the collidable tile layers. Used both to build candidate pools and, again,
// as the "read the tile ID and confirm before spawning" check placeKinds
// runs on every candidate it draws.
function hasTerrain(
  map: Phaser.Tilemaps.Tilemap,
  col: number,
  row: number,
  expectedIndex: number
): boolean {
  const ground = map.getTileAt(col, row, false, 'ground');
  if (!ground || ground.index !== expectedIndex) return false;
  const blockedOn = (layerName: string) => {
    const tile = map.getTileAt(col, row, false, layerName);
    return !!tile && tile.index > 0;
  };
  return !blockedOn('wall') && !blockedOn('wall2') && !blockedOn('wal3');
}

function collectWholeMapGrassCandidates(map: Phaser.Tilemaps.Tilemap): TilePos[] {
  const candidates: TilePos[] = [];
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      if (hasTerrain(map, col, row, GRASS_TILE_INDEX)) candidates.push({ col, row });
    }
  }
  return candidates;
}

// Candidates are only ever generated from DIAMOND_ROW_BOUNDS's exact per-row
// ranges — a tile outside those ranges can never be produced here.
function collectDiamondDirtCandidates(map: Phaser.Tilemaps.Tilemap): TilePos[] {
  const candidates: TilePos[] = [];
  for (const bound of DIAMOND_ROW_BOUNDS) {
    for (let col = bound.colMin; col <= bound.colMax; col++) {
      if (hasTerrain(map, col, bound.row, PATH_TILE_INDEX)) candidates.push({ col, row: bound.row });
    }
  }
  return candidates;
}

function isFarEnough(pos: TilePos, occupied: readonly TilePos[]): boolean {
  const minSq = MIN_PROP_SPACING_TILES * MIN_PROP_SPACING_TILES;
  return occupied.every((o) => {
    const dx = o.col - pos.col;
    const dy = o.row - pos.row;
    return dx * dx + dy * dy >= minSq;
  });
}

// Greedily walks a shuffled candidate pool, handing each requested kind the
// first candidate that (a) still has the expected terrain underneath — read
// fresh from the ground layer and rejected/retried with the next candidate
// if it doesn't match — and (b) is at least MIN_PROP_SPACING_TILES from
// every position already occupied (previously placed items included).
// `occupied` is mutated as placements are accepted so later calls (e.g.
// flowers placed after hobby items) keep respecting earlier ones.
function placeKinds<K extends PropKind>(
  map: Phaser.Tilemaps.Tilemap,
  expectedTileIndex: number,
  kinds: readonly K[],
  candidates: readonly TilePos[],
  occupied: TilePos[],
  rng: () => number
): Array<{ kind: K; tileX: number; tileY: number }> {
  const pool = shuffled(candidates, rng);
  const placements: Array<{ kind: K; tileX: number; tileY: number }> = [];
  let cursor = 0;
  for (const kind of kinds) {
    while (cursor < pool.length) {
      const candidate = pool[cursor++];
      if (!hasTerrain(map, candidate.col, candidate.row, expectedTileIndex)) continue;
      if (isFarEnough(candidate, occupied)) {
        placements.push({ kind, tileX: candidate.col, tileY: candidate.row });
        occupied.push(candidate);
        break;
      }
    }
  }
  return placements;
}

type Interactable = {
  id: string;
  centerX: number;
  centerY: number;
  radius?: number; // defaults to INTERACT_RADIUS when omitted
};

// Fallback interactables used when the map has no "objects" layer yet.
// Coords are the centers (in world pixels) of the cross-arm platforms on
// mapv1. Once the tmj ships an "objects" layer, these get ignored. The old
// "about" placeholder (top diamond, empty dirt) was removed — that spot is
// now occupied by the real cross interactable.
const FALLBACK_INTERACTABLES: ReadonlyArray<Interactable> = [
  { id: 'project_sidequest', centerX: 2260, centerY: 960 },
  { id: 'contact', centerX: 1280, centerY: 1720 },
  { id: 'project_hakari', centerX: 300, centerY: 960 },
];

type Facing = 'down' | 'left' | 'right' | 'up';

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private facing: Facing = 'down';
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private keyE!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;
  private keyM!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private interactables: Interactable[] = [];
  private marker?: Phaser.GameObjects.Triangle;
  private hint?: Phaser.GameObjects.Text;
  private controlsHint?: Phaser.GameObjects.Text;
  private controlsOverlayBg?: Phaser.GameObjects.Rectangle;
  private controlsOverlayText?: Phaser.GameObjects.Text;
  private controlsOpen = false;
  private mapOverlayBg?: Phaser.GameObjects.Rectangle;
  private mapImage?: Phaser.GameObjects.Image;
  private mapDot?: Phaser.GameObjects.Arc;
  private mapOpen = false;
  private choiceBg?: Phaser.GameObjects.Graphics;
  private choiceArrow?: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private choiceLabels: string[] = [];
  private selectedChoiceIndex = 0;
  private markerBaseY = 0;
  private modalWasOpen = false;
  private groundLayer?: Phaser.Tilemaps.TilemapLayer;
  private wallLayer?: Phaser.Tilemaps.TilemapLayer;
  private wall2Layer?: Phaser.Tilemaps.TilemapLayer;
  private wal3Layer?: Phaser.Tilemaps.TilemapLayer;
  private mapWidthPx = 0;
  private mapHeightPx = 0;
  private wind = { amp: 0 };
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private gojocat?: Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
  private pompompurin?: Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
  private shoya?: Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
  private claude?: Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
  private props: Phaser.GameObjects.Sprite[] = [];
  private introComplete = false;

  constructor() {
    super({ key: 'World' });
  }

  create(): void {
    // White during intro (the world layers cover the viewport once the reveal
    // completes, so this stays white for the rest of the session — never seen).
    this.cameras.main.setBackgroundColor('#ffffff');

    const map = this.make.tilemap({ key: 'map' });
    const grassdirt = map.addTilesetImage('grassdirt', 'tiles-grassdirt');
    const largeitem = map.addTilesetImage('largeitem', 'tiles-largeitem');
    const miditem = map.addTilesetImage('miditem', 'tiles-miditem');
    const smallitems = map.addTilesetImage('smallitems', 'tiles-smallitems');
    if (!grassdirt || !largeitem || !miditem || !smallitems) {
      throw new Error('Failed to bind one or more tilesets to the tilemap.');
    }

    const allTilesets = [grassdirt, largeitem, miditem, smallitems];
    const ground = map.createLayer('ground', allTilesets, 0, 0);
    const wall = map.createLayer('wall', allTilesets, 0, 0);
    const wall2 = map.createLayer('wall2', allTilesets, 0, 0);
    const wal3 = map.createLayer('wal3', allTilesets, 0, 0);
    if (!ground || !wall || !wall2 || !wal3) {
      throw new Error('Missing one or more expected tile layers in map.');
    }
    // Collision on wall/wall2/wal3 is handled by a trimmed static group built
    // below — one rectangle per placed tile, sized to the tile's bottom slice
    // (see WALL_COLLISION_HEIGHT). We deliberately skip setCollisionByExclusion
    // and don't register a collider against the layer itself, so the tops of
    // trees and bushes have no collision at all.

    this.groundLayer = ground;
    this.wallLayer = wall;
    this.wall2Layer = wall2;
    this.wal3Layer = wal3;
    this.mapWidthPx = map.widthInPixels;
    this.mapHeightPx = map.heightInPixels;

    const { spawn, interactables } = this.parseObjects(map);
    this.interactables = interactables;

    this.player = this.spawnPlayer(spawn.x, spawn.y);
    const wallColliders = this.buildTrimmedWallColliders(
      [wall, wall2, wal3],
      WALL_COLLISION_HEIGHT
    );
    this.physics.add.collider(this.player, wallColliders);

    this.gojocat = this.spawnGojocat();
    this.physics.add.collider(this.player, this.gojocat);
    this.interactables.push({
      id: GOJOCAT_ID,
      // Anchor the interact marker vertically at the gojocat frame center
      // (independent of the trimmed collision box) so the "↓" hovers over the
      // sprite's body, not down at his feet.
      centerX: this.gojocat.x,
      centerY: this.gojocat.y - TILE_SIZE / 2,
      radius: NPC_INTERACT_RADIUS,
    });

    this.pompompurin = this.spawnPompompurin();
    this.physics.add.collider(this.player, this.pompompurin);
    this.interactables.push({
      id: POMPOMPURIN_ID,
      centerX: this.pompompurin.x,
      centerY: this.pompompurin.y - TILE_SIZE / 2,
      radius: NPC_INTERACT_RADIUS,
    });

    this.shoya = this.spawnShoya();
    this.physics.add.collider(this.player, this.shoya);
    this.interactables.push({
      id: SHOYA_ID,
      centerX: this.shoya.x,
      centerY: this.shoya.y - TILE_SIZE / 2,
      radius: NPC_INTERACT_RADIUS,
    });

    this.claude = this.spawnClaude();
    this.physics.add.collider(this.player, this.claude);
    this.interactables.push({
      id: CLAUDE_ID,
      centerX: this.claude.x,
      centerY: this.claude.y - TILE_SIZE / 2,
      radius: NPC_INTERACT_RADIUS,
    });

    // Flowers/grass-detail have no physics body at all (collides:false), so
    // only the subset that does collide (hobby items) goes into the collider.
    const collidableProps: Phaser.Types.Physics.Arcade.SpriteWithStaticBody[] = [];
    this.props = this.buildPropPlacements(map)
      // Final read-the-tile-ID-and-confirm pass, including the fixed cross
      // entry (which skips placeKinds' own check since it isn't drawn from a
      // candidate pool) — reject anything whose ground tile doesn't match
      // its kind's expected terrain right before spawning it.
      .filter((placement) =>
        hasTerrain(
          map,
          placement.tileX,
          placement.tileY,
          isHobbyKind(placement.kind) ? PATH_TILE_INDEX : GRASS_TILE_INDEX
        )
      )
      .map((placement) => {
        // Explicit PropDef annotation: PROP_DEFS' `as const satisfies` typing
        // keeps each entry's narrow literal type (only the keys it actually
        // wrote), so indexing by the PropKind union errors on any optional
        // field not present on every entry. Widening to PropDef here (a
        // valid upcast) restores normal optional-field semantics.
        const def: PropDef = PROP_DEFS[placement.kind];
        const sprite = this.spawnProp(placement.tileX, placement.tileY, def);
        if (def.collides !== false) {
          collidableProps.push(sprite as Phaser.Types.Physics.Arcade.SpriteWithStaticBody);
        }
        if (isHobbyKind(placement.kind) && def.interactable !== false) {
          this.interactables.push({
            id: placement.kind,
            centerX: sprite.x,
            centerY: sprite.y - TILE_SIZE / 2,
            radius: def.interactRadius ?? NPC_INTERACT_RADIUS,
          });
        }
        return sprite;
      });
    this.physics.add.collider(this.player, collidableProps);

    this.cameras.main.setBounds(0, 0, this.mapWidthPx, this.mapHeightPx);
    this.physics.world.setBounds(0, 0, this.mapWidthPx, this.mapHeightPx);

    // Set final zoom BEFORE follow/centerOn — Phaser's scroll math for both
    // uses the current zoom, so applying zoom last would leave centerOn's
    // scroll wrong on frame 1 and cause a visible camera jump into place.
    this.createMarker();
    this.createHint();
    this.createControlsHint();
    this.createControlsOverlay();
    this.createMapOverlay();
    this.createChoiceUI();
    this.setupUICamera();
    this.updateCameraZoom();

    this.cameras.main.startFollow(
      this.player,
      true,
      CAMERA_LERP,
      CAMERA_LERP,
      0,
      CAMERA_FOLLOW_OFFSET_Y
    );
    // Snap the camera onto the follow target immediately so the player's
    // screen position matches its final gameplay position from frame 1.
    // Without this, lerp eases scroll from (0,0) toward spawn over several
    // frames and the player visibly slides into place during the reveal.
    this.cameras.main.centerOn(
      this.player.x,
      this.player.y - CAMERA_FOLLOW_OFFSET_Y
    );

    this.setupInput();
    this.setupWind();
    this.setupChoiceEvents();

    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.handleResize, this);
    });

    interactionState.modalOpen = false;
    interactionState.nearestInteractable = null;

    this.startIntroReveal();
  }

  private startIntroReveal(): void {
    // Everything is already at its final position/scale in the scene graph.
    // We only manipulate alpha — no repositioning, no rescaling.
    const worldTargets = [
      this.groundLayer,
      this.wallLayer,
      this.wall2Layer,
      this.wal3Layer,
      this.gojocat,
      this.pompompurin,
      this.shoya,
      this.claude,
      ...this.props,
      this.controlsHint,
    ].filter((t): t is NonNullable<typeof t> => t !== undefined);

    for (const target of worldTargets) target.setAlpha(0);
    this.player.setAlpha(0);

    // Phase 1: character-only reveal on white.
    this.tweens.add({
      targets: this.player,
      alpha: 1,
      duration: INTRO_CHAR_FADE_MS,
    });

    // Phase 2 (implicit hold) then Phase 3: world reveals around the character.
    this.time.delayedCall(INTRO_WORLD_START_MS, () => {
      this.tweens.add({
        targets: worldTargets,
        alpha: 1,
        duration: INTRO_WORLD_REVEAL_MS,
        onComplete: () => {
          this.introComplete = true;
        },
      });
    });
  }

  update(): void {
    if (!this.player?.body) return;

    this.updateDepthSort();

    if (!this.introComplete) {
      // Freeze the world during the reveal. Player anim (idle-down) keeps
      // playing because it was started in spawnPlayer(); wind/tile positions
      // stay put because applyWindSway() never runs; input is ignored.
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return;
    }

    if (this.controlsOpen) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.player.anims.play(`idle-${this.facing}`, true);
      this.setMarkerTarget(null);
      this.setHintVisible(false);
      if (
        Phaser.Input.Keyboard.JustDown(this.keyC) ||
        Phaser.Input.Keyboard.JustDown(this.keyEsc)
      ) {
        this.closeControls();
      }
      return;
    }

    if (this.mapOpen) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.player.anims.play(`idle-${this.facing}`, true);
      this.setMarkerTarget(null);
      this.setHintVisible(false);
      if (
        Phaser.Input.Keyboard.JustDown(this.keyM) ||
        Phaser.Input.Keyboard.JustDown(this.keyEsc)
      ) {
        this.closeMap();
      }
      return;
    }

    if (interactionState.modalOpen) {
      this.modalWasOpen = true;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.player.anims.play(`idle-${this.facing}`, true);
      this.setMarkerTarget(null);
      this.setHintVisible(false);
      if (interactionState.choicesOpen) {
        this.handleChoiceInput();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyC)) {
      this.openControls();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyM)) {
      this.openMap();
      return;
    }

    this.handleMovement();
    this.applyWindSway();
    const nearest = this.findNearestInteractable();
    this.syncNearest(nearest);

    if (this.modalWasOpen) {
      // The keypress that closed the dialogue also flipped Phaser's just-down
      // flag on E/Space. Consume them this frame so we don't immediately
      // re-trigger interact on the same press.
      this.modalWasOpen = false;
      Phaser.Input.Keyboard.JustDown(this.keyE);
      Phaser.Input.Keyboard.JustDown(this.keySpace);
      return;
    }

    this.handleInteractKeys(nearest);
  }

  private updateDepthSort(): void {
    // Y-sort: whoever is lower on screen (larger y) renders in front, so the
    // player, NPCs, and props occlude each other correctly as they cross paths.
    this.player.setDepth(this.player.y);
    this.gojocat?.setDepth(this.gojocat.y);
    this.pompompurin?.setDepth(this.pompompurin.y);
    this.shoya?.setDepth(this.shoya.y);
    this.claude?.setDepth(this.claude.y);
    for (const prop of this.props) prop.setDepth(prop.y);
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error('Keyboard input unavailable.');
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyC = kb.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.keyM = kb.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  private parseObjects(map: Phaser.Tilemaps.Tilemap): {
    spawn: { x: number; y: number };
    interactables: Interactable[];
  } {
    // Center-of-map fallback used when the map has no "objects" layer yet
    // — the interaction system stays wired, there just aren't any targets.
    const centerSpawn = {
      x: map.widthInPixels / 2,
      y: map.heightInPixels / 2,
    };
    const objectLayer = map.getObjectLayer('objects');
    if (!objectLayer) {
      return { spawn: centerSpawn, interactables: [...FALLBACK_INTERACTABLES] };
    }

    let spawn = centerSpawn;
    const interactables: Interactable[] = [];

    for (const obj of objectLayer.objects) {
      const cx = (obj.x ?? 0) + (obj.width ?? 0) / 2;
      const cy = (obj.y ?? 0) + (obj.height ?? 0) / 2;

      if (obj.type === 'spawn') {
        spawn = { x: cx, y: (obj.y ?? 0) + (obj.height ?? 0) };
        continue;
      }
      if (obj.type === 'interactable') {
        const idProp = (obj.properties as Array<{ name: string; value: unknown }> | undefined)?.find(
          (p) => p.name === 'id'
        );
        const id = typeof idProp?.value === 'string' ? idProp.value : obj.name;
        if (!id) continue;
        interactables.push({ id, centerX: cx, centerY: cy });
      }
    }

    return { spawn, interactables };
  }

  private spawnPlayer(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    // Sprite origin (0.5, 1) → bottom-center of the visual sits at (x, y) (the "feet").
    // Body dimensions are in world units (unaffected by sprite scale); the offset
    // is texture-local, so we center horizontally and anchor the body at the feet
    // inside the 32×32 frame. Body is narrower than the frame and only ~60% of
    // its height (feet through mid-torso), so the head slips behind foliage.
    const sprite = this.physics.add
      .sprite(x, y, 'player', 0)
      .setOrigin(0.5, 1)
      .setScale(PLAYER_SPRITE_SCALE);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT, false);
    body.setOffset(
      (PLAYER_SIZE - PLAYER_BODY_WIDTH) / 2,
      PLAYER_SIZE - PLAYER_BODY_HEIGHT
    );
    body.setCollideWorldBounds(true);
    sprite.anims.play(`idle-${this.facing}`);
    return sprite;
  }

  private buildTrimmedWallColliders(
    layers: Phaser.Tilemaps.TilemapLayer[],
    bodyHeight: number
  ): Phaser.Physics.Arcade.StaticGroup {
    // One invisible static rectangle per placed tile, sized to the tile's
    // bottom `bodyHeight` px. Uses tile world coords (not layer.x, which the
    // wind sway nudges by ~1 px — imperceptibly out of sync). Empty positions
    // in the Tiled layer have index -1 or 0 and are skipped.
    const group = this.physics.add.staticGroup();
    for (const layer of layers) {
      layer.forEachTile((tile) => {
        if (tile.index <= 0) return;
        const cx = tile.pixelX + TILE_SIZE / 2;
        const cy = tile.pixelY + TILE_SIZE - bodyHeight / 2;
        const rect = this.add.rectangle(cx, cy, TILE_SIZE, bodyHeight);
        rect.setVisible(false);
        this.physics.add.existing(rect, true);
        group.add(rect);
      });
    }
    return group;
  }

  private spawnNpc(
    tileX: number,
    tileY: number,
    frame: number,
    bodyWidth: number,
    bodyHeight: number,
    idleKey: string,
    scale: number = 1
  ): Phaser.Types.Physics.Arcade.SpriteWithStaticBody {
    // Origin (0.5, 1) matches the player convention: (x, y) is the feet, so the
    // sprite sits flush on the tile row it's placed on — feet land on the
    // bottom edge of (tileX, tileY).
    const feetX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const feetY = (tileY + 1) * TILE_SIZE;

    const sprite = this.physics.add
      .staticSprite(feetX, feetY, NPC_SHEET_KEY, frame)
      .setOrigin(0.5, 1)
      .setScale(scale);

    // StaticBody note: `updateFromGameObject()` overwrites width/height back to
    // the sprite's full displayWidth/displayHeight, undoing setSize. So we size
    // the body, then manually place its top-left based on the feet anchor, and
    // call `updateCenter()` (which just rebuilds the center from position + half
    // dimensions). This gives a slim collision box the player can push against
    // without walking through. bodyWidth/bodyHeight are unscaled (32px-frame)
    // measurements, so they're scaled here to match the visually resized sprite.
    const scaledWidth = bodyWidth * scale;
    const scaledHeight = bodyHeight * scale;
    sprite.body.setSize(scaledWidth, scaledHeight);
    sprite.body.position.set(feetX - scaledWidth / 2, feetY - scaledHeight);
    sprite.body.updateCenter();

    // Two-frame idle only — shadow is baked into the PNG frames, so no
    // additional shadow object or bob tween is added here. The sprite stays
    // stationary and cycles between its two idle frames in place.
    sprite.anims.play(idleKey);

    return sprite;
  }

  private spawnGojocat(): Phaser.Types.Physics.Arcade.SpriteWithStaticBody {
    return this.spawnNpc(
      GOJOCAT_TILE_X,
      GOJOCAT_TILE_Y,
      GOJOCAT_FRAME,
      GOJOCAT_BODY_WIDTH,
      GOJOCAT_BODY_HEIGHT,
      GOJOCAT_IDLE_KEY
    );
  }

  private spawnPompompurin(): Phaser.Types.Physics.Arcade.SpriteWithStaticBody {
    return this.spawnNpc(
      POMPOMPURIN_TILE_X,
      POMPOMPURIN_TILE_Y,
      POMPOMPURIN_FRAME,
      POMPOMPURIN_BODY_WIDTH,
      POMPOMPURIN_BODY_HEIGHT,
      POMPOMPURIN_IDLE_KEY
    );
  }

  private spawnShoya(): Phaser.Types.Physics.Arcade.SpriteWithStaticBody {
    // Scaled to match the player's own sprite scale (both are 32×32 source
    // frames, so the same factor makes them read as the same size on screen).
    return this.spawnNpc(
      SHOYA_TILE_X,
      SHOYA_TILE_Y,
      SHOYA_FRAME,
      SHOYA_BODY_WIDTH,
      SHOYA_BODY_HEIGHT,
      SHOYA_IDLE_KEY,
      PLAYER_SPRITE_SCALE
    );
  }

  private spawnClaude(): Phaser.Types.Physics.Arcade.SpriteWithStaticBody {
    // Scaled to match the player's own sprite scale (both are 32×32 source
    // frames, so the same factor makes them read as the same size on screen).
    return this.spawnNpc(
      CLAUDE_TILE_X,
      CLAUDE_TILE_Y,
      CLAUDE_FRAME,
      CLAUDE_BODY_WIDTH,
      CLAUDE_BODY_HEIGHT,
      CLAUDE_IDLE_KEY,
      PLAYER_SPRITE_SCALE
    );
  }

  private spawnProp(tileX: number, tileY: number, def: PropDef): Phaser.GameObjects.Sprite {
    const scale = def.scale ?? 1;
    const feetX = tileX * TILE_SIZE + TILE_SIZE / 2 + (def.offsetX ?? 0);
    const feetY = (tileY + 1) * TILE_SIZE + (def.offsetY ?? 0);

    if (def.collides === false) {
      // Purely decorative — a plain sprite with no physics body at all, so
      // the player walks through it freely (not just an inert body that's
      // never registered with a collider — there's no body to begin with).
      const sprite = this.add
        .sprite(feetX, feetY, PROP_SHEET_KEY, def.frame)
        .setOrigin(0.5, 1)
        .setScale(scale);
      if (def.animKey) sprite.anims.play(def.animKey);
      return sprite;
    }

    // Collision box is sized and positioned directly from the prop's trimmed
    // pixel bbox (rather than a hand-tuned "base only" box) so small static
    // props collide exactly on their visible silhouette and nothing more.
    // With origin (0.5, 1), the frame's top-left in world space is
    // (feetX - 16*scale, feetY - 32*scale) — bbox offsets are in the
    // original 32px frame's local coordinates, so they're scaled the same
    // way before being added to that corner.
    const sprite = this.physics.add
      .staticSprite(feetX, feetY, PROP_SHEET_KEY, def.frame)
      .setOrigin(0.5, 1)
      .setScale(scale);

    const { top, bottom, left, right } = def.bbox;
    const frameTopLeftX = feetX - (TILE_SIZE / 2) * scale;
    const frameTopLeftY = feetY - TILE_SIZE * scale;
    sprite.body.setSize((right - left + 1) * scale, (bottom - top + 1) * scale);
    sprite.body.position.set(frameTopLeftX + left * scale, frameTopLeftY + top * scale);
    sprite.body.updateCenter();

    if (def.animKey) sprite.anims.play(def.animKey);

    return sprite;
  }

  private buildPropPlacements(
    map: Phaser.Tilemaps.Tilemap
  ): Array<{ kind: PropKind; tileX: number; tileY: number }> {
    const rng = createSeededRng(PROP_PLACEMENT_SEED);

    // Fixed positions (NPCs + the cross + boba) are registered as occupied
    // before any algorithmic placement runs, so nothing spawns within
    // MIN_PROP_SPACING_TILES of them.
    const occupied: TilePos[] = [
      { col: GOJOCAT_TILE_X, row: GOJOCAT_TILE_Y },
      { col: POMPOMPURIN_TILE_X, row: POMPOMPURIN_TILE_Y },
      { col: SHOYA_TILE_X, row: SHOYA_TILE_Y },
      { col: CLAUDE_TILE_X, row: CLAUDE_TILE_Y },
      { col: CROSS_TILE_X, row: CROSS_TILE_Y },
      { col: BOBA_TILE_X, row: BOBA_TILE_Y },
    ];

    // Hobby items draw only from the diamond's dirt-path tiles; flowers draw
    // from every grass tile on the map. The two pools never overlap (a tile
    // is either grass or path, never both), so they can't collide with each
    // other, but both still respect `occupied` (NPCs, the cross, and prior
    // placements) via MIN_PROP_SPACING_TILES.
    const dirtCandidates = collectDiamondDirtCandidates(map);
    const hobbyPlacements = placeKinds(
      map,
      PATH_TILE_INDEX,
      HOBBY_SCATTER_KINDS,
      dirtCandidates,
      occupied,
      rng
    );

    const grassCandidates = collectWholeMapGrassCandidates(map);
    const flowerPlacements = placeKinds(
      map,
      GRASS_TILE_INDEX,
      FLOWER_SCATTER_KINDS,
      grassCandidates,
      occupied,
      rng
    );

    return [
      { kind: 'cross', tileX: CROSS_TILE_X, tileY: CROSS_TILE_Y },
      { kind: 'boba', tileX: BOBA_TILE_X, tileY: BOBA_TILE_Y },
      ...hobbyPlacements,
      ...flowerPlacements,
    ];
  }

  private createMarker(): void {
    const triangle = this.add.triangle(0, 0, 0, 0, 8, 0, 4, 6, 0xf6f4ee);
    triangle.setStrokeStyle(1, 0x141414);
    triangle.setOrigin(0.5, 0.5);
    triangle.setVisible(false);
    triangle.setDepth(10);
    this.marker = triangle;
  }

  private createHint(): void {
    const text = this.add
      .text(this.scale.width / 2, this.scale.height - 14, '[E]  LOOK', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#141414',
        backgroundColor: '#f6f4ee',
        padding: { left: 6, right: 6, top: 3, bottom: 3 },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(20);
    text.setVisible(false);
    this.hint = text;
  }

  private setupUICamera(): void {
    // A second camera at zoom 1 with no scroll renders fixed UI (the hint)
    // at native viewport coords, regardless of the main camera's zoom/follow.
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setZoom(1);
    this.uiCamera.setScroll(0, 0);

    if (this.hint) this.cameras.main.ignore(this.hint);
    if (this.controlsHint) this.cameras.main.ignore(this.controlsHint);
    if (this.controlsOverlayBg) this.cameras.main.ignore(this.controlsOverlayBg);
    if (this.controlsOverlayText) this.cameras.main.ignore(this.controlsOverlayText);
    if (this.mapOverlayBg) this.cameras.main.ignore(this.mapOverlayBg);
    if (this.mapImage) this.cameras.main.ignore(this.mapImage);
    if (this.mapDot) this.cameras.main.ignore(this.mapDot);
    if (this.choiceBg) this.cameras.main.ignore(this.choiceBg);
    if (this.choiceArrow) this.cameras.main.ignore(this.choiceArrow);

    const worldObjects: Phaser.GameObjects.GameObject[] = [];
    if (this.groundLayer) worldObjects.push(this.groundLayer);
    if (this.wallLayer) worldObjects.push(this.wallLayer);
    if (this.wall2Layer) worldObjects.push(this.wall2Layer);
    if (this.wal3Layer) worldObjects.push(this.wal3Layer);
    if (this.player) worldObjects.push(this.player);
    if (this.gojocat) worldObjects.push(this.gojocat);
    if (this.pompompurin) worldObjects.push(this.pompompurin);
    if (this.shoya) worldObjects.push(this.shoya);
    if (this.claude) worldObjects.push(this.claude);
    worldObjects.push(...this.props);
    if (this.marker) worldObjects.push(this.marker);
    this.uiCamera.ignore(worldObjects);
  }

  private updateCameraZoom(): void {
    // Pick the smallest zoom that still keeps the camera within world bounds
    // on both axes, floored to an integer so tile samples land on whole pixels
    // (fractional zoom is the other classic cause of visible tile-edge seams).
    const minZoomX = this.scale.width / this.mapWidthPx;
    const minZoomY = this.scale.height / this.mapHeightPx;
    const zoom = Math.floor(Math.max(MIN_CAMERA_ZOOM, minZoomX, minZoomY));
    this.cameras.main.setZoom(zoom);
  }

  private handleResize(): void {
    this.updateCameraZoom();
    if (this.uiCamera) {
      this.uiCamera.setSize(this.scale.width, this.scale.height);
    }
    if (this.hint) {
      this.hint.setPosition(this.scale.width / 2, this.scale.height - 14);
    }
    if (this.controlsHint) {
      this.controlsHint.setPosition(this.scale.width - 12, this.scale.height - 12);
    }
    if (this.controlsOverlayBg) {
      this.controlsOverlayBg.setSize(this.scale.width, this.scale.height);
    }
    if (this.controlsOverlayText) {
      this.controlsOverlayText.setPosition(this.scale.width / 2, this.scale.height / 2);
    }
    if (this.mapOverlayBg) {
      this.mapOverlayBg.setSize(this.scale.width, this.scale.height);
    }
    if (this.mapImage) {
      this.mapImage.setPosition(this.scale.width / 2, this.scale.height / 2);
      this.updateMapImageScale();
      this.updateMapDot();
    }
    if (this.choiceLabels.length > 0) {
      // Simplest correct fix: rebuild at the freshly computed layout rather
      // than patching each text's position by hand.
      this.showChoiceOptions(this.choiceLabels);
    }
  }

  private handleMovement(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const left = this.cursors.left?.isDown || this.wasd.left.isDown;
    const right = this.cursors.right?.isDown || this.wasd.right.isDown;
    const up = this.cursors.up?.isDown || this.wasd.up.isDown;
    const down = this.cursors.down?.isDown || this.wasd.down.isDown;

    let vx = 0;
    let vy = 0;
    if (left) vx -= PLAYER_SPEED;
    if (right) vx += PLAYER_SPEED;
    if (up) vy -= PLAYER_SPEED;
    if (down) vy += PLAYER_SPEED;

    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.sqrt(2);
      vx *= inv;
      vy *= inv;
    }

    body.setVelocity(vx, vy);
    this.updatePlayerAnimation(vx, vy);
  }

  private updatePlayerAnimation(vx: number, vy: number): void {
    if (vx === 0 && vy === 0) {
      this.player.anims.play(`idle-${this.facing}`, true);
      return;
    }
    // Horizontal wins ties on diagonals — feels more natural for 4-dir sprites.
    if (Math.abs(vx) >= Math.abs(vy)) {
      this.facing = vx > 0 ? 'right' : 'left';
    } else {
      this.facing = vy > 0 ? 'down' : 'up';
    }
    this.player.anims.play(`walk-${this.facing}`, true);
  }

  private findNearestInteractable(): Interactable | null {
    // Proximity is measured from the collision body's center (one tile above feet),
    // so "near a sign" means standing next to it on the tile grid — not based on the
    // top of the 32-px-tall sprite. Each item is checked against its own radius (a
    // simple omnidirectional distance check — no facing/direction involved) so an
    // item like gojocat can define a wider radius to stay reachable from every side.
    const px = this.player.x;
    const py = this.player.y - PLAYER_BODY_HEIGHT / 2;
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const item of this.interactables) {
      const dx = item.centerX - px;
      const dy = item.centerY - py;
      const dist = dx * dx + dy * dy;
      const radius = item.radius ?? INTERACT_RADIUS;
      if (dist < radius * radius && dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    }
    return best;
  }

  private syncNearest(nearest: Interactable | null): void {
    const previous = interactionState.nearestInteractable;
    const currentId = nearest?.id ?? null;

    if (previous !== currentId) {
      interactionState.nearestInteractable = currentId;
      window.dispatchEvent(
        new CustomEvent<NearestChangedDetail>(EVT_NEAREST_CHANGED, {
          detail: { id: currentId },
        })
      );
    }

    this.setMarkerTarget(nearest);
    this.setHintVisible(nearest !== null);
  }

  private setMarkerTarget(nearest: Interactable | null): void {
    if (!this.marker) return;
    if (!nearest) {
      this.marker.setVisible(false);
      return;
    }
    this.markerBaseY = nearest.centerY - 14;
    this.marker.setVisible(true);
    this.marker.x = nearest.centerX;
    this.marker.y = this.markerBaseY + Math.sin(this.time.now / 180) * 2;
  }

  private setHintVisible(visible: boolean): void {
    if (!this.hint) return;
    this.hint.setVisible(visible);
  }

  private handleInteractKeys(nearest: Interactable | null): void {
    if (!nearest) return;
    const pressedE = Phaser.Input.Keyboard.JustDown(this.keyE);
    const pressedSpace = Phaser.Input.Keyboard.JustDown(this.keySpace);
    if (!pressedE && !pressedSpace) return;

    this.faceInteractable(nearest);

    window.dispatchEvent(
      new CustomEvent<InteractDetail>(EVT_INTERACT, {
        detail: { id: nearest.id },
      })
    );
  }

  private faceInteractable(target: Interactable): void {
    // Turn Josh toward the interactable at the moment of interaction. Compare
    // player body center (one tile above feet) to the target center; whichever
    // axis has more separation wins, matching the walk-facing tiebreak.
    const dx = target.centerX - this.player.x;
    const dy = target.centerY - (this.player.y - PLAYER_BODY_HEIGHT / 2);
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left';
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
    }
    this.player.anims.play(`idle-${this.facing}`, true);
  }

  private createControlsHint(): void {
    // Bottom-right pulsing hint, styled after BootScene's "PRESS START" prompt
    // but reversed to white with a soft glow so it reads against the outdoors.
    const text = this.add
      .text(this.scale.width - 12, this.scale.height - 12, 'PRESS C FOR CONTROLS', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(1, 1)
      .setDepth(20)
      .setShadow(0, 0, '#ffffff', 4, true, true);
    this.tweens.add({
      targets: text,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    this.controlsHint = text;
  }

  private createControlsOverlay(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const bg = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.78)
      .setOrigin(0, 0)
      .setDepth(30)
      .setVisible(false);
    const body =
      'CONTROLS\n\n' +
      'WASD OR ARROW KEYS  —  MOVEMENT\n' +
      'E     —  INTERACT\n' +
      'W/S   —  NAVIGATE CHOICES\n' +
      'E OR SPACE  —  CONFIRM\n' +
      'M     —  MAP\n\n' +
      'PRESS C OR ESC TO CLOSE';
    const text = this.add
      .text(cx, cy, body, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(31)
      .setVisible(false);
    this.controlsOverlayBg = bg;
    this.controlsOverlayText = text;
  }

  private openControls(): void {
    if (this.controlsOpen) return;
    this.controlsOpen = true;
    this.controlsOverlayBg?.setVisible(true);
    this.controlsOverlayText?.setVisible(true);
    this.controlsHint?.setVisible(false);
  }

  private closeControls(): void {
    if (!this.controlsOpen) return;
    this.controlsOpen = false;
    this.controlsOverlayBg?.setVisible(false);
    this.controlsOverlayText?.setVisible(false);
    this.controlsHint?.setVisible(true);
  }

  private createMapOverlay(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const bg = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.78)
      .setOrigin(0, 0)
      .setDepth(30)
      .setVisible(false);

    const image = this.add
      .image(cx, cy, MAP_SHEET_KEY)
      .setOrigin(0.5, 0.5)
      .setDepth(31)
      .setVisible(false);

    const dot = this.add
      .circle(0, 0, MAP_DOT_RADIUS, MAP_DOT_COLOR)
      .setStrokeStyle(1, 0xffffff)
      .setDepth(32)
      .setVisible(false);

    this.mapOverlayBg = bg;
    this.mapImage = image;
    this.mapDot = dot;

    this.updateMapImageScale();
  }

  private updateMapImageScale(): void {
    if (!this.mapImage) return;
    // Scale to ~80% of the current canvas width, capped by height too so a
    // tall/narrow viewport can't stretch it past 80% of that either —
    // whichever ratio is tighter wins, preserving aspect ratio either way.
    const targetWidth = this.scale.width * MAP_OVERLAY_WIDTH_RATIO;
    const targetHeight = this.scale.height * MAP_OVERLAY_HEIGHT_RATIO;
    const fitScale = Math.min(targetWidth / this.mapImage.width, targetHeight / this.mapImage.height);
    this.mapImage.setScale(fitScale);
  }

  private updateMapDot(): void {
    if (!this.mapImage || !this.mapDot || !this.player) return;
    // Proportional position: player's world coords as a 0-1 fraction of the
    // map's pixel bounds, mapped onto the (possibly scaled-down) map image's
    // on-screen rect.
    const ratioX = Phaser.Math.Clamp(this.player.x / this.mapWidthPx, 0, 1);
    const ratioY = Phaser.Math.Clamp(this.player.y / this.mapHeightPx, 0, 1);

    const imgLeft = this.mapImage.x - this.mapImage.displayWidth / 2;
    const imgTop = this.mapImage.y - this.mapImage.displayHeight / 2;

    this.mapDot.setPosition(
      imgLeft + ratioX * this.mapImage.displayWidth,
      imgTop + ratioY * this.mapImage.displayHeight
    );
  }

  private openMap(): void {
    if (this.mapOpen) return;
    this.mapOpen = true;
    this.updateMapDot();
    this.mapOverlayBg?.setVisible(true);
    this.mapImage?.setVisible(true);
    this.mapDot?.setVisible(true);
    this.controlsHint?.setVisible(false);
  }

  private closeMap(): void {
    if (!this.mapOpen) return;
    this.mapOpen = false;
    this.mapOverlayBg?.setVisible(false);
    this.mapImage?.setVisible(false);
    this.mapDot?.setVisible(false);
    this.controlsHint?.setVisible(true);
  }

  // Yes/No choice UI — pure Phaser, no DOM/CSS involved. Game.astro (the DOM
  // dialogue) tells us what to show via EVT_SHOW_CHOICES/EVT_HIDE_CHOICES;
  // we own rendering, navigation (W/S/arrows), and confirmation (E/Space),
  // then report the pick back via EVT_CHOICE_CONFIRMED.
  private setupChoiceEvents(): void {
    const onShowChoices = (event: Event) => {
      const detail = (event as CustomEvent<ShowChoicesDetail>).detail;
      if (detail) this.showChoiceOptions(detail.labels);
    };
    const onHideChoices = () => this.hideChoiceOptions();

    window.addEventListener(EVT_SHOW_CHOICES, onShowChoices);
    window.addEventListener(EVT_HIDE_CHOICES, onHideChoices);

    this.events.once('shutdown', () => {
      window.removeEventListener(EVT_SHOW_CHOICES, onShowChoices);
      window.removeEventListener(EVT_HIDE_CHOICES, onHideChoices);
    });
  }

  private createChoiceUI(): void {
    // Black rectangle background, drawn with Graphics (not a Rectangle
    // shape) per spec — filled black, bordered in the same cream used
    // elsewhere in the dialogue UI.
    const bg = this.add.graphics().setDepth(40).setVisible(false);
    this.choiceBg = bg;

    const arrow = this.add
      .text(0, 0, '▶', { fontFamily: 'monospace', fontSize: '12px', color: CHOICE_TEXT_COLOR })
      .setOrigin(0, 0.5)
      .setDepth(42)
      .setVisible(false);
    this.choiceArrow = arrow;
  }

  // Top-left corner of the choice box for a given row count — computed
  // fresh each time (not cached) so it stays correct across resizes. Right
  // edge approximates the DOM dialogue box's own right edge (which is
  // centered, width min(640px, 100%), inset by its 16px layer padding) so
  // the box reads as "above-right of the dialogue" without measuring the
  // DOM directly.
  private getChoiceBoxTopLeft(rowCount: number): { x: number; y: number } {
    const dialogueWidth = Math.min(640, this.scale.width);
    const boxRight = (this.scale.width + dialogueWidth) / 2 - CHOICE_BOX_MARGIN_RIGHT;
    const boxBottom = this.scale.height - CHOICE_BOX_MARGIN_BOTTOM;
    const boxHeight = CHOICE_BOX_PADDING * 2 + CHOICE_ROW_HEIGHT * rowCount;
    return { x: boxRight - CHOICE_BOX_WIDTH, y: boxBottom - boxHeight };
  }

  private redrawChoiceBg(): void {
    if (!this.choiceBg || this.choiceLabels.length === 0) return;
    const rowCount = this.choiceLabels.length;
    const { x, y } = this.getChoiceBoxTopLeft(rowCount);
    const height = CHOICE_BOX_PADDING * 2 + CHOICE_ROW_HEIGHT * rowCount;

    this.choiceBg.clear();
    this.choiceBg.fillStyle(CHOICE_BG_COLOR, 1);
    this.choiceBg.fillRect(x, y, CHOICE_BOX_WIDTH, height);
    this.choiceBg.lineStyle(CHOICE_BORDER_WIDTH, CHOICE_BORDER_COLOR, 1);
    this.choiceBg.strokeRect(x, y, CHOICE_BOX_WIDTH, height);
  }

  private clearChoiceTexts(): void {
    for (const t of this.choiceTexts) t.destroy();
    this.choiceTexts = [];
  }

  private showChoiceOptions(labels: string[]): void {
    this.clearChoiceTexts();
    this.choiceLabels = labels;
    this.selectedChoiceIndex = 0;

    const { x, y } = this.getChoiceBoxTopLeft(labels.length);
    this.choiceTexts = labels.map((label, i) => {
      const text = this.add
        .text(x + CHOICE_TEXT_START_X, y + CHOICE_BOX_PADDING + i * CHOICE_ROW_HEIGHT, label, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: CHOICE_TEXT_COLOR,
        })
        .setOrigin(0, 0)
        .setDepth(41);
      // Dynamic per-render objects — each needs its own ignore registration,
      // unlike the static choiceBg/choiceArrow handled once in setupUICamera().
      this.cameras.main.ignore(text);
      return text;
    });

    this.redrawChoiceBg();
    this.choiceBg?.setVisible(true);
    this.choiceArrow?.setVisible(true);
    this.repositionChoiceArrow();
  }

  private hideChoiceOptions(): void {
    this.clearChoiceTexts();
    this.choiceLabels = [];
    this.choiceBg?.clear().setVisible(false);
    this.choiceArrow?.setVisible(false);
  }

  private repositionChoiceArrow(): void {
    if (!this.choiceArrow) return;
    const target = this.choiceTexts[this.selectedChoiceIndex];
    if (!target) return;
    const { x } = this.getChoiceBoxTopLeft(this.choiceLabels.length);
    this.choiceArrow.setPosition(x + CHOICE_BOX_PADDING, target.y + target.height / 2);
  }

  private handleChoiceInput(): void {
    const count = this.choiceLabels.length;
    if (count === 0) return;

    const upPressed =
      Phaser.Input.Keyboard.JustDown(this.wasd.up) ||
      (this.cursors.up ? Phaser.Input.Keyboard.JustDown(this.cursors.up) : false);
    const downPressed =
      Phaser.Input.Keyboard.JustDown(this.wasd.down) ||
      (this.cursors.down ? Phaser.Input.Keyboard.JustDown(this.cursors.down) : false);

    if (upPressed) {
      this.selectedChoiceIndex = (this.selectedChoiceIndex - 1 + count) % count;
      this.repositionChoiceArrow();
      return;
    }
    if (downPressed) {
      this.selectedChoiceIndex = (this.selectedChoiceIndex + 1) % count;
      this.repositionChoiceArrow();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyE) || Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      window.dispatchEvent(
        new CustomEvent<ChoiceConfirmedDetail>(EVT_CHOICE_CONFIRMED, {
          detail: { index: this.selectedChoiceIndex },
        })
      );
    }
  }

  private setupWind(): void {
    // Gust envelope: calm → ramp up → hold → ramp down → calm, on repeat.
    // Amp scales the per-frame sinusoid in applyWindSway, so amp=0 is dead calm.
    this.tweens.chain({
      targets: this.wind,
      loop: -1,
      tweens: [
        { amp: 0, duration: 1800 },
        { amp: 1, duration: 1400, ease: 'Sine.easeOut' },
        { amp: 1, duration: 900 },
        { amp: 0, duration: 2200, ease: 'Sine.easeIn' },
      ],
    });
  }

  private applyWindSway(): void {
    // Single sinusoid drives everything so the layers stay in phase; per-layer
    // multipliers give trees more travel than flowers. Amplitudes are small
    // enough that collision wobble against the wall layers stays sub-pixel
    // once the camera zoom quantizes back to whole pixels.
    const swing = Math.sin(this.time.now / WIND_SWING_PERIOD_MS) * this.wind.amp;
    if (this.wallLayer) this.wallLayer.x = swing * WIND_AMP_TREES;
    if (this.wall2Layer) this.wall2Layer.x = swing * WIND_AMP_TREES * 0.9;
    if (this.wal3Layer) this.wal3Layer.x = swing * WIND_AMP_BUSHES;
  }
}
