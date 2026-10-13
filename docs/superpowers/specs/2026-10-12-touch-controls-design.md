# Touch controls for GOL

Date: 2026-10-12

## Goal

Make GOL playable on a phone. Today the loading and intro screens accept
taps, but `WorldScene` reads the keyboard only, so a phone visitor reaches
the garden and cannot move, talk, pick a choice, or open the map.

This is one site with a second input source, not a separate mobile build.
Desktop keyboard behaviour does not change.

## Success criteria

- On a phone, a visitor can walk the garden, talk to every NPC and object,
  pick dialogue choices, and open and close the map, using touch alone.
- The on-screen wording never mentions a key on a touch device.
- Nothing on the page scrolls, zooms, or gets hidden behind the browser's
  address bar while playing.
- On desktop, every existing key still does what it does today.

## Touch detection

`src/game/device.ts` exports `isTouchDevice(): boolean`, which returns
`window.matchMedia('(hover: none) and (pointer: coarse)').matches`.

This flag decides **wording and which UI is shown** only. Touch *input* is
always listened for, so a touchscreen laptop can use both. Only touch
pointers act; a mouse click never walks, talks, or opens the map.

## Movement

The screen is split into four wedges by two diagonals crossing at the
player's on-screen position. Touching a wedge walks in that direction.

- The wedge origin is the player's actual screen position, taken from the
  main camera (`worldView` and zoom), not the screen centre. The camera
  follows with a 40px vertical offset and clamps at the map edges, so the
  player is often off-centre.
- Holding keeps walking; releasing stops. Dragging the finger into another
  wedge changes direction without lifting.
- Four directions only. Ties on the diagonal go horizontal, matching
  `updatePlayerAnimation`.
- Only the first active pointer drives movement; extra fingers are ignored.

The wedge maths lives in `src/game/input/touch.ts` as a pure function:

```ts
export type Direction = 'up' | 'down' | 'left' | 'right';

export function directionFromTouch(
  touchX: number,
  touchY: number,
  originX: number,
  originY: number,
  deadZone: number
): Direction | null;
```

It returns `null` when the touch is within `deadZone` pixels of the origin
(a touch on the character itself), so the character does not jitter.
`TOUCH_DEAD_ZONE_PX` is a named constant.

`WorldScene.handleMovement` ORs the touch direction with the existing
keyboard booleans, so both inputs share one code path for velocity and
animation.

## Talking

On `pointerdown`, before treating the touch as movement:

1. If an interactable is in range (the existing `findNearestInteractable`
   result) and the touch lands on that interactable's sprite bounds, padded
   by `TOUCH_TARGET_PADDING_PX`, start the interaction.
2. Otherwise the touch is movement. Tapping a far-away NPC therefore walks
   toward it.

The keyboard path and the touch path both call one extracted method,
`interactWith(target)`, holding the body of today's `handleInteractKeys`
(face the target, the `no-face` and Golang special cases, dispatch
`EVT_INTERACT`).

The touch that closes a dialogue must not also start walking: a pointer
that went down while a modal was open is ignored until it is released.

## Dialogue and choices

- Advancing dialogue by tapping already works through the DOM layer's click
  handler.
- Choices are Phaser `HandText` objects, but the DOM `.dialogue-layer`
  covers the viewport and swallows taps. While the dialogue is in the
  `choosing` state the layer gets `pointer-events: none`, so taps reach the
  canvas.
- Each choice text gets a hit area. Tapping one sets
  `selectedChoiceIndex`, plays the select sound, and dispatches
  `EVT_CHOICE_CONFIRMED`. Keyboard navigation is unchanged.

## Prompts on touch devices

| Moment | Desktop (unchanged) | Touch |
| --- | --- | --- |
| Intro continue | `[ click to continue ]` | `[ tap to continue ]` |
| First prompt in the garden | `damn, I'd like to move, maybe i should press c` | `damn, I'd like to move, maybe i should tap in the direction i wanna go` |
| Dismissing that prompt | `C` opens the controls screen | First touch dismisses it and unlocks movement; no controls screen |
| Something comes into range | Eye hint opens | Eye hint stays hidden; the first time only, the bottom prompt writes `maybe i should tap on them to talk` |
| Controls screen | `C` | Not available |

The talk prompt reuses the existing bottom-of-screen handwriting prompt
(typewriter, squiggle, sound). It is shown once per page load and fades
when the player talks to something or walks out of range.

The eye hint is hidden on touch because its art contains an `E`. The
marker above the nearest interactable still shows, so there is still a cue.

## Map

- On touch, a `MAP` label in the handwritten font sits in the top-left
  corner on the UI camera, with a padded hit area. Tapping it opens the
  map. It is hidden while a dialogue, the map, or the intro is showing.
- While the map is open on touch, `tap anywhere to close` is written under
  the map image, and any tap closes it.
- Desktop keeps `M` and `Esc`, with no label and no extra text.

## Layout

- `.game-root` uses `height: 100dvh` with `100vh` as the fallback.
- The canvas gets `touch-action: none`; the page gets
  `user-select: none` and `-webkit-touch-callout: none` so long-press does
  not select or open a callout.
- The viewport meta tag is left alone (no `viewport-fit=cover`), so the
  browser keeps the page inside the safe area and nothing lands under a
  notch.
- Below 480px wide, the dialogue body box uses smaller border, padding, and
  `min-height` values so it does not cover half the screen.

## Files

| File | Change |
| --- | --- |
| `src/game/device.ts` | New. `isTouchDevice()`. |
| `src/game/input/touch.ts` | New. `directionFromTouch()` and touch constants. |
| `src/game/input/touch.test.ts` | New. Unit tests. |
| `src/game/scenes/WorldScene.ts` | Read touch in movement and interact; tappable choices; touch prompts; hide eye hint on touch; map label and close text. |
| `src/game/scenes/IntroScene.ts` | Touch wording for the continue prompt. |
| `src/components/Game.astro` | `dvh`, touch CSS, `pointer-events` while choosing, small-screen dialogue sizes. |
| `src/pages/index.astro` | Body CSS: no scroll, zoom, or text selection. |
| `package.json` | Add Vitest and a `test` script. |
| `README.md` | Add touch controls to the controls table. |

`WorldScene.ts` is already 2,057 lines. This work adds touch handling as
small private methods and keeps the maths outside the scene; splitting the
scene up is a separate job and is out of scope here.

## Testing

- **Unit (Vitest):** `directionFromTouch` for each wedge, the diagonal
  tie-break, the dead zone, and an off-centre origin.
- **Manual, in a browser at 375×667 and 667×375 with touch emulation:**
  walk in all four directions, talk to an NPC, pick a choice that opens a
  follow-up, open and close the map, confirm the two prompts appear once.
- **Desktop regression:** every key in the README controls table.
- **Real device:** one pass on an actual phone before calling it done,
  because address-bar and safe-area behaviour does not show in emulation.

## Out of scope

- Virtual joystick, pathfinding, or tap-to-walk-to-a-spot.
- A redrawn eye hint without the `E`.
- A controls screen for touch.
- Refactoring `WorldScene` beyond the `interactWith` extraction.
