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

export function isWithinPaddedRect(x: number, y: number, rect: Rect, padding: number): boolean {
  return (
    x >= rect.x - padding &&
    x <= rect.x + rect.width + padding &&
    y >= rect.y - padding &&
    y <= rect.y + rect.height + padding
  );
}
