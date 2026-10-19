# Touch Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GOL playable on a phone by adding touch as a second input source next to the keyboard.

**Architecture:** Pure touch maths lives in `src/game/input/touch.ts` and is unit tested. `WorldScene` gets one scene-level `pointerdown` handler that routes a touch to the first matching action (dismiss prompt, close overlay, pick choice, open map, talk, walk), and `handleMovement` ORs the held-touch direction into the existing keyboard booleans. A coarse-pointer media query decides wording and which UI shows; it never gates input.

**Tech Stack:** Astro 7, Phaser 3.87, TypeScript 5.6, Vitest (new, dev only).

**Spec:** `docs/superpowers/specs/2026-10-12-touch-controls-design.md`

## Global Constraints

- Desktop keyboard behaviour does not change: every key in the README controls table does what it does today.
- Only touch pointers act (`pointer.wasTouch`). A mouse click never walks, talks, or opens the map.
- On a touch device no on-screen wording mentions a key.
- Exact copy: `damn, I'd like to move, maybe i should tap in the direction i wanna go` / `maybe i should tap on them to talk` / `tap anywhere to close` / `[ tap to continue ]` / `MAP`.
- Four movement directions only; a tie on the diagonal goes horizontal.
- No new art. All new on-screen text uses `HandText`.
- Meaningful numbers are named constants, not literals.
- The viewport meta tag is left alone (no `viewport-fit=cover`), so the browser keeps the page inside the safe area and the `MAP` label cannot end up under a notch.
- Work on branch `feat/touch-controls`. Commit messages are `<type>: <description>` with no attribution trailer.
- Node 22.12+. Verify each task with `npx tsc --noEmit` and `npm run build`.

## Review Focus

1. **Finger still down when a dialogue, the map, or the first prompt closes** — the character must not start walking from that same touch. Pinned by the manual step in Task 3 (Step 7) and Task 5 (Step 5).
2. **Touch exactly on the character or exactly on a diagonal** — no jitter, and a deterministic direction. Pinned by unit tests in Task 1.
3. **Player off-centre near a map edge** — wedges still radiate from the character, not the screen centre. Pinned by a unit test in Task 1 and the manual step in Task 3 (Step 7).
4. **Rotating the phone or resizing mid-prompt** — the prompt re-wraps and its squiggle stays at the end of the last line; map label and close text stay on screen. Pinned by manual steps in Task 3 (Step 7) and Task 6 (Step 6).
5. **Mouse click on desktop** — must do nothing new. Pinned by the desktop regression in Task 7.

---

### Task 1: Touch maths with unit tests

**Files:**
- Create: `src/game/input/touch.ts`
- Create: `src/game/input/touch.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts, devDependencies)

**Interfaces:**
- Produces:
  - `type Direction = 'up' | 'down' | 'left' | 'right'`
  - `type Rect = { x: number; y: number; width: number; height: number }`
  - `const TOUCH_DEAD_ZONE_PX = 12`, `const TOUCH_TARGET_PADDING_PX = 6`
  - `directionFromTouch(touchX: number, touchY: number, originX: number, originY: number, deadZone: number): Direction | null`
  - `isWithinPaddedRect(x: number, y: number, rect: Rect, padding: number): boolean`

- [ ] **Step 1: Create the branch and install Vitest**

```bash
git checkout -b feat/touch-controls
npm install -D vitest
```

- [ ] **Step 2: Add the test script and config**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write the failing tests**

Create `src/game/input/touch.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot resolve `./touch`.

- [ ] **Step 5: Write the implementation**

Create `src/game/input/touch.ts`:

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 13 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/game/input/touch.ts src/game/input/touch.test.ts
git commit -m "feat: add touch direction and hit-test maths"
```

---

### Task 2: Touch detection, page layout, intro wording

**Files:**
- Create: `src/game/device.ts`
- Modify: `src/pages/index.astro` (global `<style>`)
- Modify: `src/components/Game.astro` (`<style>` block)
- Modify: `src/game/scenes/IntroScene.ts` (the `promptText` creation, around line 59)

**Interfaces:**
- Produces: `isTouchDevice(): boolean` from `src/game/device.ts`

- [ ] **Step 1: Create `src/game/device.ts`**

```ts
// True on phones and tablets: no hover and a coarse (finger) pointer. Used
// for wording and which UI shows only. Touch input itself is always on.
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}
```

- [ ] **Step 2: Stop the page scrolling, zooming, and selecting**

In `src/pages/index.astro`, replace the `body { overflow: hidden; }` rule with:

```css
      body {
        overflow: hidden;
        overscroll-behavior: none;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }
