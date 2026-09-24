import { db } from './db';
import type { Activity, ActivityKind, FileRec, ID, Idea, Person, Role } from './types';
import { newId, now } from '../lib/ids';
import { phoneKey, phoneType } from '../lib/phone';

export const TRASH_DAYS = 30;
const DAY = 86400000;

export function blankPerson(init: Partial<Person> = {}): Person {
  const t = now();
  const p: Person = {
    id: newId(),
    kind: 'person',
    roles: [],
    name: '',
    altNames: [],
    gender: '',
    city: '',
    phones: [],
    emails: [],
    links: [],
    profile: { text: '' },
    resumeFileIds: [],
    photoFileIds: [],
    lookingFor: { text: '' },
    facts: {},
    tags: [],
    contactPeople: [],
    siteIds: [],
    favorite: false,
    status: '',
    notes: '',
    phoneKeys: [],
    createdAt: t,
    updatedAt: t,
    ...init
  };
  p.phones = p.phones.map((ph) => ({ ...ph, type: ph.type || phoneType(ph.number) }));
  p.phoneKeys = keysFor(p);
  return p;
}

export function keysFor(p: Pick<Person, 'phones'>): string[] {
  const keys = new Set<string>();
  for (const ph of p.phones) {
    const k = phoneKey(ph.waid || ph.number);
    if (k) keys.add(k);
  }
  return [...keys];
}

export async function savePerson(p: Person): Promise<Person> {
  p.updatedAt = now();
  p.phoneKeys = keysFor(p);
  await db.people.put(p);
  return p;
}

export async function getPerson(id: ID): Promise<Person | undefined> {
  const p = await db.people.get(id);
  return p && !p.deletedAt ? p : undefined;
}

export async function findByPhone(raw: string): Promise<Person[]> {
  const k = phoneKey(raw);
  if (!k) return [];
  return (await db.people.where('phoneKeys').equals(k).toArray()).filter((p) => !p.deletedAt);
}

export async function livePeople(role?: Role): Promise<Person[]> {
  const rows = role ? await db.people.where('roles').equals(role).toArray() : await db.people.toArray();
  return rows.filter((p) => !p.deletedAt);
}

/* ---------- the owner's own record ---------- */

export async function getMe(): Promise<Person | undefined> {
  return (await db.people.where('roles').equals('me').toArray()).find((p) => !p.deletedAt);
}

export async function ensureMe(): Promise<Person> {
  const existing = await getMe();
  if (existing) return existing;
  const me = blankPerson({ roles: ['me', 'single'], name: 'Me' });
  await db.people.put(me);
  return me;
}

/* ---------- delete with Undo, and Recently deleted ---------- */

export async function softDeletePerson(id: ID): Promise<() => Promise<void>> {
  const t = now();
  await db.people.update(id, { deletedAt: t });
  return async () => {
    await db.people.update(id, { deletedAt: undefined });
  };
}

export async function restorePerson(id: ID): Promise<void> {
  await db.people.update(id, { deletedAt: undefined, updatedAt: now() });
}

export async function recentlyDeleted(): Promise<Person[]> {
  const rows = await db.people.where('deletedAt').above(0).toArray();
  return rows.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

/* Deletes forever: the person, timeline entries that only concern them, and files only they use. */
export async function deleteForever(id: ID): Promise<void> {
  await db.transaction('rw', [db.people, db.activities, db.files, db.ideas, db.inbox], async () => {
    const p = await db.people.get(id);
    if (!p) return;
    const key = 'p:' + id;
    const acts = await db.activities.where('linkKeys').equals(key).toArray();
    const fileIds = new Set<ID>([...p.resumeFileIds, ...p.photoFileIds, ...(p.audioProfile ? [p.audioProfile.fileId] : [])]);
    for (const a of acts) {
      const others = a.linkKeys.filter((k) => k !== key);
      if (others.length) await db.activities.update(a.id, { linkKeys: others });
      else {
        await db.activities.delete(a.id);
        for (const f of [...(a.fileIds ?? []), ...(a.audioFileId ? [a.audioFileId] : [])]) fileIds.add(f);
      }
    }
    for (const f of fileIds) if (!(await fileInUse(f, id))) await db.files.delete(f);
    const ideas = [...(await db.ideas.where('aId').equals(id).toArray()), ...(await db.ideas.where('bId').equals(id).toArray())];
    for (const i of ideas) await db.ideas.delete(i.id);
    await db.people.delete(id);
  });
}

async function fileInUse(fileId: ID, exceptPersonId: ID): Promise<boolean> {
  const people = await db.people.toArray();
  if (people.some((p) => p.id !== exceptPersonId && (p.resumeFileIds.includes(fileId) || p.photoFileIds.includes(fileId) || p.audioProfile?.fileId === fileId))) return true;
  const acts = await db.activities.filter((a) => (a.fileIds ?? []).includes(fileId) || a.audioFileId === fileId).count();
  const inbox = await db.inbox.filter((i) => i.fileIds.includes(fileId)).count();
  return acts + inbox > 0;
}

export async function purgeTrash(at = now()): Promise<number> {
  const old = (await recentlyDeleted()).filter((p) => (p.deletedAt ?? at) < at - TRASH_DAYS * DAY);
  for (const p of old) await deleteForever(p.id);
  return old.length;
}

/* ---------- timeline ---------- */

export async function addActivity(kind: ActivityKind, text: string, links: ID[], extra: Partial<Activity> = {}): Promise<Activity> {
  const t = now();
  const a: Activity = {
    id: newId(),
    at: extra.at ?? t,
    kind,
    text,
    linkKeys: [...new Set(links.map((id) => (id.includes(':') ? id : 'p:' + id)))],
    createdAt: t,
    ...extra
  };
  await db.activities.put(a);
  return a;
}

export async function timeline(personId: ID): Promise<Activity[]> {
  const rows = await db.activities.where('linkKeys').equals('p:' + personId).toArray();
  return rows.filter((a) => !a.deletedAt).sort((a, b) => b.at - a.at);
}

export async function lastContact(personId: ID): Promise<number | undefined> {
  const rows = await timeline(personId);
  return rows.find((a) => a.kind !== 'status' && a.kind !== 'note')?.at ?? rows[0]?.at;
}

export async function ideasFor(personId: ID): Promise<Idea[]> {
  const rows = [...(await db.ideas.where('aId').equals(personId).toArray()), ...(await db.ideas.where('bId').equals(personId).toArray())];
  return rows.filter((i) => !i.deletedAt);
}

/* ---------- files ---------- */

export async function saveFile(blob: Blob, name: string, extra: Partial<FileRec> = {}): Promise<ID> {
  const rec: FileRec = { id: newId(), blob, name: name || 'file', type: blob.type || 'application/octet-stream', size: blob.size, createdAt: now(), ...extra };
  await db.files.put(rec);
  return rec.id;
}

export const getFile = (id: ID): Promise<FileRec | undefined> => db.files.get(id);

/* ---------- settings ---------- */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
