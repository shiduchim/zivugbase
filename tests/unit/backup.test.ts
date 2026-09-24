import { beforeEach, describe, expect, it } from 'vitest';
import { db, useDatabase } from '../../src/db/db';
import { addActivity, blankPerson, saveFile, savePerson } from '../../src/db/repo';
import { backupAsPdf, backupStatus, buildBackup, identifyBackup, markBackedUp, restoreZivugBase } from '../../src/backup/backup';
import { makeBackupPdf, readBackupPdf } from '../../src/backup/pdfContainer';
import { peerMatchTxt, peerMatchZip } from './peermatch-fixture';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

let n = 0;
beforeEach(() => { useDatabase('test-backup-' + n++); });

async function sample() {
  const photo = await saveFile(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }), 'p.jpg', { thumb: new Blob([new Uint8Array([9])], { type: 'image/webp' }) });
  const a = await savePerson(blankPerson({ name: 'Made Up One', roles: ['shadchan'], photoFileIds: [photo] }));
  const b = await savePerson(blankPerson({ name: 'Made Up Two', roles: ['single'], gender: 'f' }));
  await addActivity('note', 'A note that links both', [a.id, b.id]);
  return { a, b, photo };
}

describe('backup and restore', () => {
  it('restores exactly what was backed up, files included', async () => {
    const { a, photo } = await sample();
    const backup = await buildBackup();
    expect(backup.counts.people).toBe(2);
    await db.people.clear(); await db.files.clear(); await db.activities.clear();
    const found = await identifyBackup(new Blob([backup.bytes as BlobPart]));
    expect(found.kind).toBe('zivugbase');
    if (found.kind !== 'zivugbase') return;
    await restoreZivugBase(found);
    expect((await db.people.get(a.id))?.name).toBe('Made Up One');
    const f = await db.files.get(photo);
    expect(new Uint8Array(await f!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(new Uint8Array(await f!.thumb!.arrayBuffer())).toEqual(new Uint8Array([9]));
    expect((await db.activities.toArray())[0]!.linkKeys.length).toBe(2);
  });

  it('carries the backup inside a valid PDF that PDF readers open, and reads it back byte for byte', async () => {
    await sample();
    const backup = await buildBackup();
    const pdf = backupAsPdf(backup);
    expect(pdf.name).toMatch(/^ZivugBase_Backup_\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(readBackupPdf(pdf.bytes)).toEqual(backup.bytes);
    const doc = await pdfjs.getDocument({ data: pdf.bytes.slice() }).promise;
    expect(doc.numPages).toBe(1);
    const page = await doc.getPage(1);
    const text = (await page.getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join(' ');
    expect(text).toContain('ZivugBase backup');
    expect(text).toContain('To restore');
    /* PDF.js 6 lists attachments in a Map and returns their bytes through a separate call. */
    const attachments = (await doc.getAttachments()) as Map<string, { filename: string }>;
    const [id, att] = [...attachments.entries()][0]!;
    expect(att.filename).toBe(backup.name);
    const content = (await (doc as unknown as { getAttachmentContent(id: string): Promise<Uint8Array> }).getAttachmentContent(id));
    expect(new Uint8Array(content)).toEqual(backup.bytes);
  });

  it('restores from the PDF too', async () => {
    const { b } = await sample();
    const pdf = backupAsPdf(await buildBackup());
    await db.people.clear();
    const found = await identifyBackup(new Blob([pdf.bytes as BlobPart]));
    if (found.kind !== 'zivugbase') throw new Error('expected zivugbase');
    await restoreZivugBase(found);
    expect((await db.people.get(b.id))?.name).toBe('Made Up Two');
  });

  it('leaves everything untouched when a backup is damaged', async () => {
    await sample();
    const good = await buildBackup();
    const broken = good.bytes.slice(0, Math.floor(good.bytes.length / 2));
    await expect(identifyBackup(new Blob([broken as BlobPart]))).rejects.toThrow();
    expect(await db.people.count()).toBe(2);
    expect(() => makeBackupPdf(new Uint8Array([1]), { title: 't', lines: [] }, 'x.zip')).not.toThrow();
  });

  it('recognises PeerMatch backups (zip and email text) so they are imported, not restored over', async () => {
    expect((await identifyBackup(new Blob([peerMatchZip() as BlobPart]))).kind).toBe('peermatch');
    expect((await identifyBackup(new Blob([peerMatchTxt()]))).kind).toBe('peermatch');
  });

  it('knows when a backup is due', async () => {
    expect((await backupStatus()).changedSince).toBe(false);
    await sample();
    expect((await backupStatus()).overdue).toBe(true);
    await markBackedUp();
    expect((await backupStatus()).changedSince).toBe(false);
    expect((await backupStatus(Date.now() + 10 * 86400000)).overdue).toBe(false);
  });
});
