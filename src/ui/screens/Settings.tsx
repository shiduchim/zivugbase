/* Settings behind one button (PLAN §6.2): mode · backup · restore/import · storage · recently deleted. */
import { useEffect, useState } from 'preact/hooks';
import { backupAsPdf, backupStatus, buildBackup, EMAIL_LIMIT, markBackedUp } from '../../backup/backup';
import { db } from '../../db/db';
import { deleteForever, getSetting, recentlyDeleted, restorePerson, setSetting, TRASH_DAYS } from '../../db/repo';
import type { Mode } from '../../db/types';
import { useLive } from '../../hooks';
import { relativeDay, shortDate } from '../../lib/format';
import { mode, reportError, route, showToast } from '../../state';
import { MODE_LABEL, plural } from '../../text';
import { Loading, Sheet, TopBar } from '../parts/common';
import { BACKUP_ACCEPT, BackupOpener, protectStorage } from '../parts/BackupOpener';
import { chooseMode } from './FirstRun';
import { displayName, WAIT_DAYS_DEFAULT } from '../describe';

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + ' MB';

function BackupCard() {
  const status = useLive(() => backupStatus(), []);
  const [busy, setBusy] = useState('');
  const [bigPdf, setBigPdf] = useState<{ bytes: Uint8Array; name: string }>();
  const [ready, setReady] = useState<{ bytes: Uint8Array; name: string }>();

  const saveZip = async () => {
    setBusy('Making the backup…');
    try {
      const b = await buildBackup();
      download(b.bytes, b.name, 'application/zip');
      await markBackedUp(b.createdAt);
      showToast(`Saved ${b.name} (${mb(b.bytes.length)}) to Downloads.`);
    } catch (e) {
      reportError('The backup wasn’t created. Nothing on your phone changed. Try again.', e);
    } finally { setBusy(''); }
  };

  const sharePdf = async (force?: { bytes: Uint8Array; name: string }) => {
    setBusy('Making the backup…');
    try {
      const pdf = force ?? backupAsPdf(await buildBackup());
      if (!force && pdf.bytes.length > EMAIL_LIMIT) { setBigPdf(pdf); return; }
      const file = new File([pdf.bytes as BlobPart], pdf.name, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'ZivugBase backup' });
          await markBackedUp();
          showToast('Backup shared. Keep that email or file private.');
        } catch (e) {
          const name = (e as DOMException)?.name;
          /* A big backup can take longer than Chrome allows between the tap and sharing. */
          if (name === 'NotAllowedError') { setReady(pdf); return; }
          if (name !== 'AbortError') throw e;
        }
      } else {
        download(pdf.bytes, pdf.name, 'application/pdf');
        await markBackedUp();
        showToast('This browser can’t share files, so the backup was saved to Downloads — attach it to an email from there.');
      }
    } catch (e) {
      reportError('The backup wasn’t created. Nothing on your phone changed. Try again, or save it to the phone instead.', e);
    } finally { setBusy(''); }
  };

  return (
    <div class="card" id="backup">
      <h2>Backup</h2>
      {status && (
        <p class={status.overdue ? 'notice warn' : ''} style={status.overdue ? '' : 'margin-top:0'}>
          {status.lastAt ? `Last backup: ${relativeDay(status.lastAt).toLowerCase()} (${shortDate(status.lastAt)})` : 'No backup yet.'}
          {status.changedSince && status.lastAt ? ' — there are changes since then.' : ''}
        </p>
      )}
      <p class="muted small">Everything is only on this phone. If the phone is lost or Chrome’s data is cleared, a backup is the only copy.</p>
      {ready && !busy && (
        <p class="notice">The backup is ready. <button class="btn small primary" type="button" onClick={() => { const r = ready; setReady(undefined); void sharePdf(r); }}>Share it now</button></p>
      )}
      {busy ? <Loading /> : (
        <div class="btn-row">
          <button class="btn primary" type="button" onClick={saveZip}>Save to this phone</button>
          <button class="btn" type="button" onClick={() => sharePdf()}>Email or Drive</button>
        </div>
      )}
      <p class="muted small">“Email or Drive” makes a PDF with the whole backup inside it (phones can share a PDF from a web app, but not a .zip). It is not password-protected — keep it private.</p>
      {bigPdf && (
        <Sheet title="Too big for email" onClose={() => setBigPdf(undefined)}>
          <p>This backup is {mb(bigPdf.bytes.length)}. Most email services refuse attachments over 25 MB.</p>
          <p>Share it to Google Drive instead, or save it to the phone.</p>
          <div class="btn-row">
            <button class="btn" type="button" onClick={() => { const b = bigPdf; setBigPdf(undefined); void sharePdf(b); }}>Share anyway</button>
            <button class="btn primary" type="button" onClick={() => { setBigPdf(undefined); void saveZip(); }}>Save to this phone</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function StorageCard() {
  const [info, setInfo] = useState<{ persisted?: boolean; usage?: number; quota?: number }>();
  const refresh = async () => {
    try {
      const persisted = await navigator.storage?.persisted?.();
      const est = await navigator.storage?.estimate?.();
      setInfo({ ...(persisted !== undefined ? { persisted } : {}), ...(est?.usage !== undefined ? { usage: est.usage } : {}), ...(est?.quota !== undefined ? { quota: est.quota } : {}) });
    } catch { setInfo({}); }
  };
  useEffect(() => { void refresh(); }, []);
  if (!info) return null;
  return (
    <div class="card">
      <h2>Storage on this phone</h2>
      <p style="margin-top:0">Protected from automatic clearing: <b>{info.persisted ? 'Yes' : 'No'}</b></p>
      {!info.persisted && (
        <>
          <p class="muted small">Chrome may clear data of sites you don’t use much when the phone is low on space. Adding ZivugBase to the home screen and tapping below usually protects it.</p>
          <button class="btn" type="button" onClick={async () => { const ok = await protectStorage(); await refresh(); showToast(ok ? 'Protected.' : 'Chrome said no for now. Add ZivugBase to the home screen, then try again — and keep backups.'); }}>Protect my data</button>
        </>
      )}
      {info.usage !== undefined && <p class="muted small">Using {mb(info.usage)}{info.quota ? ` of about ${mb(info.quota)} available` : ''}.</p>}
    </div>
  );
}

function DeletedCard() {
  const rows = useLive(() => recentlyDeleted(), []);
  const [confirm, setConfirm] = useState<string>();
  return (
    <details class="section" id="deleted" open={route.value.query.get('open') === 'deleted'}>
      <summary>Recently deleted<span class="count">({rows?.length ?? 0})</span></summary>
      <div class="body">
        <p class="muted small">Kept for {TRASH_DAYS} days, then removed for good.</p>
        {rows?.length === 0 && <p class="muted">Nothing here.</p>}
        {rows?.map((p) => (
          <div key={p.id} class="event">
            <div class="head"><b>{displayName(p)}</b><span>{relativeDay(p.deletedAt)}</span></div>
            <div class="btn-row" style="margin-top:6px">
              <button class="btn small" type="button" onClick={async () => { await restorePerson(p.id); showToast(`${displayName(p)} is back.`); }}>Restore</button>
              {confirm === p.id
                ? <button class="btn small danger" type="button" onClick={async () => { await deleteForever(p.id); setConfirm(undefined); showToast('Deleted for good.'); }}>Tap again: delete for good</button>
                : <button class="btn small quiet" type="button" onClick={() => setConfirm(p.id)}>Delete for good</button>}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function Settings() {
  const [file, setFile] = useState<File>();
  const waitDays = useLive(() => getSetting('waitDays', WAIT_DAYS_DEFAULT), []);
  const myGender = useLive(() => getSetting<string>('myGender', ''), []);
  const counts = useLive(async () => ({ people: await db.people.filter((p) => !p.deletedAt && !p.roles.includes('me')).count(), inbox: await db.inbox.count() }), []);

  const pick = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) setFile(f);
  };

  return (
    <>
      <TopBar title="Settings" backTo="/home" />
      <main>
        <div class="card">
          <h2>Mode</h2>
          {(['me', 'helping'] as Mode[]).map((m) => (
            <button key={m} type="button" class={`chip${mode.value === m ? ' on' : ''}`} style="margin:0 6px 6px 0" aria-pressed={mode.value === m} onClick={async () => { await chooseMode(m); showToast('Changed. Nothing was lost.'); }}>{MODE_LABEL[m]}</button>
          ))}
        </div>

        <div class="card">
          <h2>I am</h2>
          {([['m', 'Single guy'], ['f', 'Single girl']] as const).map(([g, label]) => (
            <button key={g} type="button" class={`chip${myGender === g ? ' on' : ''}`} style="margin:0 6px 6px 0" aria-pressed={myGender === g} onClick={async () => { await setSetting('myGender', g); showToast('Saved. “Idea for me” will be filed as a ' + (g === 'm' ? 'girl' : 'guy') + '.'); }}>{label}</button>
          ))}
          <p class="muted small" style="margin:4px 0 0">Used to file “Idea for me” under the right list.</p>
        </div>

        <BackupCard />

        <div class="card">
          <h2>Restore or import</h2>
          <label class="btn full" style="cursor:pointer;margin-bottom:8px">
            Restore a backup or import from PeerMatch
            <input type="file" accept={BACKUP_ACCEPT} hidden onChange={pick} />
          </label>
          <p class="muted small">A ZivugBase backup (.zip or .pdf) replaces what’s here, with Undo right after. A PeerMatch backup (.zip or the .txt from email) is added to what’s here and can be imported again safely.</p>
        </div>

        <div class="card">
          <h2>Waiting for an answer</h2>
          <label class="field" style="margin:0">
            <span>Show on Home after how many days without an answer?</span>
            <input type="number" inputMode="numeric" min={1} max={60} value={waitDays ?? WAIT_DAYS_DEFAULT} onChange={async (e) => { const n = Number(e.currentTarget.value); if (n >= 1 && n <= 60) await setSetting('waitDays', Math.floor(n)); }} />
          </label>
        </div>

        <div class="card" id="addon">
          <h2>Android add-on</h2>
          <p style="margin-top:0"><b>Light (recommended to start):</b> select a profile’s text in WhatsApp or any app, then tap “ZivugBase” in the small menu — it opens here filled in, ready to Save. Needs no special permission.</p>
          <a class="btn primary full" href="addon/ZivugBase-addon-lite.apk" download="ZivugBase-addon-lite.apk">Download the light add-on</a>
          <p><b>With the “Z” bubble:</b> a bubble floats over every app; tap it in a chat and the messages on the screen open here. It needs Android’s Accessibility permission, so Google Play Protect may block installing it — if it does, turn off “Scan apps with Play Protect” (Play Store → your picture → Play Protect → ⚙) just while installing, then turn it back on.</p>
          <a class="btn full" href="addon/ZivugBase-addon.apk" download="ZivugBase-addon.apk">Download the add-on with the bubble</a>
          <p class="muted small">Install only one of them — installing the other replaces it. Neither has internet permission; neither can send anything anywhere. ZivugBase keeps working without them.</p>
        </div>

        <StorageCard />
        <DeletedCard />

        <div class="card">
          <h2>About</h2>
          <p style="margin-top:0">ZivugBase keeps everything on this phone. Nothing is sent anywhere unless you send it.</p>
          {counts && <p class="muted small">{plural(counts.people, 'person', 'people')} · {plural(counts.inbox, 'Intake item')}</p>}
          <p class="muted small">Build {import.meta.env.MODE === 'production' ? 'release' : 'development'}</p>
        </div>
      </main>
      {file && (
        <Sheet title="Open a backup" onClose={() => setFile(undefined)}>
          <BackupOpener file={file} onClose={() => setFile(undefined)} />
        </Sheet>
      )}
    </>
  );
}
