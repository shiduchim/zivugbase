/* Imports a PeerMatch backup (the .zip, or the emailed .txt wrapper) into ZivugBase.
   - All or nothing: one database transaction.
   - Repeatable: records already imported are recognised (legacyKey) and left as they are.
   - Nothing is invented: times come from PeerMatch's own ids/timestamps; unknown stays unknown.
   - Every imported person keeps an untouched copy of the original PeerMatch record.
   - PeerMatch stored one event as two or three copies (profile + shadchan, or guy + girl +
     shadchan for Make Match). Those copies become ONE timeline entry linked to everyone. */
import { unzipSync, strFromU8 } from 'fflate';
import { db } from '../db/db';
import { blankPerson, keysFor } from '../db/repo';
import type { Activity, ActivityKind, CameFrom, FileRec, ID, Idea, Person, Phone } from '../db/types';
import { newId } from '../lib/ids';
import { phoneKey, phoneType } from '../lib/phone';

const TEXT_HEADER = 'PEERMATCH-BACKUP-TEXT-V1';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
interface FileRef { __peerMatchFile: 1; path: string; type?: string; name?: string; lastModified?: number }
const isRef = (v: unknown): v is FileRef => !!v && typeof v === 'object' && (v as FileRef).__peerMatchFile === 1;

export interface PeerMatchBackup {
  createdAt?: string;
  counts?: Record<string, number>;
  state: { shadchanim: Json[]; guys: Json[]; girls: Json[] };
  files: Record<string, Uint8Array>;
}

/* ---------- reading the file ---------- */

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  const chunks: Uint8Array[] = [];
  const size = 0x100000; /* divisible by 4 → every chunk ends on whole base64 quartets */
  let total = 0;
  for (let i = 0; i < clean.length; i += size) {
    const bin = atob(clean.slice(i, i + size));
    const out = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) out[j] = bin.charCodeAt(j);
    chunks.push(out);
    total += out.length;
  }
  const all = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) { all.set(c, p); p += c.length; }
  return all;
}

/* True for a PeerMatch backup (.zip, or the emailed .txt wrapper). */
export function looksLikePeerMatch(bytes: Uint8Array): boolean {
  if (strFromU8(bytes.subarray(0, 64)).startsWith(TEXT_HEADER)) return true;
  try {
    const data = unzipSync(bytes, { filter: (f) => f.name === 'data.json' })['data.json'];
    return !!data && strFromU8(data.subarray(0, 400)).includes('PeerMatchBackup');
  } catch {
    return false;
  }
}

export async function readPeerMatchFile(file: Blob): Promise<PeerMatchBackup> {
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  const head = strFromU8(bytes.subarray(0, 64));
  if (head.startsWith(TEXT_HEADER)) bytes = base64ToBytes(strFromU8(bytes).slice(TEXT_HEADER.length));
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { throw new Error('This file is not a PeerMatch backup (it could not be opened as one).'); }
  const dataJson = files['data.json'];
  if (!dataJson) throw new Error('This file has no PeerMatch data in it.');
  const manifest = JSON.parse(strFromU8(dataJson));
  if (manifest?.format !== 'PeerMatchBackup') throw new Error('This is not a PeerMatch backup.');
  const kv: Json[] = manifest.stores?.kv ?? [];
  const stateEntry = kv.find((e) => e?.key === 'state');
  const state = decodeDates(stateEntry?.value ?? {});
  return {
    createdAt: manifest.createdAt,
    counts: manifest.counts,
    state: {
      shadchanim: Array.isArray(state.shadchanim) ? state.shadchanim : [],
      guys: Array.isArray(state.guys) ? state.guys : [],
      girls: Array.isArray(state.girls) ? state.girls : []
    },
    files
  };
}

function decodeDates(v: Json): Json {
  if (Array.isArray(v)) return v.map(decodeDates);
  if (v && typeof v === 'object') {
    if (v.__peerMatchDate) return v.value;
    if (isRef(v)) return v;
    const out: Json = {};
    for (const [k, val] of Object.entries(v)) out[k] = decodeDates(val);
    return out;
  }
  return v;
}

/* ---------- small helpers ---------- */

const str = (v: unknown): string => (v == null ? '' : String(v)).trim();

function idTime(id: unknown): number | undefined {
  const n = Number(id);
  if (!Number.isFinite(n)) return undefined;
  if (n > 1e14 && n < 1e17) return Math.floor(n / 1000); /* PeerMatch share ids: Date.now()*1000 + seq */
  if (n > 1e11 && n < 1e14) return n;                      /* Date.now() */
  return undefined;
}

