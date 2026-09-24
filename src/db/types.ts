/* ZivugBase data model — see docs/PLAN.md §5. One person = one record, whatever their roles. */

export type ID = string;

export type Role = 'me' | 'single' | 'shadchan' | 'contact' | 'reference' | 'friend' | 'helper';
export type Gender = 'm' | 'f' | '';
export type PhoneType = 'mobile' | 'landline' | '';

export interface Phone {
  number: string;          /* as the user sees it (Israeli numbers in local 0… form) */
  type: PhoneType;
  label?: string;
  waid?: string;           /* WhatsApp's own international number, when known */
}

export interface AgeInfo {
  value: number;
  asOf: number;            /* ms — the date this age was true */
  estimated?: boolean;     /* asOf inferred (e.g. the date the record was added) */
}

export interface ContactLink { personId: ID; relation: string }

export interface CameFrom {
  kind: 'referred' | 'friend' | 'family' | 'internet' | 'site' | 'whatsapp-group' | 'organization' | 'event' | 'ad' | 'knew' | 'import' | 'other';
  personId?: ID;
  note?: string;
  date?: number;
}

export interface Person {
  id: ID;
  kind: 'person' | 'organization';
  roles: Role[];
  helperType?: string;
  name: string;
  altNames: string[];
  gender: Gender;
  age?: AgeInfo;
  dob?: string;
  city: string;
  phones: Phone[];
  emails: string[];
  links: string[];
  profile: { text: string; updatedAt?: number };
  resumeFileIds: ID[];
  photoFileIds: ID[];
  audioProfile?: { fileId: ID; transcript?: string };
  lookingFor: { text: string; minAge?: number; maxAge?: number };
  facts: Record<string, string | boolean>;
  tags: string[];
  contactPeople: ContactLink[];
  cameFrom?: CameFrom;
  voucher?: { personId?: ID; text: string };
  howWellKnown?: 'personal' | 'recommended' | 'card';
  reach?: { contactPersonId?: ID; rules: string[] };
  kohen?: boolean | null;
  okToShare?: 'yes' | 'only' | 'ask';
  siteIds: { site: string; profileId?: string; url?: string }[];
  nextStep?: { what: string; due?: number };
  waitingSince?: number;
  snoozeUntil?: number;    /* hidden from Today until then */
  favorite: boolean;
  status: string;
  notes: string;
  suggestedToMe?: boolean;
  phoneKeys: string[];     /* normalized numbers, indexed — duplicate checks and lookups */
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  legacyKey?: string;      /* e.g. "peermatch:girls:<peermatch id>" — makes import repeatable */
  legacy?: { source: 'peermatch'; collection: string; record: unknown };
}

export type IdeaStatus = 'new' | 'looking-into' | 'yes' | 'no' | 'maybe-later' | 'waiting-other-side' | 'dating' | 'paused' | 'engaged' | 'ended' | 'sent';

export interface Idea {
  id: ID;
  aId: ID;                 /* a person id, or the "me" person */
  bId: ID;
  suggestedBy: { personId?: ID; site?: string; at?: number }[];
  status: IdeaStatus;
  answers: { a?: { answer: 'yes' | 'no' | 'thinking'; at: number }; b?: { answer: 'yes' | 'no' | 'thinking'; at: number } };
  closed?: { by?: 'a' | 'b' | 'both' | 'other'; reasons: string[]; note?: string; at: number };
  nextStep?: { what: string; due?: number };
  notes: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  legacyKey?: string;
}

export type ActivityKind =
  | 'note' | 'audio' | 'call' | 'call-note' | 'message-out' | 'message-in'
  | 'profile-sent' | 'profile-received' | 'status' | 'met' | 'action';

export interface Activity {
  id: ID;
  at: number;
  kind: ActivityKind;
  channel?: string;        /* whatsapp · sms · email · phone · in-person */
  title?: string;
  text: string;
  audioFileId?: ID;
  fileIds?: ID[];
  linkKeys: string[];      /* "p:<personId>" / "i:<ideaId>" — one entry, shown in every linked timeline */
  meta?: Record<string, unknown>;
  createdAt: number;
  deletedAt?: number;
  legacyKey?: string;
}

export type InboxSource = 'share' | 'paste' | 'speak' | 'photo' | 'import';
export type InboxLevel = 'received' | 'understood' | 'filed' | 'dismissed';

export interface InboxItem {
  id: ID;
  receivedAt: number;
  source: InboxSource;
  title?: string;
  text: string;            /* the ORIGINAL text, never replaced */
  url?: string;
  fileIds: ID[];
  sender?: string;         /* only when the source really provided it */
  transcript?: string;
  level: InboxLevel;
  filedAs?: { kind: 'person' | 'note'; id: ID; personId?: ID };
  queueRef?: string;       /* share-queue key, so a share is never filed twice */
  deletedAt?: number;
}

export interface FileRec {
  id: ID;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  thumb?: Blob;
}

/* A folder is a List of kind 'folder'. parentId is another folder's id, or a built-in top
   folder ('root:guys', 'root:girls', 'root:shadchanim', 'root:ideas', 'root:others').
   Being in a folder is a label: removing someone from a folder never deletes them. */
export interface List {
  id: ID;
  name: string;
  kind: 'saved' | 'manual' | 'folder';
  parentId?: string;
  query?: string;
  memberIds: ID[];
  keepInTouchDays?: number;
  createdAt: number;
}

export interface Setting { key: string; value: unknown }
export interface Draft { key: string; value: unknown; savedAt: number }

export type Mode = 'me' | 'helping' | 'both';