```

- [ ] **Step 3: Fit the game to the visible viewport**

In `src/components/Game.astro`, in `.game-root`, add a `100dvh` line after the existing `height: 100vh;` (the `vh` line stays as the fallback):

```css
    height: 100vh;
    height: 100dvh;
```

In `.game-root :global(canvas)`, add:

```css
    touch-action: none;
```

- [ ] **Step 4: Tighten the dialogue box on small screens**

In `src/components/Game.astro`, add before the `@media (prefers-reduced-motion: reduce)` block:

```css
  /* Phones, portrait or landscape: give the garden more of the screen. */
  @media (max-width: 480px), (max-height: 480px) {
    .dialogue-layer {
      padding: 0 8px 8px;
    }
    .dialogue-body-box {
      padding: 8px 4px 8px;
      min-height: 96px;
    }
    .dialogue-text {
      min-height: 3.8em;
    }
  }
```

- [ ] **Step 5: Touch wording on the intro screen**

In `src/game/scenes/IntroScene.ts`, add the import:

```ts
import { isTouchDevice } from '../device';
```

Add next to the other top-level constants:

```ts
const CONTINUE_PROMPT_MOUSE = '[ click to continue ]';
const CONTINUE_PROMPT_TOUCH = '[ tap to continue ]';
```

Change the `promptText` creation from the literal `'[ click to continue ]'` to:

```ts
    this.promptText = new HandText(
      this,
      0,
      0,
      isTouchDevice() ? CONTINUE_PROMPT_TOUCH : CONTINUE_PROMPT_MOUSE,
      {
        size: PROMPT_FONT_SIZE,
        color: TEXT_COLOR,
      }
    )
```

(the `.setOrigin(1, 1).setVisible(false);` chain that follows is unchanged).

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run `npm run dev`, open `http://localhost:4321` in Chrome DevTools device mode (iPhone SE, 375×667). Expected: the intro prompt reads `[ tap to continue ]`; dragging on the page does not scroll or rubber-band; with device mode off it reads `[ click to continue ]`.

- [ ] **Step 7: Commit**

```bash
git add src/game/device.ts src/pages/index.astro src/components/Game.astro src/game/scenes/IntroScene.ts
git commit -m "feat: add touch detection and mobile page layout"
```

---

### Task 3: Walk by touch, and the touch opening prompt

**Files:**
- Modify: `src/game/handtext.ts` (`layout()`, new getters)
- Modify: `src/game/scenes/WorldScene.ts` (imports, constants, fields, `setupInput`, `handleMovement`, `createControlsHint`, `positionControlsPrompt`, `startControlsPrompt`, new `handlePointerDown` / `handlePointerUp` / `touchDirection`)

**Interfaces:**
- Consumes: `isTouchDevice()`; `directionFromTouch`, `TOUCH_DEAD_ZONE_PX`, `type Direction` from `../input/touch`.
- Produces (used by Tasks 4–6):
  - `WorldScene.isTouch: boolean` (readonly field)
  - `WorldScene.movePointer: Phaser.Input.Pointer | null`
  - `WorldScene.handlePointerDown(pointer: Phaser.Input.Pointer): void` — later tasks insert branches before the final "arm movement" line.
  - `WorldScene.controlsPromptText: string` (now mutable), `createControlsHint()`, `startControlsPrompt()`, `dismissControlsPrompt()` usable for any bottom prompt.
  - `HandText.lastLineRight: number`, `HandText.lastBaseline: number`

- [ ] **Step 1: Expose where the last line ends in `HandText`**

