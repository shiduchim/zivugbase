/* The Inbox: everything captured waits here, exactly as it came, until you file it.
   Shares from other apps arrive through the service worker's queue (one entry per share). */
import { db } from '../db/db';
import type { ID, InboxItem, InboxSource } from '../db/types';
import { newId, now } from '../lib/ids';
import { prepareImage, isImage } from '../lib/images';
import { phoneKey } from '../lib/phone';

export interface IncomingFile { blob: Blob; name: string; type?: string }

/* Saves a file for the Inbox. Photos are cleaned (location removed); everything else is kept as is. */
async function storeFile(f: IncomingFile, at: number): Promise<ID> {
  const type = f.type || f.blob.type || 'application/octet-stream';
  const id = newId();
  if (isImage(type)) {
    const { blob, thumb } = await prepareImage(f.blob);
    await db.files.put({ id, blob, name: f.name || 'photo', type: blob.type || type, size: blob.size, createdAt: at, ...(thumb ? { thumb } : {}) });
  } else {
    await db.files.put({ id, blob: f.blob, name: f.name || 'file', type, size: f.blob.size, createdAt: at });
  }
  return id;
}

export async function addToInbox(source: InboxSource, text: string, files: IncomingFile[] = [], extra: Partial<InboxItem> = {}): Promise<InboxItem> {
  const at = extra.receivedAt ?? now();
  const fileIds: ID[] = [];
  for (const f of files) fileIds.push(await storeFile(f, at));
  const item: InboxItem = { id: newId(), receivedAt: at, source, text, fileIds, level: 'received', ...extra };
  await db.inbox.put(item);
  return item;
}

/* ---------- the share queue written by the service worker ---------- */

interface QueuedShare { receivedAt: number; title: string; text: string; url: string; files: { name: string; type: string; blob: Blob }[] }

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('zivugbase-incoming', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readQueue(q: IDBDatabase): Promise<{ key: IDBValidKey; value: QueuedShare }[]> {
  return new Promise((resolve, reject) => {
    const out: { key: IDBValidKey; value: QueuedShare }[] = [];
    const req = q.transaction('queue', 'readonly').objectStore('queue').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(out);
      out.push({ key: c.key, value: c.value as QueuedShare });
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

function removeFromQueue(q: IDBDatabase, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = q.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let draining: Promise<number> | undefined;

/* Moves every waiting share into the Inbox. Each is written to the Inbox first and only then
   removed from the queue, so a crash in between can never lose one (and never files one twice). */
export function drainIncoming(): Promise<number> {
  draining ??= (async () => {
    let moved = 0;
    const q = await openQueue();
    try {
      for (const { key, value } of await readQueue(q)) {
        const ref = `q:${String(key)}:${value.receivedAt}`;
        const already = await db.inbox.where('queueRef').equals(ref).count();
        if (!already) {
          const text = [value.text, value.url && !value.text.includes(value.url) ? value.url : ''].filter(Boolean).join('\n');
          await addToInbox('share', text, value.files.map((f) => ({ blob: f.blob, name: f.name, type: f.type })), {
            receivedAt: value.receivedAt || now(),
            queueRef: ref,
            ...(value.title ? { title: value.title } : {}),
            ...(value.url ? { url: value.url } : {})
          });
          moved++;
        }
        await removeFromQueue(q, key);
      }
    } finally {
      q.close();
    }
    return moved;
  })().finally(() => { draining = undefined; });
  return draining;
}

export async function waitingCount(): Promise<number> {
  return db.inbox.where('level').anyOf('received', 'understood').count();
}

/* ---------- small, safe helpers for pre-filling a new person (always shown before saving) ---------- */

/* Phone numbers written in a text, each once. */
export function phonesInText(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of String(text ?? '').matchAll(/(?:\+|\b)\d[\d\s\-().]{6,}\d\b/g)) {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 13) continue;
    const k = phoneKey(raw);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(raw);
  }
  return out;
}

export function emailsInText(text: string): string[] {
  return [...new Set(String(text ?? '').match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [])];
}

/* Contact cards (.vcf): the name and numbers of each card. */
export function readVcards(text: string): { name: string; phones: { number: string; waid?: string }[]; emails: string[] }[] {
  const cards: { name: string; phones: { number: string; waid?: string }[]; emails: string[] }[] = [];
  const unfolded = String(text ?? '').replace(/\r?\n[ \t]/g, '');
  for (const block of unfolded.split(/BEGIN:VCARD/i).slice(1)) {
    const lines = block.split(/\r?\n/);
    const card = { name: '', phones: [] as { number: string; waid?: string }[], emails: [] as string[] };
    for (const line of lines) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const head = line.slice(0, i).toUpperCase();
      const value = line.slice(i + 1).trim();
      if (head === 'FN' || head.startsWith('FN;')) card.name = value;
      else if (!card.name && (head === 'N' || head.startsWith('N;'))) card.name = value.split(';').filter(Boolean).reverse().join(' ');
      else if (head.includes('TEL')) {
        const waid = head.match(/WAID=(\d+)/)?.[1];
        card.phones.push({ number: value, ...(waid ? { waid } : {}) });
      } else if (head.includes('EMAIL')) card.emails.push(value);
    }
    if (card.name || card.phones.length) cards.push(card);
  }
  return cards;
}

export const SOURCE_LABEL: Record<InboxSource, string> = { share: 'Shared in', paste: 'Pasted', speak: 'Spoken', photo: 'Photo', import: 'Imported' };
