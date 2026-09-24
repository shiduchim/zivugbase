/* Opening a backup file: a ZivugBase backup is restored (with Undo); a PeerMatch backup is
   imported (added to what's here). Everything is checked before anything changes. */
import { useEffect, useState } from 'preact/hooks';
import { buildBackup, identifyBackup, restoreZivugBase, type BackupKind } from '../../backup/backup';
import { importPeerMatch, readPeerMatchFile, type ImportResult, type PeerMatchBackup } from '../../import/peermatch';
import { db } from '../../db/db';
import { getSetting, setSetting } from '../../db/repo';
import type { Mode } from '../../db/types';
import { go, mode, reportError, showToast } from '../../state';
import { shortDate } from '../../lib/format';
import { plural } from '../../text';
import { Loading } from './common';

export async function protectStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

type Step =
  | { s: 'reading' }
  | { s: 'error'; message: string }
  | { s: 'restore'; b: Extract<BackupKind, { kind: 'zivugbase' }>; here: number }
  | { s: 'peermatch'; pm: PeerMatchBackup }
  | { s: 'working'; what: string }
  | { s: 'imported'; r: ImportResult };

export function BackupOpener({ file, onClose, onDone }: { file: Blob; onClose: () => void; onDone?: () => void | Promise<void> }) {
  const [step, setStep] = useState<Step>({ s: 'reading' });

  useEffect(() => {
    (async () => {
      try {
        const kind = await identifyBackup(file);
        if (kind.kind === 'zivugbase') setStep({ s: 'restore', b: kind, here: await db.people.filter((p) => !p.deletedAt && !p.roles.includes('me')).count() });
        else setStep({ s: 'peermatch', pm: await readPeerMatchFile(kind.blob) });
      } catch (e) {
        setStep({ s: 'error', message: e instanceof Error ? e.message : 'This file could not be read.' });
      }
    })();
  }, [file]);

  const restore = async (b: Extract<BackupKind, { kind: 'zivugbase' }>) => {
    setStep({ s: 'working', what: 'Restoring…' });
    try {
      const safety = await buildBackup();
      const counts = await restoreZivugBase(b);
      mode.value = await getSetting<Mode | null>('mode', mode.value ?? null);
      await protectStorage();
      await onDone?.();
      onClose();
      go('/home', { replace: true });
      showToast(`Restored ${plural(counts.people, 'person', 'people')}.`, {
        label: 'Undo',
        run: async () => {
          try {
            const previous = await identifyBackup(new Blob([safety.bytes as BlobPart]));
            if (previous.kind === 'zivugbase') await restoreZivugBase(previous);
            mode.value = await getSetting<Mode | null>('mode', mode.value ?? null);
            showToast('Put back what was on the phone before.');
          } catch (e) {
            reportError('Could not undo the restore.', e);
          }
        }
      });
    } catch (e) {
      setStep({ s: 'error', message: `The restore did not happen${e instanceof Error ? ` (${e.message})` : ''}.` });
    }
  };

  const importPm = async (pm: PeerMatchBackup) => {
    setStep({ s: 'working', what: 'Importing…' });
    try {
      const r = await importPeerMatch(pm);
      await protectStorage();
      if (r.review.length && mode.value !== 'helping') await setSetting('pendingReview', r.review);
      await onDone?.();
      setStep({ s: 'imported', r });
    } catch (e) {
      setStep({ s: 'error', message: `The import did not happen${e instanceof Error ? ` (${e.message})` : ''}.` });
    }
  };

  switch (step.s) {
    case 'reading':
    case 'working':
      return <Loading />;
    case 'error':
      return (
        <>
          <p class="notice bad">{step.message}</p>
          <p>Nothing on this phone was changed.</p>
          <button class="btn full" type="button" onClick={onClose}>Close</button>
        </>
      );
    case 'restore': {
      const c = step.b.manifest.counts;
      return (
        <>
          <p>This backup was made on <b>{shortDate(Date.parse(step.b.manifest.createdAt))}</b>:</p>
          <p>{plural(c.people, 'person', 'people')} · {plural(c.ideas, 'idea')} · {plural(c.activities, 'history entry', 'history entries')} · {plural(c.files, 'file')}</p>
          <p class="notice warn">Restoring replaces what is on this phone now ({plural(step.here, 'person', 'people')}). Right after, you can tap Undo to put it back.</p>
          <div class="btn-row">
            <button class="btn quiet" type="button" onClick={onClose}>Cancel</button>
            <button class="btn primary" type="button" onClick={() => restore(step.b)}>Restore</button>
          </div>
        </>
      );
    }
    case 'peermatch': {
      const s = step.pm.state;
      return (
        <>
          <p>A PeerMatch backup with {plural(s.shadchanim.length, 'shadchan', 'shadchanim')}, {plural(s.guys.length, 'guy')} and {plural(s.girls.length, 'girl')}.</p>
          <p class="muted">It is added to what's here — nothing already in ZivugBase changes. Importing the same backup again only adds what's new. PeerMatch itself is not touched.</p>
          <div class="btn-row">
            <button class="btn quiet" type="button" onClick={onClose}>Cancel</button>
            <button class="btn primary" type="button" onClick={() => importPm(step.pm)}>Import</button>
          </div>
        </>
      );
    }
    case 'imported': {
      const r = step.r;
      const added = r.shadchanim + r.singles + r.contacts;
      return (
        <>
          <p class="notice">Imported {plural(r.shadchanim, 'shadchan', 'shadchanim')}, {plural(r.singles, 'single')} and {plural(r.contacts, 'contact person', 'contact people')}, with {plural(r.activities, 'history entry', 'history entries')} and {plural(r.files, 'file')}.</p>
          {r.mergedCopies > 0 && <p class="muted small">{plural(r.mergedCopies, 'duplicate history copy', 'duplicate history copies')} from PeerMatch were joined into single entries.</p>}
          {r.alreadyThere > 0 && <p class="muted small">{plural(r.alreadyThere, 'record was', 'records were')} already here and left as they were.</p>}
          {added === 0 && <p>Nothing new to add.</p>}
          {r.review.length > 0 && mode.value !== 'helping'
            ? <button class="btn primary full" type="button" onClick={() => { onClose(); go('/import/review'); }}>Next: which girls were suggested to you?</button>
            : <button class="btn primary full" type="button" onClick={() => { onClose(); go('/people'); }}>See the people</button>}
        </>
      );
    }
  }
}

/* A button that picks a backup file and opens it in a sheet. */
export const BACKUP_ACCEPT = '.zip,.pdf,.txt,application/zip,application/pdf,text/plain,application/octet-stream';
