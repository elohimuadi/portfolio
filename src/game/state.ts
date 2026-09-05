export const interactionState: {
  modalOpen: boolean;
  nearestInteractable: string | null;
  // True while a Yes/No-style choice prompt is active. Game.astro (DOM
  // dialogue text) sets this; WorldScene (Phaser choice UI) reads it to
  // decide whether W/S/arrows/E/Space should navigate/confirm a choice
  // instead of the normal advance-dialogue behavior.
  choicesOpen: boolean;
} = {
  modalOpen: false,
  nearestInteractable: null,
  choicesOpen: false,
};

export const EVT_INTERACT = 'portfolio:interact';
export const EVT_MODAL_CLOSED = 'portfolio:modal-closed';
export const EVT_NEAREST_CHANGED = 'portfolio:nearest-changed';
// Choice UI lives entirely in Phaser (WorldScene) — no DOM/CSS involved.
// Game.astro dispatches EVT_SHOW_CHOICES/EVT_HIDE_CHOICES to tell WorldScene
// what to render; WorldScene dispatches EVT_CHOICE_CONFIRMED back once the
// player picks one (E/Space), so Game.astro can act on it (open a link, or
// type a follow-up line).
export const EVT_SHOW_CHOICES = 'portfolio:show-choices';
export const EVT_HIDE_CHOICES = 'portfolio:hide-choices';
export const EVT_CHOICE_CONFIRMED = 'portfolio:choice-confirmed';
// Dispatched by Game.astro (which owns choice content/selection) when a
// chosen DialogueChoice carries a `reaction` — lets WorldScene (which owns
// the actual sprite) react to a choice pick without either side needing to
// know about the other's internals.
export const EVT_NPC_REACT = 'portfolio:npc-react';

export type InteractDetail = { id: string };
export type NearestChangedDetail = { id: string | null };
export type ShowChoicesDetail = { labels: string[] };
export type ChoiceConfirmedDetail = { index: number };
export type NpcReactDetail = { id: string; reaction: string };
