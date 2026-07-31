export type DialogueChoice = {
  label: string;
  // Selecting this choice opens href in a new tab, then closes the dialogue.
  href?: string;
  // Selecting this choice instead re-types this text as a follow-up line
  // (single-level branch — the follow-up itself has no further choices).
  followUpBody?: string;
};

export type InteractableContent = {
  title: string;
  kind: 'about' | 'project' | 'contact' | 'npc' | 'item';
  meta?: string;
  body: string;
  links?: Array<{ label: string; href: string }>;
  choices?: DialogueChoice[];
};

export const INTERACTABLE_CONTENT: Record<string, InteractableContent> = {
  project_sidequest: {
    title: 'Sidequest',
    kind: 'project',
    meta: 'Project · Placeholder',
    body: `Placeholder description for Sidequest. A short paragraph on what it is, the problem it solves, and what was interesting about building it.`,
    links: [
      { label: 'Visit', href: '#' },
      { label: 'Source', href: '#' },
    ],
  },
  project_hakari: {
    title: 'Hakari',
    kind: 'project',
    meta: 'Project · Placeholder',
    body: `Placeholder description for Hakari. Swap with the real pitch: stack, role, outcome.`,
    links: [
      { label: 'Visit', href: '#' },
      { label: 'Source', href: '#' },
    ],
  },
  contact: {
    title: 'Contact',
    kind: 'contact',
    meta: 'Room 03 · The Mailbox',
    body: `Placeholder contact copy. Drop email, calendar link, and any preferred channels here.`,
    links: [
      { label: 'Email', href: 'mailto:placeholder@example.com' },
      { label: 'GitHub', href: '#' },
    ],
  },
  gojocat: {
    title: 'GOJOCAT',
    kind: 'npc',
    body: `yowaimo`,
  },
  pompompurin: {
    title: 'POMPOMPURIN',
    kind: 'npc',
    body: `yo wazzup dawg`,
  },
  shoya: {
    title: 'SHOYA ISHIDA',
    kind: 'npc',
    body: `Yo Josh, Trynna get inspiration from your anime list again?`,
    choices: [
      { label: 'Yes', href: 'https://myanimelist.net/profile/elohimuadi' },
      { label: 'No', followUpBody: 'Alright, next time then.' },
    ],
  },
  cross: {
    title: 'CROSS',
    kind: 'item',
    body: `Jesus, thank you for dying on the cross for me, your blood sheds me of my sins, you are my King, my God`,
  },
  trophy: {
    title: 'BOXING GLOVES',
    kind: 'item',
    body: `These are my boxing gloves, maybe its time to train muay thai again`,
  },
  bookDark: {
    title: 'BOOK',
    kind: 'item',
    body: `reading.... so boring as a concept but so fun when doing it, so paradoxical`,
  },
  bookPurple: {
    title: 'JOURNAL',
    kind: 'item',
    body: `my journal that I write about my life in, shhh dont reveal my secrets`,
  },
  basketballVolleyball: {
    title: 'SPORTS',
    kind: 'item',
    body: `two of my favorite sports..... getting restless just thinking about playing`,
  },
  boba: {
    title: 'BOBA',
    kind: 'item',
    body: `boba boba what will i do without you`,
  },
  musicPlayer: {
    title: 'MUSIC',
    kind: 'item',
    body: `maybe its time to listen to music again, should I view my playlists?`,
    choices: [
      { label: 'Yes', href: 'https://open.spotify.com/user/d1qv1qtexr599oxv3ji9587hg' },
      { label: 'No', followUpBody: 'maybe later then' },
    ],
  },
};
