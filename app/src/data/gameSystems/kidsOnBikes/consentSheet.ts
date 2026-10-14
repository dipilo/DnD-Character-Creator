import type { KobConsentSheet } from '@/types/kob';

/** Transcribed: the vault has no note and the source PDFs are encrypted. */
export interface KobConsentField {
  key: keyof KobConsentSheet;
  label: string;
  description: string;
}

export const KOB_ROMANCE_LEVELS: readonly KobConsentField[] = [
  {
    key: 'crush',
    label: 'Crush',
    description:
      'A crush is considered relatively harmless with no intimacy. Characters may get flustered, blush, try to show affection through small gifts, acts of service, or compliments. They may hold hands or even share a small kiss on the cheek.',
  },
  {
    key: 'date',
    label: 'Date',
    description:
      'Dating is going out to places, hanging out together, sharing an emotional bond, with minimal or light physical intimacy. Characters might be jealous or protective of each other. They might show affection with grand gestures, by being helpful, protecting each other, or helping the other succeed. They may cuddle, kiss, make out, or have sex. (Underage characters should not be discussed having sex.)',
  },
  {
    key: 'partner',
    label: 'Partner',
    description:
      'Partners spend a lot of time together, are often in a committed relationship like a marriage or common-law marriage, and often live together. They may show affection through inside jokes, shared history, having or adopting children together, doing household chores for one another, or helping the other get through their daily lives. They may share an easier physical intimacy, regularly have sex or other physical closeness, and know each other very intimately.',
  },
];

export const KOB_INTIMACY_LEVELS: readonly KobConsentField[] = [
  {
    key: 'onScreenIntimacy',
    label: 'On-Screen Intimacy',
    description:
      'Indicates that you’re okay with the kinds of physical affection mentioned for each relationship and that you’re okay with them occurring on screen for your character.',
  },
  {
    key: 'offScreenIntimacy',
    label: 'Off-Screen Intimacy',
    description:
      'Indicates that you’re okay with any of the kinds of physical affection mentioned for each relationship but that you only want them to occur in ways that are not described at the table.',
  },
];

/** The one line stated as a hard limit, so the sheet enforces it rather than showing it. */
export const KOB_CHILD_INTIMACY_HARD_LINE =
  "Children should not engage in sexual intimacy. They’ve got monsters to fight! " +
  'On-screen and off-screen intimacy are unavailable for a child character.';

export const KOB_RELATIONSHIP_NOTES_PROMPT =
  'You might prefer to only roleplay intimacy with nonplayer characters, for example, or you’d like for your character to have a long distance relationship that doesn’t get mentioned frequently.';
