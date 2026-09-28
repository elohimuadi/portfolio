// Hand-drawn dialogue font.
//
// Each letter is a 7-frame sprite strip (idle 1-5, glitch 1-2) used as a CSS
// mask, so the ink takes whatever `color` the text has. The idle frames loop
// as a "line boil"; each letter starts on a different frame so the word never
// pulses in sync. Every few seconds one visible letter snaps to a glitch frame
// for a single tick.
//
// Characters without a drawn glyph (digits, quotes, symbols) fall back to the
// regular font so nothing ever disappears.

import { HANDFONT } from './content/handfont-metrics';

const ASSET_BASE = '/assets/handfont/';
const IDLE_FRAMES = 5;
const FRAME_MS = 125; // 8 fps
const GLITCH_MS = 110;
const GLITCH_MIN_GAP_MS = 2500;
const GLITCH_MAX_GAP_MS = 6000;

type Glyph = { file: string; cw: number; lsb: number; adv: number };
const glyphs = HANDFONT.glyphs as Record<string, Glyph>;

// Characters that borrow another drawn glyph (curly quotes, long dashes).
const ALIASES: Record<string, string> = {
  '\u201C': '"',
  '\u201D': '"',
  '\u2019': "'",
  '\u2018': "'",
  '\u2014': '-',
  '\u2013': '-',
};

function glyphKey(ch: string): string {
  return ALIASES[ch] ?? ch;
}

export function hasHandGlyph(ch: string): boolean {
  return glyphKey(ch) in glyphs;
}

// Warm the image cache so a letter's mask is ready the first time it types.
let preloaded = false;
export function preloadHandFont(): void {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  for (const g of Object.values(glyphs)) {
    const img = new Image();
    img.src = `${ASSET_BASE}${g.file}.png`;
  }
}

function glyphEl(ch: string, index: number): HTMLElement {
  const g = glyphs[glyphKey(ch)];
  const el = document.createElement('span');
  el.className = 'hg';
  el.style.setProperty('--img', `url("${ASSET_BASE}${g.file}.png")`);
  el.style.setProperty('--cw', `${g.cw}px`);
  el.style.setProperty('--lsb', `${g.lsb}px`);
  el.style.setProperty('--adv', `${g.adv + HANDFONT.tracking}px`);
  // Offset each letter's start frame so neighbours don't boil in lockstep.
  el.style.setProperty('--delay', `${-(index % IDLE_FRAMES) * FRAME_MS}ms`);
  return el;
}

function fallbackEl(ch: string): HTMLElement {
  const el = document.createElement('span');
  el.className = 'hf';
  el.textContent = ch;
  return el;
}

/**
 * Renders `text` into `container` as hidden hand-drawn glyphs and returns one
 * element per UTF-16 code unit of `text`, so a typewriter that counts
 * `text.length` can reveal element `i` on tick `i` (call `revealHand`).
 * Laying every glyph out up front also means lines don't re-wrap mid-type.
 */
export function renderHandText(container: HTMLElement, text: string): HTMLElement[] {
  container.replaceChildren();

  // Screen readers get the plain string; the glyph soup is hidden from them.
  const sr = document.createElement('span');
  sr.className = 'hand-sr';
  sr.textContent = text;
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  container.append(sr, visual);

  const units: HTMLElement[] = [];
  let word: HTMLElement | null = null;
  let glyphIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '\n') {
      word = null;
      const br = document.createElement('br');
      visual.append(br);
      units.push(br as HTMLElement);
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      word = null;
      const sp = document.createElement('span');
      sp.className = 'hs';
      sp.style.width = `${HANDFONT.space}px`;
      // Zero-width space after the gap is the line-break opportunity.
      visual.append(sp, document.createTextNode('​'));
      units.push(sp);
      continue;
    }

    // Keep surrogate pairs (emoji) together as one fallback element.
    const code = text.charCodeAt(i);
    const isPair = code >= 0xd800 && code <= 0xdbff && i + 1 < text.length;
    const full = isPair ? text.slice(i, i + 2) : ch;

    if (!word) {
      word = document.createElement('span');
      word.className = 'hw';
      visual.append(word);
    }
    const el = hasHandGlyph(full) ? glyphEl(full, glyphIndex++) : fallbackEl(full);
    word.append(el);
    units.push(el);
    if (isPair) {
      units.push(el);
      i++;
    }
  }

  return units;
}

export function revealHand(units: HTMLElement[], upTo: number): void {
  for (let i = 0; i < Math.min(upTo, units.length); i++) units[i].classList.add('on');
}

// Occasional glitch: one visible letter jumps to a left-hand frame for a tick.
let glitchTimer: number | null = null;
export function startHandGlitches(root: ParentNode = document): void {
  if (glitchTimer !== null || typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const schedule = () => {
    const gap = GLITCH_MIN_GAP_MS + Math.random() * (GLITCH_MAX_GAP_MS - GLITCH_MIN_GAP_MS);
    glitchTimer = window.setTimeout(() => {
      const visible = root.querySelectorAll<HTMLElement>('.hg.on');
      if (visible.length > 0) {
        const el = visible[Math.floor(Math.random() * visible.length)];
        el.style.setProperty('--gf', String(IDLE_FRAMES + Math.floor(Math.random() * 2)));
        el.classList.add('glitch');
        window.setTimeout(() => el.classList.remove('glitch'), GLITCH_MS);
      }
      schedule();
    }, gap);
  };
  schedule();
}
