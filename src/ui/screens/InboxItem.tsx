/* One Inbox item: the original exactly as it came, and one-tap ways to file it —
   New person · Add to someone · Dismiss. Nothing is saved to a person without a tap. */
import { useMemo, useState } from 'preact/hooks';
import { db } from '../../db/db';
import { addActivity, savePerson } from '../../db/repo';
import type { FileRec, ID, InboxItem, Person } from '../../db/types';
import { SOURCE_LABEL } from '../../inbox/inbox';
import { useLive } from '../../hooks';
import { dateTime } from '../../lib/format';
import { isImage, isPdfType } from '../../lib/images';
import { searchPeople } from '../../lib/search';
import { go, showToast, reportError } from '../../state';
import { Loading, PersonRow, Sheet, TopBar, YesNo } from '../parts/common';
import { FileList } from '../parts/Files';
import { BackupOpener } from '../parts/BackupOpener';
import { displayName } from '../describe';

const looksLikeBackup = (f: FileRec) => /\.zip$/i.test(f.name) || /zip/.test(f.type) || /backup/i.test(f.name);

function NewPersonSheet({ item, onClose }: { item: InboxItem; onClose: () => void }) {
  const choices: [string, string][] = [
    ['role=single&gender=f', 'A girl (single)'],
    ['role=single&gender=m', 'A guy (single)'],
    ['role=shadchan', 'A shadchan'],
    ['role=helper', 'A helper (coach, photographer, rabbi…)'],
    ['', 'Someone else']
  ];
  return (
    <Sheet title="Who is this?" onClose={onClose}>
      {choices.map(([q, label]) => (
        <button key={label} type="button" class="choice" onClick={() => go(`/person/new?from=${item.id}${q ? '&' + q : ''}`)}><b>{label}</b></button>
      ))}
      <p class="muted small">Next you’ll see the details filled in from this item — check them, then Save.</p>
    </Sheet>
  );
}

