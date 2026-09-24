/* Filing one captured item in one step: "an idea for me", "for a friend", "a shadchan's contact".
   The original text and files are kept on the timeline; the person is created with what the
   owner checked on screen — nothing extracted is saved without that tap. */
import { db } from '../db/db';
import { addActivity, blankPerson, ensureMe, savePerson } from '../db/repo';
import type { Gender, ID, InboxItem, Person, Phone } from '../db/types';
import { isImage, isPdfType } from '../lib/images';
import { newId, now } from '../lib/ids';
import { phoneKey, phoneType } from '../lib/phone';
import { cityGroups, norm } from '../lib/search';
import { ageFromText } from '../lib/age';
import { phonesInText } from './inbox';

export type FileKind = 'idea' | 'friend' | 'shadchan';

export interface Guess { name: string; age: string; phones: string[]; city: string; senderId?: ID }

/* A careful first guess from the text: the first short line without digits as a name, an
   age written as an age, phone numbers. Always shown for checking before saving. */
export function guessFromText(text: string, people: Person[] = []): Guess {
  /* Copying several WhatsApp messages adds "[date, time] Sender: " before each; drop it. */
  const lines = String(text ?? '').split(/\r?\n/)
    .map((l) => l.replace(/^\[[^\]]*\]\s*[^:]{1,40}:\s*/, '').replace(/[*_~]/g, '').trim())
    .filter(Boolean);
  const head = (lines[0] ?? '').split(/[,|–—]| - /)[0]!.replace(/^(?:name|שם|имя)\s*[:\-–]\s*/i, '').replace(/[.:;!]+$/, '').trim();
  const greeting = /^(?:hi|hello|hey|shalom|good|here|i have|this is|שלום|היי|привет)\b/i.test(head);
  const name = head.length <= 40 && !/\d/.test(head) && head.split(/\s+/).length <= 4 && !greeting ? head : '';
  const age = ageFromText(text);
  /* The city written earliest in the text. */
  const hay = ' ' + norm(text) + ' ';
  let city = '';
  let at = Infinity;
  for (const g of cityGroups(people)) for (const re of g.res) {
    const m = re.exec(hay);
    if (m && m.index < at) { at = m.index; city = g.label; }
  }
  /* Who sent it: only when the copied text itself names the sender, and that name is known. */
  const senders = new Map<string, number>();
  for (const m of String(text ?? '').matchAll(/^\[[^\]]*\]\s*([^:\n]{1,40}):/gm)) senders.set(norm(m[1]!), (senders.get(norm(m[1]!)) ?? 0) + 1);
  const live = people.filter((p) => !p.deletedAt && !p.roles.includes('me'));
  const senderId = [...senders.entries()].sort((a, b) => b[1] - a[1])
    .map(([n]) => live.find((p) => norm(p.name) === n || p.altNames.some((a) => norm(a) === n))?.id)
    .find(Boolean);
  return { name, age: age ? String(age) : '', phones: phonesInText(text).slice(0, 3), city, ...(senderId ? { senderId } : {}) };
}

export interface FileInput {
  kind: FileKind;
  name: string;
  age: string;
  gender: Gender;
  city: string;
  phones: string[];
  senderId?: ID;
}

/* People who might be the same one: same phone, or the same name. */
export async function possibleSame(name: string, phones: string[], exceptId?: ID): Promise<Person[]> {
  const keys = new Set(phones.map(phoneKey).filter(Boolean));
  const n = norm(name);
  if (!keys.size && n.length < 3) return [];
  return (await db.people.toArray()).filter((p) => !p.deletedAt && p.id !== exceptId && !p.roles.includes('me') && (p.phoneKeys.some((k) => keys.has(k)) || (n.length >= 3 && norm(p.name) === n)));
}

export async function fileItem(item: InboxItem, input: FileInput): Promise<Person> {
  const files = (await db.files.bulkGet(item.fileIds)).filter((f) => !!f);
  const pdfs = files.filter((f) => isPdfType(f!.type, f!.name)).map((f) => f!.id);
  const images = files.filter((f) => isImage(f!.type)).map((f) => f!.id);
  const text = [item.title, item.text].filter(Boolean).join('\n').trim();
  const phones: Phone[] = input.phones.map((n) => n.trim()).filter(Boolean).map((n) => ({ number: n, type: phoneType(n) }));
  const t = now();
  const sender = input.senderId ? { kind: 'referred' as const, personId: input.senderId, date: item.receivedAt } : undefined;

  let p: Person;
  if (input.kind === 'shadchan') {
    p = blankPerson({ roles: ['shadchan'], name: input.name.trim(), city: input.city.trim(), phones, notes: text, resumeFileIds: [...pdfs, ...images], ...(sender ? { cameFrom: sender } : {}) });
  } else {
    p = blankPerson({
      roles: ['single'], gender: input.gender, name: input.name.trim(), city: input.city.trim(), phones,
      profile: { text, updatedAt: t }, resumeFileIds: pdfs, photoFileIds: images,
      suggestedToMe: input.kind === 'idea', ...(sender ? { cameFrom: sender } : {})
    });
  }
  const age = Number(input.age);
  if (age >= 16 && age <= 120) p.age = { value: Math.floor(age), asOf: item.receivedAt };

  await db.transaction('rw', [db.people, db.ideas, db.activities, db.inbox], async () => {
    await savePerson(p);
    if (input.kind === 'idea') {
      const me = await ensureMe();
      await db.ideas.put({
        id: newId(), aId: me.id, bId: p.id, status: 'new', answers: {}, notes: '', createdAt: item.receivedAt, updatedAt: t,
        suggestedBy: input.senderId ? [{ personId: input.senderId, at: item.receivedAt }] : []
      });
    }
    await addActivity(input.kind === 'shadchan' ? 'message-in' : 'profile-received', text, [p.id, ...(input.senderId ? [input.senderId] : [])], {
      title: input.kind === 'shadchan' ? 'Contact received' : 'Profile received',
      at: item.receivedAt,
      ...(item.fileIds.length ? { fileIds: item.fileIds } : {}),
      meta: { inboxId: item.id }
    });
    await db.inbox.update(item.id, { level: 'filed', filedAs: { kind: 'person', id: p.id, personId: p.id } });
  });
  return p;
}

/* The answer to an idea for me. */
export async function answerIdea(ideaId: ID, answer: 'yes' | 'no'): Promise<() => Promise<void>> {
  const before = await db.ideas.get(ideaId);
  if (!before) return async () => undefined;
  const t = now();
  await db.ideas.update(ideaId, { status: answer, updatedAt: t, answers: { ...before.answers, a: { answer, at: t } } });
  return async () => { await db.ideas.put(before); };
}
