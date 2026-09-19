/* ZivugBase - backup, restore and the data tools screen. */

import { listOf } from '../core/store.js';
import { saveBackupZip, buildBackupText, readBackupFile, restoreBackup } from '../data/backup.js';
import { downloadBlob } from '../core/blobs.js';
import { confirmSheet, toast } from './sheet.js';
import { bus } from '../core/bus.js';

export function renderSettings(mount) {
  mount.innerHTML = `
    <div class="screen-head"><h1>Data</h1></div>

    <section class="panel">
      <h3 class="panel-head"><span>This device holds</span></h3>
      <div class="stat-row">
        <div class="stat"><b>${listOf('guys').length}</b><span>Guys</span></div>
        <div class="stat"><b>${listOf('girls').length}</b><span>Girls</span></div>
        <div class="stat"><b>${listOf('shadchanim').length}</b><span>Shadchanim</span></div>
      </div>
    </section>

    <section class="panel">
      <h3 class="panel-head"><span>Backup</span></h3>
      <p class="muted pad">A backup is a real ZIP holding every record, photo, audio note and
      attachment. The emailed text file holds the same ZIP as base64, because Android Chrome
      refuses to share a ZIP directly. Neither file is encrypted, so keep them somewhere private.</p>
      <button class="btn btn-primary btn-full" data-zip>Save backup to this device</button>
      <div class="gap"></div>
      <button class="btn btn-soft btn-full" data-txt>Save emailable text backup</button>
    </section>

    <section class="panel">
      <h3 class="panel-head"><span>Restore</span></h3>
      <p class="muted pad">Accepts a ZivugBase or PeerMatch backup, as either a .zip or the
      emailed .txt wrapper. Restoring replaces everything currently on this device.</p>
      <input type="file" id="restore-file" accept=".zip,.txt,application/zip,text/plain">
    </section>

    <section class="panel">
      <h3 class="panel-head"><span>About</span></h3>
      <p class="muted pad">ZivugBase keeps all data in this browser only, in IndexedDB.
      Nothing is uploaded anywhere. Clearing site data erases it, so take backups.</p>
    </section>`;

  mount.querySelector('[data-zip]').onclick = async () => {
    try {
      const manifest = await saveBackupZip();
      toast(`Saved ${manifest.counts.guys + manifest.counts.girls + manifest.counts.shadchanim} records.`);
    } catch (err) { toast(err.message || 'Backup failed.'); }
  };

  mount.querySelector('[data-txt]').onclick = async () => {
    try {
      const { file } = await buildBackupText();
      downloadBlob(file, file.name);
      toast('Text backup saved. Attach it to an email.');
    } catch (err) { toast(err.message || 'Backup failed.'); }
  };

  mount.querySelector('#restore-file').onchange = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { manifest, files } = await readBackupFile(file);
      const c = manifest.counts || {};
      confirmSheet(
        'Restore this backup?',
        `It holds ${c.guys || 0} guys, ${c.girls || 0} girls, ${c.shadchanim || 0} shadchanim and ${c.notes || 0} notes,
         saved ${new Date(manifest.createdAt).toLocaleString()}. Everything currently on this device will be replaced.`,
        async () => {
          try {
            await restoreBackup(manifest, files);
            bus.emit('data:changed');
            toast('Backup restored.');
            renderSettings(mount);
          } catch (err) { toast(err.message || 'Restore failed.'); }
        },
        'Yes, restore', 'No, cancel'
      );
    } catch (err) {
      toast(err.message || 'That file could not be read.');
    }
  };
}