In `src/game/handtext.ts`, add two fields next to `originShift`:

```ts
  // Where the last line ends, relative to the block's top-left corner.
  private lastLineRightPx = 0;
  private lastBaselinePx = 0;
```

In `layout()`, directly after the `const baselineOffset = size * 1.25;` line, add:

```ts
    const lastLine = lines.length - 1;
    const lastLineStart =
      align === 'center'
        ? (blockW - lineWidths[lastLine]) / 2
        : align === 'right'
          ? blockW - lineWidths[lastLine]
          : 0;
    this.lastLineRightPx = (padding.left ?? 0) + lastLineStart + lineWidths[lastLine];
    this.lastBaselinePx = (padding.top ?? 0) + lastLine * lineHeight + baselineOffset;
```

Add the getters after the `get text()` getter:

```ts
  /** X of the end of the last line, from the block's left edge. */
  get lastLineRight(): number {
    return this.lastLineRightPx;
  }

  /** Y of the last line's baseline, from the block's top edge. */
  get lastBaseline(): number {
    return this.lastBaselinePx;
  }
```

- [ ] **Step 2: Imports, constants, and fields in `WorldScene.ts`**

Add imports after the `'./BootScene'` import:

```ts
import { isTouchDevice } from '../device';
import { TOUCH_DEAD_ZONE_PX, directionFromTouch, type Direction } from '../input/touch';
```

Add next to the `CHOICE_*` constants:

```ts
const KEYBOARD_MOVE_PROMPT = "damn, I'd like to move, maybe i should press c";
const TOUCH_MOVE_PROMPT = "damn, I'd like to move, maybe i should tap in the direction i wanna go";
const PROMPT_SIDE_PADDING = 24; // keeps the bottom prompt off the screen edges
const PROMPT_MIN_WRAP_WIDTH = 120;
```

Add fields at the top of the class, directly after `private facing: Facing = 'down';`:

```ts
  // Wording and UI only; touch input is always listened for.
  private readonly isTouch = isTouchDevice();
  // The finger currently steering the character, if any. Set only by a touch
  // that started in free roam, so the tap that closes a dialogue or the map
  // never turns into a walk.
  private movePointer: Phaser.Input.Pointer | null = null;
```

Replace the `controlsPromptText` field (`private readonly controlsPromptText = "damn, ...";`) with:

```ts
  private controlsPromptText = this.isTouch ? TOUCH_MOVE_PROMPT : KEYBOARD_MOVE_PROMPT;
```

- [ ] **Step 3: Let the bottom prompt wrap, with the squiggle on the last line**

In `createControlsHint()`, change the `HandText` style object to:

```ts
    const text = new HandText(this, 0, 0, this.controlsPromptText, {
      size: WorldScene.PROMPT_SIZE,
      color: '#000000',
      align: 'center',
    })
```

Replace the body of `positionControlsPrompt()` with:

```ts
    const text = this.controlsHint;
    if (!text) return;
    text.setWordWrapWidth(
      Math.max(PROMPT_MIN_WRAP_WIDTH, this.scale.width - PROMPT_SIDE_PADDING * 2)
    );
    text.setPosition(this.scale.width / 2, this.scale.height - 36);
    // The squiggle sits on the baseline right after the last letter, like a period.
    const left = text.x - text.width / 2;
    const top = text.y - text.height;
    this.controlsHintSquiggle?.setPosition(
      left + text.lastLineRight + 3,
      top + text.lastBaseline + 3
    );
```

In `startControlsPrompt()`, change the guard so the prompt can be reused later:

```ts
    if (!this.controlsHint) return;
```

- [ ] **Step 4: Listen for touches**

At the end of `setupInput()`, add:

```ts
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
```

Add these methods directly after `setupInput()`:

