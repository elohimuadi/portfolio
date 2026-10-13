import { describe, expect, test } from 'vitest';
import { directionFromTouch, isWithinPaddedRect } from './touch';

const DEAD_ZONE = 12;

describe('directionFromTouch', () => {
  test('returns right when the touch is right of the origin', () => {
    expect(directionFromTouch(300, 200, 200, 200, DEAD_ZONE)).toBe('right');
  });

  test('returns left when the touch is left of the origin', () => {
    expect(directionFromTouch(100, 200, 200, 200, DEAD_ZONE)).toBe('left');
  });

  test('returns up when the touch is above the origin', () => {
    expect(directionFromTouch(200, 50, 200, 200, DEAD_ZONE)).toBe('up');
  });

  test('returns down when the touch is below the origin', () => {
    expect(directionFromTouch(200, 350, 200, 200, DEAD_ZONE)).toBe('down');
  });

  test('picks the wedge by the larger axis, not the nearer screen edge', () => {
    // 80 across, 90 down: inside the bottom wedge.
    expect(directionFromTouch(280, 290, 200, 200, DEAD_ZONE)).toBe('down');
  });

  test('goes horizontal when the touch is exactly on a diagonal', () => {
    expect(directionFromTouch(300, 300, 200, 200, DEAD_ZONE)).toBe('right');
    expect(directionFromTouch(100, 100, 200, 200, DEAD_ZONE)).toBe('left');
  });

  test('returns null inside the dead zone around the origin', () => {
    expect(directionFromTouch(205, 205, 200, 200, DEAD_ZONE)).toBeNull();
    expect(directionFromTouch(200, 200, 200, 200, DEAD_ZONE)).toBeNull();
  });

  test('measures from an off-centre origin, not the screen centre', () => {
    // Player near the left edge of a 375-wide screen: a touch at x=100 is to
    // the player's right even though it is left of the screen centre.
    expect(directionFromTouch(100, 300, 40, 300, DEAD_ZONE)).toBe('right');
  });

  test('returns null when a coordinate is not a finite number', () => {
    expect(directionFromTouch(Number.NaN, 200, 200, 200, DEAD_ZONE)).toBeNull();
    expect(directionFromTouch(200, 200, Number.POSITIVE_INFINITY, 200, DEAD_ZONE)).toBeNull();
  });
});

describe('isWithinPaddedRect', () => {
  const rect = { x: 10, y: 20, width: 30, height: 40 };

  test('returns true for a point inside the rect', () => {
    expect(isWithinPaddedRect(25, 40, rect, 0)).toBe(true);
  });

  test('returns false for a point outside the rect with no padding', () => {
    expect(isWithinPaddedRect(5, 40, rect, 0)).toBe(false);
  });

  test('returns true for a point outside the rect but inside the padding', () => {
    expect(isWithinPaddedRect(5, 40, rect, 6)).toBe(true);
    expect(isWithinPaddedRect(45, 65, rect, 6)).toBe(true);
  });

  test('returns false for a point beyond the padding', () => {
    expect(isWithinPaddedRect(3, 40, rect, 6)).toBe(false);
  });
});
