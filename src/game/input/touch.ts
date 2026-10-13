// Touch maths for WorldScene. Kept free of Phaser so it can be unit tested.

export type Direction = 'up' | 'down' | 'left' | 'right';
export type Rect = { x: number; y: number; width: number; height: number };

// Screen px around the character where a touch means "no direction".
export const TOUCH_DEAD_ZONE_PX = 12;
// World px added around an interactable's sprite so it is easy to tap.
export const TOUCH_TARGET_PADDING_PX = 6;

// Splits the screen into four wedges by two diagonals crossing at the origin
// (the character's on-screen position) and returns the wedge the touch is in.
// Horizontal wins a tie, matching WorldScene.updatePlayerAnimation.
export function directionFromTouch(
  touchX: number,
  touchY: number,
  originX: number,
  originY: number,
  deadZone: number
): Direction | null {
  const dx = touchX - originX;
  const dy = touchY - originY;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (dx * dx + dy * dy <= deadZone * deadZone) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

// Screen px one axis must lead the other by before a held touch changes
// direction, and the extra distance a touch needs to start a walk at all.
// The camera trails the character by a few px, which shifts the origin as he
// walks; without this slack a finger near a diagonal (or near the character)
// flips direction every few frames.
export const TOUCH_HYSTERESIS_PX = 10;

// directionFromTouch for a touch that is being held: `previous` is the
// direction returned last frame (null if the walk has not started), and it is
// kept until the touch clearly belongs to another wedge.
export function steadyDirection(
  previous: Direction | null,
  touchX: number,
  touchY: number,
  originX: number,
  originY: number,
  deadZone: number,
  hysteresis: number
): Direction | null {
  if (previous === null) {
    return directionFromTouch(touchX, touchY, originX, originY, deadZone + hysteresis);
  }
  const dx = touchX - originX;
  const dy = touchY - originY;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (dx * dx + dy * dy <= deadZone * deadZone) return null;

  const wasHorizontal = previous === 'left' || previous === 'right';
  const isHorizontal = wasHorizontal
    ? Math.abs(dy) <= Math.abs(dx) + hysteresis
    : Math.abs(dx) > Math.abs(dy) + hysteresis;
  if (isHorizontal) return dx > 0 ? 'right' : dx < 0 ? 'left' : previous;
  return dy > 0 ? 'down' : dy < 0 ? 'up' : previous;
}

// Index of the first rect (with padding) containing the point, or -1.
export function indexOfRectAt(
  x: number,
  y: number,
  rects: readonly Rect[],
  padding: number
): number {
  return rects.findIndex((rect) => isWithinPaddedRect(x, y, rect, padding));
}

export function isWithinPaddedRect(x: number, y: number, rect: Rect, padding: number): boolean {
  return (
    x >= rect.x - padding &&
    x <= rect.x + rect.width + padding &&
    y >= rect.y - padding &&
    y <= rect.y + rect.height + padding
  );
}