```ts
  // One entry point for every touch: the first matching branch wins, and only
  // a touch that falls through to the end starts steering the character.
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    this.movePointer = null;
    if (!this.introComplete) return;

    if (this.awaitingFirstControls) {
      this.dismissControlsPrompt();
      return;
    }
    if (this.controlsOpen) {
      this.closeControls();
      return;
    }
    if (this.mapOpen || interactionState.modalOpen) return;

    this.movePointer = pointer;
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer === this.movePointer) this.movePointer = null;
  }

  // Direction of the steering finger relative to the character's position on
  // screen. The camera follows with an offset and clamps at the map edges, so
  // the character is often not at the screen centre.
  private touchDirection(): Direction | null {
    const pointer = this.movePointer;
    if (!pointer || !pointer.isDown) return null;
    const cam = this.cameras.main;
    const originX = (this.player.x - cam.worldView.x) * cam.zoom;
    const originY = (this.player.y - PLAYER_BODY_HEIGHT / 2 - cam.worldView.y) * cam.zoom;
    return directionFromTouch(pointer.x, pointer.y, originX, originY, TOUCH_DEAD_ZONE_PX);
  }
```

- [ ] **Step 5: Feed the touch direction into movement**

In `handleMovement()`, replace the four `const left/right/up/down` lines with:

```ts
    const touch = this.touchDirection();
    const left = this.cursors.left?.isDown || this.wasd.left.isDown || touch === 'left';
    const right = this.cursors.right?.isDown || this.wasd.right.isDown || touch === 'right';
    const up = this.cursors.up?.isDown || this.wasd.up.isDown || touch === 'up';
    const down = this.cursors.down?.isDown || this.wasd.down.isDown || touch === 'down';
```

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 7: Verify in the browser**

`npm run dev`, Chrome DevTools device mode, iPhone SE (375×667). Check each:

- The opening prompt reads `damn, I'd like to move, maybe i should tap in the direction i wanna go`, wraps onto more than one line without leaving the screen, and the squiggle sits at the end of the last line.
- First touch fades the prompt and the character does **not** walk from that same touch, even while still held.
- Holding above / below / left / right of the character walks that way; sliding the finger into another wedge turns; releasing stops.
- Walk to the left edge of the map so the character sits left of the screen centre. Touch between the character and the screen centre: the character walks **right**.
- Rotate to landscape (667×375) while the prompt is showing (reload to get it back): it re-wraps and the squiggle stays at the end of the last line.
- Device mode off: the prompt reads `... maybe i should press c`, `C` opens controls, WASD walks, and clicking the mouse does nothing.

- [ ] **Step 8: Commit**

```bash
git add src/game/handtext.ts src/game/scenes/WorldScene.ts
git commit -m "feat: walk by holding a screen wedge on touch"
```

---

### Task 4: Tap to talk, hide the eye, one-time talk prompt

**Files:**
- Modify: `src/game/scenes/WorldScene.ts` (imports, constants, fields, `handlePointerDown`, `setMarkerTarget`, `syncNearest`, `handleInteractKeys`, new `spriteFor` / `isTouchOnInteractable` / `interactWith` / `syncTalkPrompt` / `dismissTalkPrompt`)

**Interfaces:**
- Consumes: `isWithinPaddedRect`, `TOUCH_TARGET_PADDING_PX` from `../input/touch`; `isTouch`, `movePointer`, `handlePointerDown`, `controlsPromptText`, `createControlsHint()`, `startControlsPrompt()`, `dismissControlsPrompt()` from Task 3.
- Produces: `WorldScene.interactWith(target: Interactable): void`; `WorldScene.spriteFor(item: Interactable): Phaser.GameObjects.Sprite | undefined`.

- [ ] **Step 1: Imports, constant, fields**

Extend the touch import to:

```ts
import {
  TOUCH_DEAD_ZONE_PX,
  TOUCH_TARGET_PADDING_PX,
  directionFromTouch,
  isWithinPaddedRect,
  type Direction,
} from '../input/touch';
```

Add next to `TOUCH_MOVE_PROMPT`:

```ts
const TOUCH_TALK_PROMPT = 'maybe i should tap on them to talk';
```

Add fields after `movePointer`:

```ts
  // The talk prompt is written once per page load, the first time something
  // comes into reach on a touch device.
  private talkPromptShown = false;
  private talkPromptActive = false;
```

- [ ] **Step 2: Extract the sprite lookup**

