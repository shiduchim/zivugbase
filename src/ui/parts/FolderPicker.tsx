/* "Add to…": tick the folders this person belongs in, or make a new one right here.
   Folders are labels — unticking never deletes anyone. */
import { useState } from 'preact/hooks';
import { allFolders, createFolder, folderPath, ROOT_LABEL, rootKey, rootsOf, setMember, type Root } from '../../db/folders';
import type { List, Person } from '../../db/types';
import { useLive } from '../../hooks';
import { showToast } from '../../state';
import { Sheet } from './common';

export function FolderPicker({ p, onClose }: { p: Person; onClose: () => void }) {
  const folders = useLive(() => allFolders(), []);
  const roots = rootsOf(p);
  const [name, setName] = useState('');
  const [parent, setParent] = useState(rootKey(roots[0]!));

  if (!folders) return null;
  /* Only the folders under this person's own top folders (a guy's folders, a shadchan's…). */
  const underRoots = (f: List): boolean => {
    let cur: List | undefined = f;
    for (let i = 0; cur && i < 30; i++) {
      if (cur.parentId?.startsWith('root:')) return roots.includes(cur.parentId.slice(5) as Root);
      cur = folders.find((x) => x.id === cur!.parentId);
    }
    return false;
  };
  const mine = folders.filter(underRoots).sort((a, b) => folderPath(a.id, folders).localeCompare(folderPath(b.id, folders)));

  const make = async () => {
    if (!name.trim()) return;
    const f = await createFolder(name, parent);
    await setMember(f.id, p.id, true);
    setName('');
    showToast(`Added to ${f.name}.`);
  };

  return (
    <Sheet title="Add to…" onClose={onClose}>
      {mine.length === 0 && <p class="muted small" style="margin-top:0">No folders yet. Make the first one below.</p>}
      {mine.map((f) => (
        <label key={f.id} class="check" style="display:flex;margin:0 0 6px">
          <input type="checkbox" checked={f.memberIds.includes(p.id)} onChange={(e) => setMember(f.id, p.id, e.currentTarget.checked)} />
          <span class="bidi">{folderPath(f.id, folders)}</span>
        </label>
      ))}
      <div class="section-title" style="margin-top:14px">New folder</div>
      <div style="display:flex;gap:6px">
        <input type="text" dir="auto" placeholder="Folder name, e.g. Tzfat" value={name} onInput={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') void make(); }} />
        <button type="button" class="btn primary small" onClick={make}>Add</button>
      </div>
      <label class="field" style="margin-top:8px"><span>Inside</span>
        <select value={parent} onChange={(e) => setParent(e.currentTarget.value)}>
          {roots.map((r) => <option key={r} value={rootKey(r)}>{ROOT_LABEL[r]}</option>)}
          {mine.map((f) => <option key={f.id} value={f.id}>{folderPath(f.id, folders)}</option>)}
        </select>
      </label>
      <button type="button" class="btn full" style="margin-top:6px" onClick={onClose}>Done</button>
    </Sheet>
  );
}
