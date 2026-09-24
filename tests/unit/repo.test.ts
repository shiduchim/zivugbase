import { beforeEach, describe, expect, it } from 'vitest';
import { useDatabase } from '../../src/db/db';
import { addActivity, blankPerson, deleteForever, findByPhone, purgeTrash, recentlyDeleted, savePerson, softDeletePerson, timeline, saveFile } from '../../src/db/repo';
import { db } from '../../src/db/db';

let n = 0;
beforeEach(() => { useDatabase('test-repo-' + n++); });

describe('people, timeline and deleting', () => {
  it('finds a person by any spelling of their number', async () => {
    await savePerson(blankPerson({ name: 'Made Up Shadchan', roles: ['shadchan'], phones: [{ number: '050-000-0012', type: '' }] }));
    expect((await findByPhone('+972 50 000 0012')).map((p) => p.name)).toEqual(['Made Up Shadchan']);
  });

  it('shows one timeline entry in every linked person, and deletes it once', async () => {
    const a = await savePerson(blankPerson({ name: 'A' }));
    const b = await savePerson(blankPerson({ name: 'B' }));
    await addActivity('profile-sent', 'Sent A to B', [a.id, b.id]);
    expect((await timeline(a.id)).length).toBe(1);
    expect((await timeline(b.id)).length).toBe(1);
    await deleteForever(a.id);
    const left = await timeline(b.id);
    expect(left.length).toBe(1);
    expect(left[0]!.linkKeys).toEqual(['p:' + b.id]);
  });

  it('undoes a delete, keeps deleted people 30 days, then purges them with their files', async () => {
    const fileId = await saveFile(new Blob(['x'], { type: 'text/plain' }), 'x.txt');
    const p = await savePerson(blankPerson({ name: 'C', resumeFileIds: [fileId] }));
    const undo = await softDeletePerson(p.id);
    expect((await recentlyDeleted()).length).toBe(1);
    await undo();
    expect((await recentlyDeleted()).length).toBe(0);
    await softDeletePerson(p.id);
    expect(await purgeTrash(Date.now() + 29 * 86400000)).toBe(0);
    expect(await purgeTrash(Date.now() + 31 * 86400000)).toBe(1);
    expect(await db.people.get(p.id)).toBeUndefined();
    expect(await db.files.get(fileId)).toBeUndefined();
  });
});
