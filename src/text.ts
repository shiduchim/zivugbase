/* Words shown in the app (PLAN §4: everyday words, never system words). */
import type { ActivityKind, CameFrom, IdeaStatus, Mode, Role } from './db/types';

export const ROLE_LABEL: Record<Role, string> = {
  me: 'Me',
  single: 'Single',
  shadchan: 'Shadchan',
  contact: 'Contact person',
  reference: 'Reference',
  friend: 'Friend',
  helper: 'Helper'
};

/* Roles a person can be given in the edit form ("me" is never picked by hand). */
export const PICKABLE_ROLES: Role[] = ['single', 'shadchan', 'helper', 'contact', 'reference', 'friend'];

export const MODE_LABEL: Record<Mode, string> = { me: 'Me — I’m single', helping: 'People I help', both: 'Both' };

export const KIND_LABEL: Record<ActivityKind, string> = {
  note: 'Note',
  audio: 'Voice note',
  call: 'Call',
  'call-note': 'After a call',
  'message-out': 'Message sent',
  'message-in': 'Message received',
  'profile-sent': 'Profile sent',
  'profile-received': 'Profile received',
  status: 'Status',
  met: 'Met',
  action: 'Done'
};

export const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', phone: 'Phone', 'in-person': 'In person'
};

export const IDEA_STATUS: Record<IdeaStatus, string> = {
  new: 'New',
  'looking-into': 'Looking into it',
  yes: 'Yes',
  no: 'No',
  'maybe-later': 'Maybe later',
  'waiting-other-side': 'Waiting for the other side',
  dating: 'Dating',
  paused: 'Paused',
  engaged: 'Engaged',
  ended: 'Ended',
  sent: 'Suggested'
};

export const CAME_FROM_LABEL: Record<CameFrom['kind'], string> = {
  referred: 'Someone gave me their details',
  friend: 'A friend',
  family: 'Family',
  internet: 'Internet search',
  site: 'A dating site',
  'whatsapp-group': 'A WhatsApp group',
  organization: 'An organization',
  event: 'An event',
  ad: 'An ad',
  knew: 'I already knew them',
  import: 'Imported',
  other: 'Other'
};

export const HOW_WELL_LABEL = { personal: 'I know them personally', recommended: 'Recommended to me', card: 'I only have their details' } as const;
export const OK_TO_SHARE_LABEL = { yes: 'Yes', only: 'Only with certain people', ask: 'Ask first' } as const;

export const HELPER_TYPES = ['Shidduch coach', 'Photographer', 'Rabbi', 'Rebbetzin', 'Therapist', 'Organization', 'Dating site', 'WhatsApp group', 'Events'];

/* PeerMatch fields kept as facts. */
export const FACT_LABEL: Record<string, string> = {
  religiousLevel: 'Religious level',
  religiousDetails: 'Religious details',
  divorced: 'Divorced',
  withKids: 'Has children',
  kosherForKohen: 'Can marry a Kohen',
  baalTeshuvah: 'Baal teshuvah',
  watchesMovies: 'Watches movies',
  prays3Daily: 'Prays three times a day',
  smokes: 'Smokes',
  langEnglish: 'Speaks English',
  langHebrew: 'Speaks Hebrew',
  langRussian: 'Speaks Russian',
  bodyType: 'Build',
  talkedPhone: 'Talked by phone',
  talkedInPerson: 'Met in person',
  shareEnglish: 'Share in English',
  shareHebrew: 'Share in Hebrew',
  shareRussian: 'Share in Russian'
};

export const plural = (n: number, one: string, many = one + 's'): string => `${n} ${n === 1 ? one : many}`;