Add this method directly before `setMarkerTarget()`:

```ts
  private spriteFor(item: Interactable): Phaser.GameObjects.Sprite | undefined {
    const npcs: Record<string, Phaser.GameObjects.Sprite | undefined> = {
      gojocat: this.gojocat,
      pompompurin: this.pompompurin,
      shoya: this.shoya,
      claude: this.claude,
      golang: this.golang,
      red: this.red,
      n: this.n,
      trashcan: this.trashcan,
      'no-face': this.noFace,
    };
    return item.sprite ?? npcs[item.id];
  }
```

In `setMarkerTarget()`, delete the local `const npcs = { ... };` block and change the `const npc = ...` line to:

```ts
    const npc = this.spriteFor(nearest);
```

- [ ] **Step 3: Extract `interactWith` and add the tap hit test**

Replace `handleInteractKeys()` with:

```ts
  private handleInteractKeys(nearest: Interactable | null): void {
    if (!nearest) return;
    const pressedE = Phaser.Input.Keyboard.JustDown(this.keyE);
    const pressedSpace = Phaser.Input.Keyboard.JustDown(this.keySpace);
    if (!pressedE && !pressedSpace) return;
    this.interactWith(nearest);
  }

  // Shared by the keyboard (E/Space) and a tap on the thing itself.
  private interactWith(target: Interactable): void {
    this.dismissTalkPrompt();
    this.faceInteractable(target);
    if (target.id === 'no-face') {
      // Repeated input must not restart an in-progress reaction.
      if (this.noFace && !this.noFace.anims.isPlaying) {
        this.noFace.anims.play(NO_FACE_REACT_KEY);
      }
      return;
    }
    if (target.id === GOLANG_ID) this.updateGolangLookFrame();

    window.dispatchEvent(
      new CustomEvent<InteractDetail>(EVT_INTERACT, {
        detail: { id: target.id },
      })
    );
  }

  // True when a touch lands on the interactable's sprite (or its tile, for
  // ones with no sprite), with a little padding so small props are tappable.
  private isTouchOnInteractable(pointer: Phaser.Input.Pointer, item: Interactable): boolean {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const sprite = this.spriteFor(item);
    const rect = sprite
      ? sprite.getBounds()
      : {
          x: item.centerX - TILE_SIZE / 2,
          y: item.centerY - TILE_SIZE / 2,
          width: TILE_SIZE,
          height: TILE_SIZE,
        };
    return isWithinPaddedRect(world.x, world.y, rect, TOUCH_TARGET_PADDING_PX);
  }
```

- [ ] **Step 4: Route a tap on something in reach to `interactWith`**

In `handlePointerDown()`, replace the final line `this.movePointer = pointer;` with:

```ts
    const nearest = this.findNearestInteractable();
    if (nearest && this.isTouchOnInteractable(pointer, nearest)) {
      this.interactWith(nearest);
      return;
    }

    this.movePointer = pointer;
```

- [ ] **Step 5: Hide the eye on touch and write the talk prompt once**

In `syncNearest()`, replace `this.setHintVisible(nearest !== null);` with:

```ts
    // The eye has an E drawn in it, so touch devices get a written line instead.
    this.setHintVisible(nearest !== null && !this.isTouch);
    if (this.isTouch) this.syncTalkPrompt(nearest !== null);
```

Add these methods directly after `dismissControlsPrompt()`:

```ts
  private syncTalkPrompt(inReach: boolean): void {
    if (!inReach) {
      this.dismissTalkPrompt();
      return;
    }
    if (this.talkPromptShown || this.controlsHint) return;
    this.talkPromptShown = true;
    this.talkPromptActive = true;
    this.controlsPromptText = TOUCH_TALK_PROMPT;
    this.createControlsHint();
    // Created after setupUICamera(), so register with the cameras by hand.
    if (this.controlsHint) this.cameras.main.ignore(this.controlsHint);
    if (this.controlsHintSquiggle) this.cameras.main.ignore(this.controlsHintSquiggle);
    this.startControlsPrompt();
  }

  private dismissTalkPrompt(): void {
    if (!this.talkPromptActive) return;
    this.talkPromptActive = false;
    this.dismissControlsPrompt();
  }
```

