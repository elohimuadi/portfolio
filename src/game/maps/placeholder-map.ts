const TILE = 16;
const MAP_W = 40;
const MAP_H = 24;

const GID_EMPTY = 0;
const GID_FLOOR = 1;
const GID_WALL = 2;

type TiledObject = {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  rotation: number;
  properties?: Array<{ name: string; type: string; value: string | number | boolean }>;
};

type TiledLayer =
  | {
      type: 'tilelayer';
      name: string;
      id: number;
      width: number;
      height: number;
      data: number[];
      visible: boolean;
      opacity: number;
      x: 0;
      y: 0;
    }
  | {
      type: 'objectgroup';
      name: string;
      id: number;
      objects: TiledObject[];
      visible: boolean;
      opacity: number;
      x: 0;
      y: 0;
    };

type TiledMap = {
  type: 'map';
  version: '1.10';
  tiledversion: string;
  orientation: 'orthogonal';
  renderorder: 'right-down';
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  infinite: false;
  nextlayerid: number;
  nextobjectid: number;
  compressionlevel: -1;
  layers: TiledLayer[];
  tilesets: Array<{
    firstgid: number;
    name: string;
    image: string;
    imagewidth: number;
    imageheight: number;
    tilewidth: number;
    tileheight: number;
    tilecount: number;
    columns: number;
    margin: 0;
    spacing: 0;
  }>;
};

const idx = (x: number, y: number) => y * MAP_W + x;

function fillRect(
  data: number[],
  x0: number,
  y0: number,
  w: number,
  h: number,
  gid: number
): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      data[idx(x, y)] = gid;
    }
  }
}

const floor: number[] = new Array(MAP_W * MAP_H).fill(GID_EMPTY);

// Room A — About (top-left)
fillRect(floor, 2, 2, 13, 10, GID_FLOOR);
// Room B — Projects (top-right)
fillRect(floor, 22, 2, 16, 12, GID_FLOOR);
// Room C — Contact (bottom-right)
fillRect(floor, 22, 16, 16, 6, GID_FLOOR);

// Corridors
fillRect(floor, 15, 6, 7, 3, GID_FLOOR); // A → B
fillRect(floor, 28, 14, 4, 2, GID_FLOOR); // B → C

const walls: number[] = floor.map((g) => (g === GID_FLOOR ? GID_EMPTY : GID_WALL));

const interactables: TiledObject[] = [
  {
    id: 1,
    name: 'about_sign',
    type: 'interactable',
    x: 8 * TILE,
    y: 7 * TILE,
    width: TILE,
    height: TILE,
    visible: true,
    rotation: 0,
    properties: [{ name: 'id', type: 'string', value: 'about' }],
  },
  {
    id: 2,
    name: 'project_sidequest',
    type: 'interactable',
    x: 26 * TILE,
    y: 6 * TILE,
    width: TILE,
    height: TILE,
    visible: true,
    rotation: 0,
    properties: [{ name: 'id', type: 'string', value: 'project_sidequest' }],
  },
  {
    id: 3,
    name: 'project_hakari',
    type: 'interactable',
    x: 32 * TILE,
    y: 6 * TILE,
    width: TILE,
    height: TILE,
    visible: true,
    rotation: 0,
    properties: [{ name: 'id', type: 'string', value: 'project_hakari' }],
  },
  {
    id: 4,
    name: 'contact_mailbox',
    type: 'interactable',
    x: 29 * TILE,
    y: 19 * TILE,
    width: TILE,
    height: TILE,
    visible: true,
    rotation: 0,
    properties: [{ name: 'id', type: 'string', value: 'contact' }],
  },
];

// Bottom-center of this rect = player feet position.
// Centered in Room A (cols 2–14, rows 2–11) so the 48×48 sprite has clearance on all sides.
const spawnObject: TiledObject = {
  id: 5,
  name: 'player_spawn',
  type: 'spawn',
  x: 8 * TILE,
  y: 7 * TILE,
  width: TILE,
  height: TILE,
  visible: true,
  rotation: 0,
};

export const PLACEHOLDER_MAP: TiledMap = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.0',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  width: MAP_W,
  height: MAP_H,
  tilewidth: TILE,
  tileheight: TILE,
  infinite: false,
  compressionlevel: -1,
  nextlayerid: 4,
  nextobjectid: 6,
  layers: [
    {
      type: 'tilelayer',
      name: 'floor',
      id: 1,
      width: MAP_W,
      height: MAP_H,
      data: floor,
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
    },
    {
      type: 'tilelayer',
      name: 'walls',
      id: 2,
      width: MAP_W,
      height: MAP_H,
      data: walls,
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
    },
    {
      type: 'objectgroup',
      name: 'objects',
      id: 3,
      objects: [spawnObject, ...interactables],
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
    },
  ],
  tilesets: [
    {
      firstgid: 1,
      name: 'placeholder',
      image: 'placeholder-tiles',
      imagewidth: TILE * 2,
      imageheight: TILE,
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: 2,
      columns: 2,
      margin: 0,
      spacing: 0,
    },
  ],
};

export const PLACEHOLDER_MAP_DIMENSIONS = {
  widthPx: MAP_W * TILE,
  heightPx: MAP_H * TILE,
};
