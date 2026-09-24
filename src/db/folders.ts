/* Folders (docs/REBUILD_PLAN.md): nested, any depth, a person can be in several. Stored in the
   existing `lists` table, so backups already carry them. */
import { db } from './db';
import type { ID, List, Person } from './types';
import { newId, now } from '../lib/ids';

export type Root = 'guys' | 'girls' | 'shadchanim' | 'ideas' | 'others';
export const ROOT_LABEL: Record<Root, string> = { guys: 'Guys', girls: 'Girls', shadchanim: 'Shadchanim', ideas: 'Ideas for me', others: 'Other people' };
export const rootKey = (r: Root): string => 'root:' + r;

/* Which built-in top folders a person belongs to (they can be in more than one). */
export function rootsOf(p: Person): Root[] {
  const out: Root[] = [];
  if (p.roles.includes('single') && p.gender === 'm') out.push('guys');
  if (p.roles.includes('single') && p.gender === 'f') out.push('girls');
  if (p.suggestedToMe) out.push('ideas');
  if (p.roles.includes('shadchan')) out.push('shadchanim');
  if (!out.length) out.push('others');
  return out;
}

export async function allFolders(): Promise<List[]> {
  return (await db.lists.toArray()).filter((l) => l.kind === 'folder').sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function createFolder(name: string, parentId: string): Promise<List> {
  const f: List = { id: newId(), name: name.trim(), kind: 'folder', parentId, memberIds: [], createdAt: now() };
  await db.lists.put(f);
  return f;
}

export async function renameFolder(id: ID, name: string): Promise<void> {
  await db.lists.update(id, { name: name.trim() });
}

/* Its sub-folders move up one level; the people in it stay where else they are. */
export async function deleteFolder(id: ID): Promise<() => Promise<void>> {
  const f = await db.lists.get(id);
  if (!f) return async () => undefined;
  const children = (await allFolders()).filter((c) => c.parentId === id);
  await db.transaction('rw', db.lists, async () => {
    for (const c of children) await db.lists.update(c.id, { parentId: f.parentId ?? 'root:others' });
    await db.lists.delete(id);
  });
  return async () => {
    await db.transaction('rw', db.lists, async () => {
      await db.lists.put(f);
      for (const c of children) await db.lists.update(c.id, { parentId: id });
    });
  };
}

export async function setMember(folderId: ID, personId: ID, inside: boolean): Promise<void> {
  const f = await db.lists.get(folderId);
  if (!f) return;
  const has = f.memberIds.includes(personId);
  if (inside && !has) await db.lists.update(folderId, { memberIds: [...f.memberIds, personId] });
  if (!inside && has) await db.lists.update(folderId, { memberIds: f.memberIds.filter((x) => x !== personId) });
}

/* Everyone in a folder, including its sub-folders. */
export function membersDeep(folderId: ID, folders: List[]): Set<ID> {
  const out = new Set<ID>();
  const walk = (id: ID) => {
    const f = folders.find((x) => x.id === id);
    f?.memberIds.forEach((m) => out.add(m));
    folders.filter((c) => c.parentId === id).forEach((c) => walk(c.id));
  };
  walk(folderId);
  return out;
}

export function folderPath(id: ID, folders: List[]): string {
  const names: string[] = [];
  let cur = folders.find((x) => x.id === id);
  let guard = 0;
  while (cur && guard++ < 30) {
    names.unshift(cur.name);
    const parent = cur.parentId ?? '';
    if (parent.startsWith('root:')) { names.unshift(ROOT_LABEL[parent.slice(5) as Root] ?? ''); break; }
    cur = folders.find((x) => x.id === parent);
  }
  return names.filter(Boolean).join(' › ');
}

/* Several people into / out of several folders at once. Returns Undo (puts every touched
   folder's member list back exactly as it was). */
export async function applyFolderChanges(ids: ID[], add: ID[], remove: ID[]): Promise<() => Promise<void>> {
  const touched = [...new Set([...add, ...remove])];
  const before = (await db.lists.bulkGet(touched)).filter((l): l is List => !!l).map((l) => ({ id: l.id, memberIds: [...l.memberIds] }));
  await db.transaction('rw', db.lists, async () => {
    for (const f of before) {
      let m = new Set(f.memberIds);
      if (add.includes(f.id)) ids.forEach((id) => m.add(id));
      if (remove.includes(f.id)) m = new Set([...m].filter((x) => !ids.includes(x)));
      await db.lists.update(f.id, { memberIds: [...m] });
    }
  });
  return async () => {
    await db.transaction('rw', db.lists, async () => {
      for (const f of before) await db.lists.update(f.id, { memberIds: f.memberIds });
    });
  };
}

/* Folders in tree order (parent before children) with their depth, under the given top folders. */
export function folderTree(folders: List[], roots: Root[]): { f: List; depth: number; root: Root }[] {
  const out: { f: List; depth: number; root: Root }[] = [];
  const walk = (parent: string, depth: number, root: Root) => {
    for (const f of folders.filter((x) => x.parentId === parent)) {
      out.push({ f, depth, root });
      if (depth < 30) walk(f.id, depth + 1, root);
    }
  };
  for (const r of roots) walk(rootKey(r), 0, r);
  return out;
}