- [ ] **Step 6: Verify the build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 7: Verify in the browser**

Device mode, iPhone SE:

- Walk up to an NPC: no eye appears; the marker arrow still shows above the NPC; `maybe i should tap on them to talk` types out at the bottom.
- Walk away: the line fades. Walk back: it does **not** come back.
- Reload, walk up to an NPC, tap the NPC: the dialogue opens, the character faces the NPC, and the dialogue does not skip its typing from that same tap.
- Tap an NPC that is across the screen and out of reach: the character walks toward it and no dialogue opens.
- Tap the trashcan three times in a row (closing each dialogue with a tap): the existing reveal behaviour still works.
- Device mode off: the eye opens near an NPC and `E` talks, as before.

- [ ] **Step 8: Commit**

```bash
git add src/game/scenes/WorldScene.ts
git commit -m "feat: tap an NPC in reach to talk on touch"
```

---

### Task 5: Tappable dialogue choices

**Files:**
- Modify: `src/components/Game.astro` (`<style>`, `setState`)
- Modify: `src/game/scenes/WorldScene.ts` (constant, `handlePointerDown`, new `handleChoiceTap`)

**Interfaces:**
- Consumes: `isWithinPaddedRect` from `../input/touch`; `handlePointerDown` from Task 3; existing `choiceTexts`, `selectedChoiceIndex`, `repositionChoiceArrow()`, `playSelectSfx()`, `EVT_CHOICE_CONFIRMED`.
- Produces: `data-choosing` attribute on `#portfolio-dialogue` while choices are showing.

- [ ] **Step 1: Let taps through the dialogue layer while choosing**

In `src/components/Game.astro`, add after the `.dialogue-layer[hidden]` rule:

```css
  /* The choices are drawn on the canvas underneath, so taps must reach it. */
  .dialogue-layer[data-choosing] {
    pointer-events: none;
  }
```

In the script, replace `setState` with:

```ts
  function setState(state: 'typing' | 'ready' | 'choosing' | 'closed'): void {
    layer.toggleAttribute('data-choosing', state === 'choosing');
    if (state === 'closed') {
      dialogueEl.removeAttribute('data-state');
    } else {
      dialogueEl.setAttribute('data-state', state);
    }
  }
```

- [ ] **Step 2: Pick a choice by tapping it**

In `WorldScene.ts`, add next to the `CHOICE_*` constants:

```ts
// Half the row gap, so neighbouring options' tap areas meet but never overlap.
const CHOICE_TAP_PADDING_PX = CHOICE_ROW_GAP / 2;
```

In `handlePointerDown()`, replace the line `if (this.mapOpen || interactionState.modalOpen) return;` with:

```ts
    if (this.mapOpen) return;
    if (interactionState.modalOpen) {
      if (interactionState.choicesOpen) this.handleChoiceTap(pointer.x, pointer.y);
      return;
    }
```

Add this method directly after `handleChoiceInput()`:

```ts
  // Choice texts live on the UI camera (zoom 1, no scroll), so screen
  // coordinates are already their coordinates. Origin is top-left.
  private handleChoiceTap(x: number, y: number): void {
    const index = this.choiceTexts.findIndex((t) =>
      isWithinPaddedRect(
        x,
        y,
        { x: t.x, y: t.y, width: t.width, height: t.height },
        CHOICE_TAP_PADDING_PX
      )
    );
    if (index < 0) return;
    this.selectedChoiceIndex = index;
    this.repositionChoiceArrow();
    this.playSelectSfx();
    window.dispatchEvent(
      new CustomEvent<ChoiceConfirmedDetail>(EVT_CHOICE_CONFIRMED, {
        detail: { index },
      })
    );
  }
```

- [ ] **Step 3: Verify the build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 4: Verify choices in the browser**

Device mode, iPhone SE. Talk to Golang (his dialogue has nested choices):

- When the options appear, tapping the second one selects it and moves on to its follow-up line.
- Tapping empty space while options are showing does nothing.
- A follow-up line with no choices closes on the next tap.
- A choice that opens a link opens it in a new tab.