function parseTime(v: unknown): number | undefined {
  if (!v) return undefined;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : undefined;
}

function recordCreated(x: Json): number | undefined {
  return parseTime(x.createdAt) ?? idTime(x.id);
}

function activityTime(a: Json): number | undefined {
  return idTime(a.id) ?? parseTime(a.ts);
}

const splitTags = (s: unknown): string[] => str(s).split(/[,;]+/).map((t) => t.trim()).filter(Boolean);

const FACT_KEYS = ['religiousLevel', 'religiousDetails', 'divorced', 'withKids', 'kosherForKohen', 'baalTeshuvah', 'watchesMovies', 'prays3Daily', 'smokes', 'langEnglish', 'langHebrew', 'langRussian', 'bodyType', 'talkedPhone', 'talkedInPerson', 'shareEnglish', 'shareHebrew', 'shareRussian'];

function kindOf(a: Json): { kind: ActivityKind; channel?: string } {
  const action = str(a.action).toLowerCase();
  switch (a.type) {
    case 'text': return { kind: 'note' };
    case 'audio': return { kind: 'audio' };
    case 'wa-out': return { kind: 'message-out', channel: 'whatsapp' };
    case 'wa-in': return { kind: 'message-in', channel: 'whatsapp' };
    case 'sms-out': return { kind: 'message-out', channel: 'sms' };
    case 'email-out': return { kind: 'message-out', channel: 'email' };
    case 'call-note': return { kind: 'call-note', channel: 'phone' };
  }
  const channel = /whatsapp/.test(action) ? 'whatsapp' : /sms/.test(action) ? 'sms' : /email/.test(action) ? 'email' : /call/.test(action) ? 'phone' : undefined;
  if (/profile (sent|shared)/.test(action)) return { kind: 'profile-sent', channel };
  if (/profile received/.test(action)) return { kind: 'profile-received', channel };
  if (/reply received/.test(action)) return { kind: 'message-in', channel };
  if (/^call\b/.test(action)) return { kind: 'call', channel: 'phone' };
  return { kind: 'action', channel };
}

/* ---------- the import ---------- */

export interface ReviewRow { personId: ID; name: string; age?: number; preTicked: boolean; reason: string }
export interface ImportResult {
  shadchanim: number;
  singles: number;
  contacts: number;
  activities: number;
  mergedCopies: number;
  ideas: number;
  files: number;
  alreadyThere: number;
  review: ReviewRow[];
}

type Coll = 'shadchanim' | 'guys' | 'girls';
interface Node { coll: Coll; rec: Json; act: Json; key: string }

