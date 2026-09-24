/* First run (PLAN §15): who is this for, then Restore · Import from PeerMatch · Start fresh. */
import { useState } from 'preact/hooks';
import { ensureMe, setSetting } from '../../db/repo';
import type { Mode } from '../../db/types';
import { go, mode } from '../../state';
import { MODE_LABEL } from '../../text';
import { Sheet, TopBar } from '../parts/common';
import { BACKUP_ACCEPT, BackupOpener } from '../parts/BackupOpener';

const MODE_HELP: Record<Mode, string> = {
  me: 'Your own search: shadchanim, the ideas you get, and the girls you were offered.',
  helping: 'Also make shidduchim: guys and girls to set up, with your shadchanim.',
  both: 'Both: your own search, and the people you help.'
};

export async function chooseMode(m: Mode): Promise<void> {
  await setSetting('mode', m);
  await ensureMe();
  mode.value = m;
}

export function FirstRun() {
  const [picked, setPicked] = useState<Mode | undefined>(mode.value ?? undefined);
  const [file, setFile] = useState<File>();
  const [step, setStep] = useState<'who' | 'start'>(mode.value ? 'start' : 'who');

  if (step === 'who') {
    return (
      <>
        <TopBar title="Welcome to ZivugBase" />
        <main>
          <p>Everything stays on this phone. Nothing is sent anywhere unless you send it.</p>
          <h2 class="section-title">Which mode?</h2>
          {(['me', 'helping'] as Mode[]).map((m) => (
            <button key={m} type="button" class="choice" onClick={() => { setPicked(m); setStep('start'); go('/first-run', { replace: true }); }}>
              <b>{MODE_LABEL[m]}</b>
              <span class="muted">{MODE_HELP[m]}</span>
            </button>
          ))}
          <p class="muted small">You can change this any time in Settings. Nothing is lost.</p>
        </main>
      </>
    );
  }

  const finish = async (then: string) => {
    if (picked) await chooseMode(picked);
    go(then, { replace: true });
  };

  return (
    <>
      <TopBar title="How do you want to start?" />
      <main>
        <label class="choice">
          <b>Restore a backup</b>
          <span class="muted">A ZivugBase backup (.zip, or the .pdf from email or Drive).</span>
          <input type="file" accept={BACKUP_ACCEPT} hidden onChange={async (e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) { if (picked) await chooseMode(picked); setFile(f); } }} />
        </label>
        <label class="choice">
          <b>Import from PeerMatch</b>
          <span class="muted">In PeerMatch, save a backup (the .zip, or the .txt from email), then choose it here. PeerMatch itself is not changed.</span>
          <input type="file" accept={BACKUP_ACCEPT} hidden onChange={async (e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) { if (picked) await chooseMode(picked); setFile(f); } }} />
        </label>
        <button type="button" class="choice" onClick={() => finish('/home')}>
          <b>Start fresh</b>
          <span class="muted">Begin with an empty ZivugBase.</span>
        </button>
        <p class="notice small">Try it: in WhatsApp, share any message or PDF to ZivugBase — it lands in your Inbox. (On Android, first add ZivugBase to the home screen from Chrome’s menu.)</p>
        <button type="button" class="btn quiet" onClick={() => setStep('who')}>Back</button>
      </main>
      {file && (
        <Sheet title="Open a backup" onClose={() => { setFile(undefined); go('/home', { replace: true }); }}>
          <BackupOpener file={file} onClose={() => { setFile(undefined); }} />
        </Sheet>
      )}
    </>
  );
}
