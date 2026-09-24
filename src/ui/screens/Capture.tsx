/* Capture: Paste · Speak, and the "Saved to Inbox ✓" screen. Capturing never opens a form —
   the item waits in the Inbox until you file it. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { addToInbox } from '../../inbox/inbox';
import { back, go, reportError, route } from '../../state';
import { TopBar } from '../parts/common';
import { SpeechBox } from '../parts/Speech';

function Saved() {
  const id = route.value.query.get('id');
  return (
    <>
      <TopBar title="Saved to Inbox ✓" />
      <main>
        <p>It’s in your Inbox, exactly as it came. File it now, or later when you have a minute.</p>
        <div class="btn-row">
          <button class="btn primary" type="button" onClick={() => go(id ? '/inbox/' + id : '/inbox', { replace: true })}>File it now</button>
          <button class="btn" type="button" onClick={() => go('/home', { replace: true })}>Later</button>
        </div>
        <div class="btn-row" style="margin-top:8px">
          <button class="btn quiet" type="button" onClick={() => go('/capture/paste', { replace: true })}>Paste another</button>
          <button class="btn quiet" type="button" onClick={() => go('/capture/speak', { replace: true })}>Speak another</button>
        </div>
      </main>
    </>
  );
}

function Paste() {
  const [text, setText] = useState('');
  const [clip, setClip] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    box.current?.focus();
    /* Only when the clipboard permission was already given: offer what was copied. */
    (async () => {
      try {
        const st = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName });
        if (st?.state === 'granted' && typeof navigator.clipboard?.readText === 'function') setClip(true);
      } catch { /* not supported — Gboard's clipboard chip does the job */ }
    })();
  }, []);

  const save = async () => {
    if (!text.trim()) return;
    try {
      const item = await addToInbox('paste', text);
      go('/capture/saved?id=' + item.id, { replace: true });
    } catch (e) {
      reportError('Not saved. The text is still here — try again.', e);
    }
  };

  return (
    <>
      <TopBar title="Paste" backTo="/home" />
      <main>
        <p class="muted small" style="margin-top:0">Copied a message in WhatsApp or email? Tap the box — your keyboard shows what you copied; tap it to paste. Several messages at once are fine.</p>
        {clip && !text && (
          <button class="btn full" type="button" style="margin-bottom:8px" onClick={async () => { try { setText(await navigator.clipboard.readText()); } catch { setClip(false); } }}>Add what you copied</button>
        )}
        <textarea ref={box} class="bidi" dir="auto" style="min-height:45dvh" value={text} placeholder="Paste here" onInput={(e) => setText(e.currentTarget.value)} />
        <div class="form-actions">
          <button class="btn quiet" type="button" onClick={() => back('/home')}>Cancel</button>
          <button class="btn primary" type="button" disabled={!text.trim()} onClick={save}>Save to Inbox</button>
        </div>
      </main>
    </>
  );
}

function Speak() {
  const [text, setText] = useState('');
  const save = async () => {
    if (!text.trim()) return;
    try {
      const item = await addToInbox('speak', text);
      go('/capture/saved?id=' + item.id, { replace: true });
    } catch (e) {
      reportError('Not saved. The text is still here — try again.', e);
    }
  };
  return (
    <>
      <TopBar title="Speak" backTo="/home" />
      <main>
        <p class="muted small" style="margin-top:0">Say what happened — e.g. “Mrs. Katz said to call Rabbi Cohen, 052…, about a girl from Jerusalem.” You can fix the words before saving.</p>
        <SpeechBox value={text} onChange={setText} autoStart />
        <div class="form-actions">
          <button class="btn quiet" type="button" onClick={() => back('/home')}>Cancel</button>
          <button class="btn primary" type="button" disabled={!text.trim()} onClick={save}>Save to Inbox</button>
        </div>
      </main>
    </>
  );
}

function Photo() {
  const onPick = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return;
    try {
      const item = await addToInbox('photo', '', files.map((f) => ({ blob: f, name: f.name, type: f.type })));
      go('/capture/saved?id=' + item.id, { replace: true });
    } catch (err) {
      reportError('The photo was not saved. Nothing else changed — try again.', err);
    }
  };
  return (
    <>
      <TopBar title="Photo" backTo="/home" />
      <main>
        <p class="muted small" style="margin-top:0">A resume on paper, a screenshot, a business card — it’s kept in the Inbox as it is.</p>
        <label class="btn primary full" style="cursor:pointer">Take or choose a photo<input type="file" accept="image/*" multiple hidden onChange={onPick} /></label>
      </main>
    </>
  );
}

export function Capture({ kind }: { kind: string }) {
  if (kind === 'saved') return <Saved />;
  if (kind === 'speak') return <Speak />;
  if (kind === 'photo') return <Photo />;
  return <Paste />;
}