- [ ] **Step 5: Verify a held finger does not walk**

Still in device mode: pick a final choice that closes the dialogue and keep the finger held down after the tap. Expected: the character stays still until the finger is lifted and put down again.

Device mode off: W/S moves the arrow and E confirms, as before.

- [ ] **Step 6: Commit**

```bash
git add src/components/Game.astro src/game/scenes/WorldScene.ts
git commit -m "feat: pick dialogue choices by tapping them"
```

---

### Task 6: Map label and "tap anywhere to close"

**Files:**
- Modify: `src/game/scenes/WorldScene.ts` (constants, fields, `createMapOverlay`, `updateMapImageScale`, `openMap`, `closeMap`, `setupUICamera`, `update`, `handlePointerDown`, new `isFreeRoam` / `isTouchOnMapLabel`)

**Interfaces:**
- Consumes: `isTouch`, `handlePointerDown`, `isWithinPaddedRect`; existing `mapImage`, `openMap()`, `closeMap()`.
- Produces: nothing used by later tasks.

- [ ] **Step 1: Constants and fields**

Add next to the `MAP_*` constants:

```ts
const MAP_LABEL_TEXT = 'MAP';
const MAP_LABEL_SIZE = 18;
const MAP_LABEL_MARGIN = 16; // from the top-left corner of the screen
const MAP_LABEL_TAP_PADDING_PX = 12;
const MAP_CLOSE_TEXT = 'tap anywhere to close';
const MAP_CLOSE_TEXT_SIZE = 16;
const MAP_CLOSE_TEXT_GAP = 12; // below the map image
```

Add fields after `private mapOpen = false;`:

```ts
  // Touch only: the corner label that opens the map, and the line under it.
  private mapLabel?: HandText;
  private mapCloseText?: HandText;
```

- [ ] **Step 2: Create both texts**

In `createMapOverlay()`, directly before the final `this.updateMapImageScale();` line, add:

```ts
    if (this.isTouch) {
      const label = new HandText(this, MAP_LABEL_MARGIN, MAP_LABEL_MARGIN, MAP_LABEL_TEXT, {
        size: MAP_LABEL_SIZE,
        color: '#000000',
      })
        .setOrigin(0, 0)
        .setDepth(20)
        .setVisible(false);
      label.postFX?.addGlow(0xffffff, 3, 0, false, 0.1, 10);
      this.mapLabel = label;

      this.mapCloseText = new HandText(this, cx, cy, MAP_CLOSE_TEXT, {
        size: MAP_CLOSE_TEXT_SIZE,
        color: '#ffffff',
        align: 'center',
      })
        .setOrigin(0.5, 0)
        .setDepth(32)
        .setVisible(false);
    }
```

At the end of `updateMapImageScale()`, add (it runs on create and on every resize, after the image is positioned):

```ts
    this.mapCloseText?.setPosition(
      this.mapImage.x,
      this.mapImage.y + this.mapImage.displayHeight / 2 + MAP_CLOSE_TEXT_GAP
    );
```

In `setupUICamera()`, after the `if (this.mapDot) ...` line, add:

```ts
    if (this.mapLabel) this.cameras.main.ignore(this.mapLabel);
    if (this.mapCloseText) this.cameras.main.ignore(this.mapCloseText);
```

- [ ] **Step 3: Show and hide them**

In `openMap()`, after `this.mapDot?.setVisible(true);`, add:

```ts
    this.mapCloseText?.setVisible(true);
```

In `closeMap()`, after `this.mapDot?.setVisible(false);`, add:

```ts
    this.mapCloseText?.setVisible(false);
```

Add this method directly before `updateDepthSort()`:

```ts
  // Walking around with nothing open: the only time the map label shows.
  private isFreeRoam(): boolean {
    return (
      this.introComplete &&
      !this.awaitingFirstControls &&
      !this.controlsOpen &&
      !this.mapOpen &&
      !interactionState.modalOpen
    );
  }
```

In `update()`, directly after `this.updateDepthSort();`, add:

