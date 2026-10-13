import { describe, expect, test } from 'vitest';
import {
  directionFromTouch,
  indexOfRectAt,
  isWithinPaddedRect,
  steadyDirection,
  type Direction,
} from './touch';

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

describe('steadyDirection', () => {
  const HYSTERESIS = 10;
  const steady = (previous: Direction | null, dx: number, dy: number) =>
    steadyDirection(previous, 200 + dx, 200 + dy, 200, 200, DEAD_ZONE, HYSTERESIS);

  test('picks the wedge like directionFromTouch when nothing is held yet', () => {
    expect(steady(null, 100, 0)).toBe('right');
    expect(steady(null, 0, -100)).toBe('up');
  });

  test('does not start walking until the touch clears the dead zone by the hysteresis', () => {
    expect(steady(null, 18, 0)).toBeNull();
    expect(steady(null, 23, 0)).toBe('right');
  });

  test('keeps the current axis when the other axis leads by less than the hysteresis', () => {
    expect(steady('right', 80, -85)).toBe('right');
    expect(steady('up', 85, -80)).toBe('up');
  });

  test('switches axis once the other axis leads by more than the hysteresis', () => {
    expect(steady('right', 80, -95)).toBe('up');
    expect(steady('up', 95, -80)).toBe('right');
  });

  test('reverses within the same axis when the finger crosses the character', () => {
    expect(steady('right', -50, 0)).toBe('left');
    expect(steady('up', 0, 50)).toBe('down');
  });

  test('keeps walking until the touch is inside the dead zone', () => {
    expect(steady('right', 15, 0)).toBe('right');
    expect(steady('right', 10, 0)).toBeNull();
  });

  test('returns null when a coordinate is not a finite number', () => {
    expect(steady('right', Number.NaN, 0)).toBeNull();
  });
});

describe('indexOfRectAt', () => {
  const rows = [
    { x: 100, y: 20, width: 200, height: 30 },
    { x: 100, y: 60, width: 200, height: 30 },
  ];

  test('returns the index of the rect containing the point', () => {
    expect(indexOfRectAt(150, 70, rows, 0)).toBe(1);
  });

  test('returns -1 when no rect contains the point', () => {
    expect(indexOfRectAt(50, 70, rows, 0)).toBe(-1);
  });

  test('counts the padding around each rect', () => {
    expect(indexOfRectAt(150, 54, rows, 4)).toBe(0);
    expect(indexOfRectAt(150, 56, rows, 4)).toBe(1);
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
