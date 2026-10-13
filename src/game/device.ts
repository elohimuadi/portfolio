// True on phones and tablets: no hover and a coarse (finger) pointer. Used
// for wording and which UI shows only. Touch input itself is always on.
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}