function AddToSomeoneSheet({ item, files, onClose }: { item: InboxItem; files: FileRec[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Person>();
  const all = useLive(() => db.people.toArray(), []);
  const live = useMemo(() => (all ?? []).filter((p) => !p.deletedAt && !p.roles.includes('me')), [all]);
  const results = useMemo(() => (q.trim() ? searchPeople(live, q).people : [...live].sort((a, b) => b.updatedAt - a.updatedAt)).slice(0, 30), [live, q]);

  const pdfs = files.filter((f) => isPdfType(f.type, f.name)).map((f) => f.id);
  const images = files.filter((f) => isImage(f.type)).map((f) => f.id);
  const text = [item.title, item.text].filter(Boolean).join('\n').trim();
  const [asResume, setAsResume] = useState<boolean>();
  const [asPhotos, setAsPhotos] = useState<boolean>();
  const [asProfile, setAsProfile] = useState<boolean>();

  const pick = (p: Person) => {
    setPicked(p);
    setAsResume(pdfs.length > 0 && p.resumeFileIds.length === 0);
    setAsPhotos(false);
    setAsProfile(p.roles.includes('single') && !!text && !p.profile.text.trim());
  };

  const save = async () => {
    if (!picked) return;
    try {
      const p = structuredClone((await db.people.get(picked.id)) ?? picked);
      const act = await addActivity('note', text, [p.id], {
        title: `${SOURCE_LABEL[item.source]} — from the Inbox`,
        at: item.receivedAt,
        ...(item.fileIds.length ? { fileIds: item.fileIds } : {}),
        meta: { inboxId: item.id }
      });
      let changed = false;
      if (asResume && pdfs.length) { p.resumeFileIds = [...new Set([...p.resumeFileIds, ...pdfs])]; changed = true; }
      if (asPhotos && images.length) { p.photoFileIds = [...new Set([...p.photoFileIds, ...images])]; changed = true; }
      if (asProfile && text) {
        if (p.profile.text.trim()) await addActivity('note', p.profile.text, [p.id], { title: 'Previous profile text (replaced from the Inbox)' });
        p.profile = { text, updatedAt: Date.now() };
        changed = true;
      }
      if (changed) await savePerson(p);
      await db.inbox.update(item.id, { level: 'filed', filedAs: { kind: 'note', id: act.id, personId: p.id } });
      onClose();
      go('/person/' + p.id, { replace: true });
      showToast(`Added to ${displayName(p)}.`);
    } catch (e) {
      reportError('Not filed. The item is still in the Inbox.', e);
    }
  };

  if (picked) {
    const single = picked.roles.includes('single');
    return (
      <Sheet title={`Add to ${displayName(picked)}`} onClose={onClose}>
        <p>It goes on {displayName(picked)}’s timeline{item.fileIds.length ? ', with its files' : ''}.</p>
        {pdfs.length > 0 && <div class="row" style="cursor:default"><span class="body">Also add the PDF as their resume?</span><YesNo value={asResume} onChange={(v) => setAsResume(!!v)} /></div>}
        {images.length > 0 && <div class="row" style="cursor:default"><span class="body">Also add the picture{images.length > 1 ? 's' : ''} to their photos?</span><YesNo value={asPhotos} onChange={(v) => setAsPhotos(!!v)} /></div>}
        {single && text && (
          <div class="row" style="cursor:default">
            <span class="body">Use this text as their profile?{picked.profile.text.trim() ? <span class="sub" style="display:block">The current profile is kept on the timeline.</span> : null}</span>
            <YesNo value={asProfile} onChange={(v) => setAsProfile(!!v)} />
          </div>
        )}
        <div class="btn-row" style="margin-top:12px">
          <button class="btn quiet" type="button" onClick={() => setPicked(undefined)}>Someone else</button>
          <button class="btn primary" type="button" onClick={save}>Add</button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title="Add to whom?" onClose={onClose}>
      <div class="search"><input type="search" placeholder="Search by name, city, phone…" value={q} onInput={(e) => setQ(e.currentTarget.value)} autoFocus /></div>
      {!all ? <Loading /> : results.length === 0 ? <p class="muted">No one found.</p> : results.map((p) => <PersonRow key={p.id} p={p} onClick={() => pick(p)} />)}
    </Sheet>
  );
}

export function InboxItemScreen({ id }: { id: ID }) {
  const item = useLive(async () => (await db.inbox.get(id)) ?? null, [id]);
  const files = useLive(async () => (item ? (await db.files.bulkGet(item.fileIds)).filter((f): f is FileRec => !!f) : []), [item?.fileIds.join(',')]);
  const filedTo = useLive(async () => (item?.filedAs?.personId ? (await db.people.get(item.filedAs.personId)) ?? null : null), [item?.filedAs?.personId]);
  const [sheet, setSheet] = useState<'new' | 'add' | 'backup' | null>(null);
  const [backupFile, setBackupFile] = useState<Blob>();

  if (item === undefined) return <><TopBar title="Inbox item" backTo="/inbox" /><main><Loading /></main></>;
  if (item === null) return <><TopBar title="Inbox item" backTo="/inbox" /><main><p>This item isn’t here any more.</p></main></>;

  const done = item.level === 'filed' || item.level === 'dismissed';
  const backupLike = (files ?? []).find(looksLikeBackup);

  const dismiss = async () => {
    const before = item.level;
    await db.inbox.update(item.id, { level: 'dismissed' });
    go('/inbox', { replace: true });
    showToast('Dismissed. It stays under “Filed and dismissed”.', { label: 'Undo', run: async () => { await db.inbox.update(item.id, { level: before }); } });
  };
  const putBack = async () => {
    await db.inbox.update(item.id, { level: 'received', filedAs: undefined });
    showToast('Back in the Inbox. What was already added to a person stays there.');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText([item.title, item.text].filter(Boolean).join('\n')); showToast('Copied.'); }
    catch { showToast('Copying isn’t allowed here — press and hold the text to select it.'); }
  };

  return (
    <>
      <TopBar title="Inbox item" backTo="/inbox" />
      <main>
        <p class="muted small" style="margin-top:0">{SOURCE_LABEL[item.source]} · {dateTime(item.receivedAt)}{item.sender ? ` · from ${item.sender}` : ''}</p>
        {done && (
          <p class="notice">
            {item.level === 'filed'
              ? <>Filed{filedTo ? <> to <a href={'#/person/' + filedTo.id} onClick={(e) => { e.preventDefault(); go('/person/' + filedTo.id); }}>{displayName(filedTo)}</a></> : ''}.</>
              : 'Dismissed.'}{' '}
            <button type="button" class="btn small quiet" onClick={putBack}>Put back in the Inbox</button>
          </p>
        )}
        {item.title && <h2 class="bidi" dir="auto" style="margin:8px 0">{item.title}</h2>}
        {item.text && <div class="card pre bidi" dir="auto">{item.text}</div>}
        {item.url && !item.text.includes(item.url) && <p><a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a></p>}
        {item.transcript && <div class="card pre bidi muted" dir="auto">{item.transcript}</div>}
        {item.fileIds.length > 0 && <div class="card"><FileList ids={item.fileIds} /></div>}
        {!item.text && !item.fileIds.length && <p class="muted">This item is empty.</p>}

        {backupLike && (
          <p class="notice">This looks like a backup file. <button class="btn small primary" type="button" onClick={() => { setBackupFile(backupLike.blob); setSheet('backup'); }}>Open it as a backup</button></p>
        )}

        {!done && (
          <div class="form-actions" style="flex-wrap:wrap">
            <button class="btn primary" type="button" onClick={() => setSheet('new')}>New person</button>
            <button class="btn" type="button" onClick={() => setSheet('add')}>Add to someone</button>
            <button class="btn quiet" type="button" onClick={dismiss}>Dismiss</button>
          </div>
        )}
        {item.text && <button class="btn small quiet" type="button" onClick={copy}>Copy the text</button>}
      </main>
      {sheet === 'new' && <NewPersonSheet item={item} onClose={() => setSheet(null)} />}
      {sheet === 'add' && files && <AddToSomeoneSheet item={item} files={files} onClose={() => setSheet(null)} />}
      {sheet === 'backup' && backupFile && (
        <Sheet title="Open a backup" onClose={() => setSheet(null)}>
          <BackupOpener file={backupFile} onClose={() => setSheet(null)} onDone={async () => { await db.inbox.update(item.id, { level: 'filed' }); }} />
        </Sheet>
      )}
    </>
  );
}