export async function importPeerMatch(backup: PeerMatchBackup, at = Date.now()): Promise<ImportResult> {
  const result: ImportResult = { shadchanim: 0, singles: 0, contacts: 0, activities: 0, mergedCopies: 0, ideas: 0, files: 0, alreadyThere: 0, review: [] };

  /* Existing state, so a repeated import only adds what's new. */
  const existingPeople = await db.people.toArray();
  const byLegacy = new Map(existingPeople.filter((p) => p.legacyKey).map((p) => [p.legacyKey!, p]));
  const byPhone = new Map<string, Person>();
  for (const p of existingPeople) if (!p.deletedAt) for (const k of p.phoneKeys) if (!byPhone.has(k)) byPhone.set(k, p);
  const existingActs = new Set((await db.activities.toArray()).map((a) => a.legacyKey).filter(Boolean) as string[]);
  const existingIdeas = new Set((await db.ideas.toArray()).map((i) => i.legacyKey).filter(Boolean) as string[]);

  const newPeople: Person[] = [];
  const newFiles: FileRec[] = [];
  const newActs: Activity[] = [];
  const newIdeas: Idea[] = [];
  const fileByPath = new Map<string, ID>();

  const fileId = (ref: unknown): ID | undefined => {
    if (!isRef(ref)) return undefined;
    const known = fileByPath.get(ref.path);
    if (known) return known;
    const bytes = backup.files[ref.path];
    if (!bytes) return undefined;
    const type = ref.type || 'application/octet-stream';
    const rec: FileRec = { id: newId(), blob: new Blob([bytes as BlobPart], { type }), name: ref.name || ref.path.split('/').pop() || 'file', type, size: bytes.length, createdAt: at };
    newFiles.push(rec);
    fileByPath.set(ref.path, rec.id);
    return rec.id;
  };

  const idMap: Record<Coll, Map<string, ID>> = { shadchanim: new Map(), guys: new Map(), girls: new Map() };
  const personOf = (coll: Coll, id: unknown): ID | undefined => idMap[coll].get(str(id));
  const addPerson = (p: Person): Person => {
    newPeople.push(p);
    for (const k of p.phoneKeys) if (!byPhone.has(k)) byPhone.set(k, p);
    return p;
  };

  /* 1. Shadchanim */
  for (const x of backup.state.shadchanim) {
    const legacyKey = `peermatch:shadchanim:${str(x.id)}`;
    const existing = byLegacy.get(legacyKey);
    if (existing) { idMap.shadchanim.set(str(x.id), existing.id); result.alreadyThere++; continue; }
    const phones: Phone[] = [x.phone, x.phone2].map(str).filter(Boolean).map((n) => ({ number: n, type: phoneType(n) }));
    const created = recordCreated(x);
    const p = blankPerson({
      roles: ['shadchan'], name: str(x.name) || 'Shadchan', phones, emails: [str(x.email)].filter(Boolean),
      tags: splitTags(x.tags), notes: '', createdAt: created ?? at, updatedAt: at,
      legacyKey, legacy: { source: 'peermatch', collection: 'shadchanim', record: x }
    });
    if (x.callReminderDate) { const due = parseTime(x.callReminderDate); if (due) p.nextStep = { what: 'Call', due }; }
    if (x.waitingForReply === true) p.waitingSince = parseTime(x.waitingForReplySince) ?? 0;
    const attach = fileId(x.profileAttachment);
    if (attach) p.resumeFileIds.push(attach);
    addPerson(p);
    idMap.shadchanim.set(str(x.id), p.id);
    result.shadchanim++;
  }
  /* referrals between shadchanim, now that every shadchan has an id */
  for (const x of backup.state.shadchanim) {
    const me = newPeople.find((p) => p.legacyKey === `peermatch:shadchanim:${str(x.id)}`);
    if (!me) continue;
    const ref = personOf('shadchanim', x.referredById) ??
      (x.referredBy ? newPeople.find((p) => p.roles.includes('shadchan') && p.name.toLowerCase() === str(x.referredBy).toLowerCase())?.id : undefined);
    if (ref && ref !== me.id) me.cameFrom = { kind: 'referred', personId: ref };
    else if (str(x.referredBy)) me.cameFrom = { kind: 'referred', note: str(x.referredBy) };
  }

  /* 2. Contact people behind the singles: reuse any person with the same phone number. */
  const contactFor = (name: string, phone: string, owner: string): ID | undefined => {
    const key = phoneKey(phone);
    if (key && byPhone.has(key)) return byPhone.get(key)!.id;
    if (!name && !phone) return undefined;
    const legacyKey = `peermatch:contact:${key || name.toLowerCase()}`;
    const existing = byLegacy.get(legacyKey) ?? newPeople.find((p) => p.legacyKey === legacyKey);
    if (existing) return existing.id;
    const p = blankPerson({ roles: ['contact'], name: name || `Contact for ${owner}`, phones: phone ? [{ number: phone, type: phoneType(phone) }] : [], createdAt: at, legacyKey });
    addPerson(p);
    result.contacts++;
    return p.id;
  };

  /* 3. Guys and girls */
  for (const coll of ['guys', 'girls'] as const) {
    for (const x of backup.state[coll]) {
      const legacyKey = `peermatch:${coll}:${str(x.id)}`;
      const existing = byLegacy.get(legacyKey);
      if (existing) { idMap[coll].set(str(x.id), existing.id); result.alreadyThere++; continue; }
      const name = str(x.name) || (coll === 'guys' ? 'Guy' : 'Girl');
      const created = recordCreated(x);
      const p = blankPerson({
        roles: ['single'], gender: coll === 'guys' ? 'm' : 'f', name,
        phones: [x.profilePhone].map(str).filter(Boolean).map((n) => ({ number: n, type: phoneType(n) })),
        profile: { text: str(x.text) },
        lookingFor: { text: str(x.lookingFor), ...(Number(x.lookingForMaxAge) ? { maxAge: Number(x.lookingForMaxAge) } : {}) },
        tags: splitTags(x.tags), createdAt: created ?? at, updatedAt: at,
        legacyKey, legacy: { source: 'peermatch', collection: coll, record: x }
      });
      const age = Number(x.age);
      if (age >= 18 && age <= 99) p.age = { value: age, asOf: created ?? at, estimated: true };
      for (const k of FACT_KEYS) if (x[k] !== undefined && x[k] !== '' && x[k] !== null) p.facts[k] = typeof x[k] === 'boolean' ? x[k] : str(x[k]);
      if (x.kohen === true) p.kohen = true;
      const photo = fileId(x.profileMediaFull ?? x.photo ?? x.profileMedia);
      if (photo) p.photoFileIds.push(photo);
      for (const r of [x.profileImage, x.profileAttachment]) { const f = fileId(r); if (f && !p.resumeFileIds.includes(f)) p.resumeFileIds.push(f); }
      const audio = fileId(x.profileAudio);
      if (audio) p.audioProfile = { fileId: audio, ...(str(x.profileAudioText) ? { transcript: str(x.profileAudioText) } : {}) };
      const notes = [str(x.phoneConversationNote) && `Talked by phone: ${str(x.phoneConversationNote)}`, str(x.inPersonConversationNote) && `Met in person: ${str(x.inPersonConversationNote)}`].filter(Boolean);
      p.notes = notes.join('\n');
      if (x.waitingForReply === true) p.waitingSince = parseTime(x.waitingForReplySince) ?? 0;

      /* who sent it / contact people */
      const sender = contactFor(str(x.sourceName || x.source), str(x.sourcePhone), name);
      if (sender) p.contactPeople.push({ personId: sender, relation: 'Sent by' });
      const sender2 = str(x.sourcePhone2) ? contactFor(str(x.sourceName2), str(x.sourcePhone2), name) : undefined;
      if (sender2 && sender2 !== sender) p.contactPeople.push({ personId: sender2, relation: 'Sent by' });
      for (const n of [1, 2]) {
        const c = contactFor(str(x[`contact${n}Name`]), str(x[`contact${n}Phone`]), name);
        if (c && !p.contactPeople.some((l) => l.personId === c)) p.contactPeople.push({ personId: c, relation: 'Contact' });
      }
      const shad = personOf('shadchanim', x.linkedShadchanId) ?? personOf('shadchanim', x.sourceShadchanId) ?? personOf('shadchanim', x.sourceShadchanId2);
      const cameFrom: CameFrom | undefined = shad ? { kind: 'referred', personId: shad } : sender ? { kind: 'referred', personId: sender } : undefined;
      if (cameFrom) p.cameFrom = cameFrom;
      p.phoneKeys = keysFor(p);
      addPerson(p);
      idMap[coll].set(str(x.id), p.id);
      result.singles++;
    }
  }

  /* 4. Timeline: group copies of the same event (union-find), then write one entry per group. */
  const nodes: Node[] = [];
  for (const coll of ['shadchanim', 'guys', 'girls'] as const) {
    for (const rec of backup.state[coll]) for (const act of Array.isArray(rec.activities) ? rec.activities : []) {
      nodes.push({ coll, rec, act, key: `${coll}:${str(rec.id)}:${str(act.id)}` });
    }
  }
  const parent = nodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
  const byGroupKey = new Map<string, number>();
  const byActId = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    for (const gk of [n.act.shareLinkId && 'share:' + n.act.shareLinkId, n.act.matchId && 'match:' + n.act.matchId].filter(Boolean) as string[]) {
      const first = byGroupKey.get(gk);
      if (first === undefined) byGroupKey.set(gk, i); else union(first, i);
    }
    const idKey = str(n.act.id);
    byActId.set(idKey, [...(byActId.get(idKey) ?? []), i]);
  });
  nodes.forEach((n, i) => {
    for (const src of [n.act.mirroredFromProfileActivityId, n.act.mirroredFromShadchanActivityId]) {
      if (src == null) continue;
      for (const j of byActId.get(str(src)) ?? []) if (nodes[j]!.coll !== n.coll) union(i, j);
    }
  });
  const groups = new Map<number, number[]>();
  nodes.forEach((_, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]); });

  for (const members of groups.values()) {
    const ns = members.map((i) => nodes[i]!);
    const primary = ns.find((n) => n.coll !== 'shadchanim') ?? ns[0]!;
    const a = primary.act;
    const groupKey = a.shareLinkId ? 'share:' + a.shareLinkId : a.matchId ? 'match:' + a.matchId : primary.key;
    const legacyKey = 'peermatch:act:' + groupKey;
    if (existingActs.has(legacyKey)) continue;
    const links = new Set<ID>();
    for (const n of ns) { const pid = personOf(n.coll, n.rec.id); if (pid) links.add(pid); }
    for (const n of ns) {
      const x = n.act;
      const shadRef = personOf('shadchanim', x.recipientShadchanId ?? x.shadchanId);
      if (shadRef) links.add(shadRef);
      if (x.sharedProfileId != null && (x.sharedProfileKind === 'guys' || x.sharedProfileKind === 'girls')) { const pr = personOf(x.sharedProfileKind, x.sharedProfileId); if (pr) links.add(pr); }
      if (x.guyId != null) { const g = personOf('guys', x.guyId); if (g) links.add(g); }
      if (x.girlId != null) { const g = personOf('girls', x.girlId); if (g) links.add(g); }
    }
    if (!links.size) continue;
    const { kind, channel } = kindOf(a);
    const when = ns.map((n) => activityTime(n.act)).find((t) => t !== undefined);
    const audioId = fileId(a.audio);
    const act: Activity = {
      id: newId(), at: when ?? 0, kind, text: str(a.text), linkKeys: [...links].map((id) => 'p:' + id), createdAt: at, legacyKey,
      ...(channel ? { channel } : {}),
      ...(str(a.action) ? { title: str(a.action) } : {}),
      ...(audioId ? { audioFileId: audioId } : {}),
      meta: { ...(when === undefined ? { dateUnknown: true } : {}), ...(a.answered !== undefined ? { answered: a.answered } : {}), ...(a.recipient ? { recipient: str(a.recipient) } : {}), ...(a.transcript ? { transcript: str(a.transcript) } : {}) }
    };
    newActs.push(act);
    result.activities++;
    result.mergedCopies += ns.length - 1;

    /* A Make Match becomes a real Idea between the guy and the girl. */
    if (a.matchId && a.guyId != null && a.girlId != null) {
      const ideaKey = 'peermatch:match:' + a.matchId;
      const g = personOf('guys', a.guyId), l = personOf('girls', a.girlId);
      if (g && l && !existingIdeas.has(ideaKey) && !newIdeas.some((i) => i.legacyKey === ideaKey)) {
        const s = personOf('shadchanim', a.shadchanId);
        newIdeas.push({ id: newId(), aId: g, bId: l, suggestedBy: [], status: 'sent', answers: {}, notes: s ? 'Sent through a shadchan (from PeerMatch).' : 'Suggested in PeerMatch.', createdAt: when ?? at, updatedAt: at, legacyKey: ideaKey });
        result.ideas++;
      }
    }
  }

  /* 5. Girls for the "was she suggested to me?" screen */
  for (const x of backup.state.girls) {
    const pid = personOf('girls', x.id);
    const p = newPeople.find((q) => q.id === pid);
    if (!p) continue;
    const fromShadchan = !!(x.linkedShadchanId ?? x.sourceShadchanId);
    const received = (x.activities ?? []).some((a: Json) => /received/i.test(str(a.action)) || a.type === 'wa-in');
    result.review.push({ personId: p.id, name: p.name, ...(p.age ? { age: p.age.value } : {}), preTicked: fromShadchan || received, reason: fromShadchan ? 'came from a shadchan' : received ? 'was received from someone' : '' });
  }

  result.files = newFiles.length;
  await db.transaction('rw', [db.people, db.files, db.activities, db.ideas], async () => {
    await db.files.bulkPut(newFiles);
    await db.people.bulkPut(newPeople);
    await db.activities.bulkPut(newActs);
    await db.ideas.bulkPut(newIdeas);
  });
  return result;
}

/* The "suggested to me" answers: each Yes marks her and records an Idea between her and me. */
export async function applySuggestedToMe(meId: ID, answers: { personId: ID; yes: boolean }[], at = Date.now()): Promise<number> {
  let made = 0;
  await db.transaction('rw', [db.people, db.ideas], async () => {
    for (const { personId, yes } of answers) {
      const p = await db.people.get(personId);
      if (!p) continue;
      await db.people.update(personId, { suggestedToMe: yes, updatedAt: at });
      const key = 'peermatch:offer:' + personId;
      const exists = await db.ideas.where('legacyKey').equals(key).first();
      if (yes && !exists) {
        await db.ideas.put({ id: newId(), aId: meId, bId: personId, suggestedBy: p.cameFrom?.personId ? [{ personId: p.cameFrom.personId }] : [], status: 'new', answers: {}, notes: '', createdAt: p.createdAt, updatedAt: at, legacyKey: key });
        made++;
      } else if (!yes && exists) {
        await db.ideas.delete(exists.id);
      }
    }
  });
  return made;
}