```ts
    this.mapLabel?.setVisible(this.isFreeRoam());
```

- [ ] **Step 4: Open and close the map by touch**

Add this method directly after `isTouchOnInteractable()`:

```ts
  private isTouchOnMapLabel(pointer: Phaser.Input.Pointer): boolean {
    const label = this.mapLabel;
    if (!label || !label.visible) return false;
    return isWithinPaddedRect(
      pointer.x,
      pointer.y,
      { x: label.x, y: label.y, width: label.width, height: label.height },
      MAP_LABEL_TAP_PADDING_PX
    );
  }
```

In `handlePointerDown()`, replace `if (this.mapOpen) return;` with:

```ts
    if (this.mapOpen) {
      this.closeMap();
      return;
    }
```

and, directly before the `const nearest = this.findNearestInteractable();` line, add:

```ts
    if (this.isTouchOnMapLabel(pointer)) {
      this.openMap();
      return;
    }
```

After this task the whole handler reads:

```ts
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) return;
    this.movePointer = null;
    if (!this.introComplete) return;

    if (this.awaitingFirstControls) {
      this.dismissControlsPrompt();
      return;
    }
    if (this.controlsOpen) {
      this.closeControls();
      return;
    }
    if (this.mapOpen) {
      this.closeMap();
      return;
    }
    if (interactionState.modalOpen) {
      if (interactionState.choicesOpen) this.handleChoiceTap(pointer.x, pointer.y);
      return;
    }

    if (this.isTouchOnMapLabel(pointer)) {
      this.openMap();
      return;
    }

    const nearest = this.findNearestInteractable();
    if (nearest && this.isTouchOnInteractable(pointer, nearest)) {
      this.interactWith(nearest);
      return;
    }

    this.movePointer = pointer;
  }
```

- [ ] **Step 5: Verify the build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 6: Verify in the browser**

Device mode, iPhone SE:

- `MAP` is hidden during the intro reveal and the opening prompt, then appears top-left once the character can move.
- Tapping `MAP` opens the map with `tap anywhere to close` under it; the character does not walk.
- Tapping anywhere closes it, and the character does not walk from that tap even if held.
- `MAP` hides while a dialogue is open and returns when it closes.
- Rotate to landscape (667×375) with the map open: the image re-fits and the close text stays under it, on screen.
- Device mode off: no `MAP` label, no close text; `M` and `Esc` work as before.

- [ ] **Step 7: Commit**

```bash
git add src/game/scenes/WorldScene.ts
git commit -m "feat: open and close the map by touch"
```

---

### Task 7: README and full regression

**Files:**
- Modify: `README.md` (Controls section)

**Interfaces:**
- Consumes: everything above. Produces nothing.

- [ ] **Step 1: Document touch controls**

In `README.md`, add after the existing controls table:

```markdown
On a phone or tablet:

| Touch                           | Action                      |
| ------------------------------- | --------------------------- |
| Hold above / below / beside you | Move that way               |
| Tap someone next to you         | Talk                        |
| Tap                             | Advance dialogue            |
| Tap an option                   | Pick it                     |
| Tap `MAP`                       | Map (tap anywhere to close) |
```

- [ ] **Step 2: Run every automated check**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all succeed.

- [ ] **Step 3: Desktop regression**

`npm run dev`, device mode **off**. Check every row of the README keyboard table: WASD and arrows move; `E` and `Space` interact and advance; `C` opens and closes controls; `M` opens and closes the map; `Esc` closes each. Click and hold the mouse on the garden: nothing happens.

- [ ] **Step 4: Touch pass at both sizes**

Device mode at 375×667 and again at 667×375: play from the loading screen through the intro, walk in all four directions, talk to two NPCs, pick a choice with a follow-up, open and close the map. Confirm no text mentions a key and nothing scrolls or zooms.

- [ ] **Step 5: Real phone**

Run `npm run dev -- --host`, open the printed network URL on a phone on the same Wi-Fi, and repeat Step 4 once. Confirm the bottom prompt and the dialogue box are not hidden behind the browser's address bar.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: add touch controls to the README"
```
