/* ZivugBase backups.
   - "Save to phone": a real .zip (data + every photo, PDF and audio file).
   - "Email / Drive": the same zip inside a PDF (Android can share a PDF from a web app, not a zip).
   - Restore accepts either, checks EVERYTHING first, and only then replaces the data — in one
     transaction, so a damaged file leaves the phone exactly as it was.
   - PeerMatch backups are imported (merged), not restored over ZivugBase data. */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { db } from '../db/db';
import type { Activity, Draft, FileRec, Idea, InboxItem, List, Person, Setting } from '../db/types';
import { isPdf, makeBackupPdf, readBackupPdf } from './pdfContainer';
import { looksLikePeerMatch } from '../import/peermatch';

export const FORMAT = 'ZivugBaseBackup';
export const VERSION = 1;
export const EMAIL_LIMIT = 24 * 1024 * 1024; /* Gmail's 25 MB, with room for the email itself */

interface FileMeta { id: string; name: string; type: string; size: number; createdAt: number; path: string; thumbPath?: string; thumbType?: string }
interface Manifest {
  format: typeof FORMAT;
  version: number;
  createdAt: string;
  counts: { people: number; ideas: number; activities: number; files: number; inbox: number };
  tables: { people: Person[]; ideas: Idea[]; activities: Activity[]; inbox: InboxItem[]; lists: List[]; settings: Setting[]; drafts: Draft[] };
  files: FileMeta[];
}

export interface BackupFile { bytes: Uint8Array; name: string; counts: Manifest['counts']; createdAt: number }

const pad = (n: number) => String(n).padStart(2, '0');
const dayName = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function buildBackup(at = new Date()): Promise<BackupFile> {
  const [people, ideas, activities, inbox, lists, settings, drafts, files] = await Promise.all([
    db.people.toArray(), db.ideas.toArray(), db.activities.toArray(), db.inbox.toArray(),
    db.lists.toArray(), db.settings.toArray(), db.drafts.toArray(), db.files.toArray()
  ]);
  const zip: Zippable = {};
  const metas: FileMeta[] = [];
  for (const f of files) {
    const path = `files/${f.id}`;
    zip[path] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
    const meta: FileMeta = { id: f.id, name: f.name, type: f.type, size: f.size, createdAt: f.createdAt, path };
    if (f.thumb) { meta.thumbPath = `thumbs/${f.id}`; meta.thumbType = f.thumb.type; zip[meta.thumbPath] = [new Uint8Array(await f.thumb.arrayBuffer()), { level: 0 }]; }
    metas.push(meta);
  }
  const counts = { people: people.filter((p) => !p.deletedAt).length, ideas: ideas.length, activities: activities.length, files: files.length, inbox: inbox.length };
  const manifest: Manifest = {
    format: FORMAT, version: VERSION, createdAt: at.toISOString(), counts,
    tables: { people, ideas, activities, inbox, lists, settings: settings.filter((s) => s.key !== 'lastBackupAt'), drafts },
    files: metas
  };
  zip['zivugbase.json'] = [strToU8(JSON.stringify(manifest)), { level: 6 }];
  return { bytes: zipSync(zip), name: `ZivugBase_Backup_${dayName(at)}.zip`, counts, createdAt: at.getTime() };
}

export function backupAsPdf(b: BackupFile): { bytes: Uint8Array; name: string } {
  const when = new Date(b.createdAt);
  const name = b.name.replace(/\.zip$/, '.pdf');
  const bytes = makeBackupPdf(b.bytes, {
    title: 'ZivugBase backup',
    lines: [
      `Made on ${when.toDateString()}`,
      `${b.counts.people} people, ${b.counts.ideas} ideas, ${b.counts.activities} history entries, ${b.counts.files} files`,
      '',
      'Keep this file private. It contains everything in your ZivugBase.',
      'It is not password-protected.',
      '',
      'To restore: open ZivugBase, tap Settings, then Restore a backup, and choose this file.'
    ]
  }, b.name);
  return { bytes, name };
}

