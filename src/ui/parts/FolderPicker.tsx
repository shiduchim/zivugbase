/* Filing people into folders — one person from their page, or several ticked in a list.
   Add to folder: tick any folders (a folder shows "partly" when only some of them are in it);
   nothing changes until Apply, and Apply can be undone.
   Move to: pick one folder; they are added there and taken out of the folder you are in.
   Folders are labels — taking someone out of a folder never deletes them. */
import { useMemo, useState } from 'preact/hooks';
import { allFolders, applyFolderChanges, createFolder, folderTree, ROOT_LABEL, rootKey, rootsOf, type Root } from '../../db/folders';
import type { ID, List, Person } from '../../db/types';
import { useLive } from '../../hooks';
import { showToast } from '../../state';
import { displayName } from '../describe';
import { Sheet } from './common';

type State = 'all' | 'some' | 'none';

export function FolderPicker({ people, onClose, onDone, moveFrom }: { people: Person[]; onClose: () => void; onDone?: () => void; moveFrom?: List }) {
  const folders = useLive(() => allFolders(), []);
  const roots = useMemo(() => [...new Set(people.flatMap(rootsOf))] as Root[], [people]);
  const ids = people.map((p) => p.id);
  const [want, setWant] = useState<Map<ID, boolean>>(new Map());
  const [target, setTarget] = useState<ID>();
  const [name, setName] = useState('');
  const [parent, setParent] = useState(rootKey(roots[0] ?? 'others'));
  const [find, setFind] = useState('');

  if (!folders) return null;
  const tree = folderTree(folders, roots).filter(({ f }) => !find.trim() || f.name.toLowerCase().includes(find.trim().toLowerCase()));
  const stateOf = (f: List): State => {
    const n = ids.filter((id) => f.memberIds.includes(id)).length;
    return n === 0 ? 'none' : n === ids.length ? 'all' : 'some';
  };
  const shown = (f: List): State => (want.has(f.id) ? (want.get(f.id) ? 'all' : 'none') : stateOf(f));
  const toggle = (f: List) => {
    const next = new Map(want);
    const now = shown(f);
    const v = now !== 'all';
    if ((v && stateOf(f) === 'all') || (!v && stateOf(f) === 'none')) next.delete(f.id); else next.set(f.id, v);
    setWant(next);
  };
  const who = people.length === 1 ? displayName(people[0]!) : `${people.length} people`;

  const make = async () => {
    if (!name.trim()) return;
    const f = await createFolder(name, parent);
    setName('');
    if (moveFrom) setTarget(f.id);
    else setWant(new Map(want).set(f.id, true));
  };

  const apply = async () => {
    if (moveFrom) {
      if (!target) return;
      const undo = await applyFolderChanges(ids, [target], target === moveFrom.id ? [] : [moveFrom.id]);
      const to = folders.find((f) => f.id === target)?.name ?? 'the folder';
      onClose();
      onDone?.();
      showToast(`Moved ${who} to ${to}.`, { label: 'Undo', run: undo });
      return;
    }
    const add = [...want].filter(([, v]) => v).map(([k]) => k);
    const remove = [...want].filter(([, v]) => !v).map(([k]) => k);
    if (!add.length && !remove.length) { onClose(); return; }
    const undo = await applyFolderChanges(ids, add, remove);
    onClose();
    onDone?.();
    const names = (list: ID[]) => list.map((id) => folders.find((f) => f.id === id)?.name).filter(Boolean).join(', ');
    showToast([add.length ? `Added ${who} to ${names(add)}` : '', remove.length ? `took out of ${names(remove)}` : ''].filter(Boolean).join('; ') + '.', { label: 'Undo', run: undo });
  };

  let lastRoot: Root | undefined;
  return (
    <Sheet title={moveFrom ? `Move ${who} to…` : `Add ${who} to folder…`} onClose={onClose}>
      {moveFrom && <p class="muted small" style="margin-top:0">They’ll be taken out of “{moveFrom.name}”.</p>}
      {tree.length > 8 && <input type="search" placeholder="Find a folder" aria-label="Find a folder" value={find} onInput={(e) => setFind(e.currentTarget.value)} style="margin-bottom:8px" />}
      <div class="ftree">
        {tree.length === 0 && <p class="muted small">No folders yet — make the first one below.</p>}
        {tree.map(({ f, depth, root }) => {
          const head = roots.length > 1 && root !== lastRoot;
          lastRoot = root;
          const s = shown(f);
          return (
            <div key={f.id}>
              {head && <div class="ftree-root">{ROOT_LABEL[root]}</div>}
              <button type="button" class={`ftree-row${moveFrom ? (target === f.id ? ' on' : '') : s !== 'none' ? ' on' : ''}`} style={`padding-inline-start:${10 + depth * 18}px`}
                role={moveFrom ? 'radio' : 'checkbox'} aria-checked={moveFrom ? target === f.id : s === 'all' ? true : s === 'some' ? 'mixed' : false}
                disabled={moveFrom?.id === f.id} onClick={() => (moveFrom ? setTarget(f.id) : toggle(f))}>
                <span class={`fbox ${moveFrom ? 'radio' : ''} ${moveFrom ? (target === f.id ? 'all' : 'none') : s}`} aria-hidden="true" />
                <span aria-hidden="true">📁</span>
                <span class="fname bidi">{f.name}</span>
                {!moveFrom && s === 'some' && <span class="fsome">some</span>}
                {moveFrom?.id === f.id && <span class="fsome">here now</span>}
              </button>
            </div>
          );
        })}
      </div>
      <div class="fnew">
        <input type="text" dir="auto" placeholder="New folder name" aria-label="New folder name" value={name} onInput={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') void make(); }} />
        <select aria-label="Inside" value={parent} onChange={(e) => setParent(e.currentTarget.value)}>
          {roots.map((r) => <option key={r} value={rootKey(r)}>in {ROOT_LABEL[r]}</option>)}
          {folderTree(folders, roots).map(({ f, depth }) => <option key={f.id} value={f.id}>in {'  '.repeat(depth)}{f.name}</option>)}
        </select>
        <button type="button" class="lb" disabled={!name.trim()} onClick={make}>New folder</button>
      </div>
      <div class="savebar static">
        <button type="button" class="primary" disabled={moveFrom ? !target || target === moveFrom.id : want.size === 0} onClick={apply}>{moveFrom ? 'Move here' : 'Apply'}</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
