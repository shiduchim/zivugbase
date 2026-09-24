import { beforeEach, describe, expect, it } from 'vitest';
import { db, useDatabase } from '../../src/db/db';
import { allFolders, applyFolderChanges, createFolder, deleteFolder, folderPath, membersDeep, rootsOf, setMember } from '../../src/db/folders';
import { blankPerson, savePerson } from '../../src/db/repo';

let n = 0;
beforeEach(() => { useDatabase('test-folders-' + n++); });

describe('folders', () => {
  it('nests, counts people in sub-folders, and deleting a folder deletes no one', async () => {
    const p = await savePerson(blankPerson({ name: 'Made Up Shadchan', roles: ['shadchan'] }));
    const chabad = await createFolder('Chabad', 'root:shadchanim');
    const tzfat = await createFolder('Tzfat', chabad.id);
    await setMember(tzfat.id, p.id, true);
    const folders = await allFolders();
    expect(folderPath(tzfat.id, folders)).toBe('Shadchanim › Chabad › Tzfat');
    expect([...membersDeep(chabad.id, folders)]).toEqual([p.id]);

    const undo = await deleteFolder(chabad.id);
    const after = await allFolders();
    expect(after.map((f) => f.name)).toEqual(['Tzfat']);
    expect(after[0]!.parentId).toBe('root:shadchanim');
    expect(await db.people.get(p.id)).toBeTruthy();
    await undo();
    expect((await allFolders()).find((f) => f.name === 'Tzfat')!.parentId).toBe(chabad.id);
  });

  it('puts people under the right top folders', () => {
    expect(rootsOf(blankPerson({ roles: ['single'], gender: 'f', suggestedToMe: true }))).toEqual(['girls', 'ideas']);
    expect(rootsOf(blankPerson({ roles: ['contact'] }))).toEqual(['others']);
  });
});

describe('filing several people at once', () => {
  it('adds and removes in one go, and Undo puts every folder back', async () => {
    const a = await savePerson(blankPerson({ name: 'A', roles: ['shadchan'] }));
    const b = await savePerson(blankPerson({ name: 'B', roles: ['shadchan'] }));
    const x = await createFolder('X', 'root:shadchanim');
    const y = await createFolder('Y', 'root:shadchanim');
    await setMember(y.id, a.id, true);
    const undo = await applyFolderChanges([a.id, b.id], [x.id], [y.id]);
    expect((await db.lists.get(x.id))!.memberIds.sort()).toEqual([a.id, b.id].sort());
    expect((await db.lists.get(y.id))!.memberIds).toEqual([]);
    await undo();
    expect((await db.lists.get(x.id))!.memberIds).toEqual([]);
    expect((await db.lists.get(y.id))!.memberIds).toEqual([a.id]);
  });
});