/* ---------- reading any backup file ---------- */

export type BackupKind =
  | { kind: 'zivugbase'; manifest: Manifest; files: Record<string, Uint8Array> }
  | { kind: 'peermatch'; blob: Blob };

export async function identifyBackup(file: Blob): Promise<BackupKind> {
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  if (isPdf(bytes)) {
    const inner = readBackupPdf(bytes);
    if (!inner) throw new Error('This PDF is not a ZivugBase backup.');
    bytes = inner;
  }
  if (looksLikePeerMatch(bytes)) return { kind: 'peermatch', blob: new Blob([bytes as BlobPart]) };
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { throw new Error('This file could not be opened as a backup.'); }
  const raw = files['zivugbase.json'];
  if (!raw) throw new Error('This file is not a ZivugBase or PeerMatch backup.');
  const manifest = JSON.parse(strFromU8(raw)) as Manifest;
  if (manifest.format !== FORMAT) throw new Error('This file is not a ZivugBase backup.');
  if (manifest.version > VERSION) throw new Error('This backup was made by a newer version of ZivugBase. Update the app, then try again.');
  for (const m of manifest.files) {
    if (!files[m.path]) throw new Error('The backup is incomplete: a file is missing inside it. Nothing was changed.');
    if (files[m.path]!.length !== m.size) throw new Error('The backup is damaged: a file inside it has the wrong size. Nothing was changed.');
  }
  return { kind: 'zivugbase', manifest, files };
}

/* Replaces everything on this phone with the backup. Checked first; all or nothing. */
export async function restoreZivugBase(b: Extract<BackupKind, { kind: 'zivugbase' }>): Promise<Manifest['counts']> {
  const fileRecs: FileRec[] = b.manifest.files.map((m) => ({
    id: m.id, name: m.name, type: m.type, size: m.size, createdAt: m.createdAt,
    blob: new Blob([b.files[m.path]! as BlobPart], { type: m.type }),
    ...(m.thumbPath && b.files[m.thumbPath] ? { thumb: new Blob([b.files[m.thumbPath]! as BlobPart], { type: m.thumbType ?? 'image/webp' }) } : {})
  }));
  const t = b.manifest.tables;
  await db.transaction('rw', [db.people, db.ideas, db.activities, db.inbox, db.files, db.lists, db.settings, db.drafts], async () => {
    const keepSettings = (await db.settings.toArray()).filter((s) => s.key === 'mode');
    await Promise.all([db.people.clear(), db.ideas.clear(), db.activities.clear(), db.inbox.clear(), db.files.clear(), db.lists.clear(), db.settings.clear(), db.drafts.clear()]);
    await db.files.bulkPut(fileRecs);
    await db.people.bulkPut(t.people);
    await db.ideas.bulkPut(t.ideas);
    await db.activities.bulkPut(t.activities);
    await db.inbox.bulkPut(t.inbox);
    await db.lists.bulkPut(t.lists);
    await db.drafts.bulkPut(t.drafts);
    await db.settings.bulkPut([...keepSettings.filter((k) => !t.settings.some((s) => s.key === k.key)), ...t.settings]);
    await db.settings.put({ key: 'lastBackupAt', value: Date.parse(b.manifest.createdAt) });
  });
  return b.manifest.counts;
}

/* ---------- reminders ---------- */

export async function markBackedUp(at = Date.now()): Promise<void> {
  await db.settings.put({ key: 'lastBackupAt', value: at });
}

export async function backupStatus(at = Date.now()): Promise<{ lastAt?: number; changedSince: boolean; overdue: boolean }> {
  const last = (await db.settings.get('lastBackupAt'))?.value as number | undefined;
  const changed = last === undefined
    ? (await db.people.count()) > 0
    : (await db.people.where('updatedAt').above(last).count()) + (await db.activities.filter((a) => a.createdAt > last).count()) > 0;
  const overdue = changed && (last === undefined || at - last > 7 * 86400000);
  return { ...(last !== undefined ? { lastAt: last } : {}), changedSince: changed, overdue };
}
