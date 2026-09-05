export type DialogueChoice = {
  label: string;
  // Selecting this choice opens href in a new tab, then closes the dialogue.
  href?: string;
  // Selecting this choice instead re-types this text as a follow-up line.
  followUpBody?: string;
  // Choices to present once followUpBody finishes typing — recursive, so a
  // branch can nest to any depth (each nested choice can itself carry its
  // own followUpBody/followUpChoices).
  followUpChoices?: DialogueChoice[];
  // Selecting this choice fires EVT_NPC_REACT (id + this value) so WorldScene
  // can react on the Phaser side — e.g. swap an NPC's sprite frame. Purely
  // content-side metadata; this module has no Phaser dependency.
  reaction?: string;
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
  claude: {
    title: 'CLAUDE',
    kind: 'npc',
    body: `I wrote most of this code. You're welcome.`,
  },
  golang: {
    title: 'GOLANG',
    kind: 'npc',
    body: `You wanna know a lil sumthin?`,
    choices: [
      {
        label: 'Yes',
        followUpBody: `I know you better than you know yourself. What sumthin do you wanna know?`,
        followUpChoices: [
          {
            label: 'Spotz',
            followUpBody: `Spotz huh. On my notes on everything about you it reads that it is a local spot finder so you dont ever look like a tourist and do tourist things. Apparently it scours websites and posts only native to the country you are discovering. Kinda mid I could make that in erm 3 seconds. Anyways wanna visit it?`,
            followUpChoices: [
              { label: 'Yes', href: 'https://github.com/elohimuadi/spotz' },
              {
                label: 'No',
                followUpBody: `and all that pitching I did get out of my face`,
                reaction: 'annoyed',
              },
            ],
          },
          {
            label: 'Hakari',
            followUpBody: `well I cant tell you about dat just yet son.`,
          },
          {
            label: 'Sidequest',
            followUpBody: `well I cant tell you about dat just yet son.`,
          },
        ],
      },
      {
        label: 'No',
        followUpBody: `well whyd you come up to me boy`,
        reaction: 'annoyed',
      },
      {
        label: 'how do you know me so well?',
        followUpBody: `well..... um...... I have my ways (definitely dont stalk you or anything)`,
      },
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
