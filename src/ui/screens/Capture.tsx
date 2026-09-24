/* Capture: Paste · Speak, and the "Saved to the Intake folder ✓" screen. Capturing never opens a form —
   the item waits in the Inbox until you file it. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { addToInbox } from '../../inbox/inbox';
import { go, pasted, readClipboard, reportError, route, showToast } from '../../state';
import type { InboxItem } from '../../db/types';
import { QuickFile } from '../parts/QuickFile';
import { TopBar } from '../parts/common';
import { SpeechBox } from '../parts/Speech';

function Saved() {
  const id = route.value.query.get('id');
  return (
    <>
      <TopBar title="Saved to the Intake folder ✓" />
      <main>
        <p>It’s in your Intake folder, exactly as it came. File it now, or later when you have a minute.</p>
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

/* One item per capture: made once, even if Save is tapped twice. */
function useItemOnce(source: 'paste' | 'speak', text: string) {
  const made = useRef<Promise<InboxItem>>();
  const madeFor = useRef('');
  return () => {
    if (!made.current || madeFor.current !== text) { madeFor.current = text; made.current = addToInbox(source, text); }
    return made.current;
  };
}

function CaptureForm({ source, text, senderHint }: { source: 'paste' | 'speak'; text: string; senderHint?: string }) {
  const getItem = useItemOnce(source, text);
  const keep = async () => {
    try {
      await getItem();
      go('/home', { replace: true });
      showToast('Kept in the Intake folder, exactly as it came.');
    } catch (e) {
      reportError('Not saved. The text is still here — try again.', e);
    }
  };
  if (!text.trim()) return null;
  return <QuickFile text={text} getItem={getItem} onKeep={keep} {...(senderHint ? { senderHint } : {})} />;
}

function Paste() {
  /* From the Paste button (clipboard) or from the Android add-on's bubble (text in the address). */
  const q = route.value.query;
  const [text, setText] = useState(() => { const t = q.get('text') ?? pasted.value ?? ''; pasted.value = null; return t; });
  const [senderHint] = useState(() => q.get('sender') ?? undefined);
  /* Take the text out of the address, so Back or a reload doesn't bring it again. */
  useEffect(() => { if (q.get('text')) go('/capture/paste', { replace: true }); }, []);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (!text) box.current?.focus(); }, []);

  return (
    <>
      <TopBar title="Paste" backTo="/home" />
      <main>
        {!text && (
          <>
            <p class="muted small" style="margin-top:0">Copy a message in WhatsApp or email first, then tap Paste on Home — it fills this in by itself. Or tap the box: your keyboard shows what you copied.</p>
            <button class="btn full" type="button" style="margin-bottom:8px" onClick={async () => setText(await readClipboard())}>Paste what I copied</button>
          </>
        )}
        <textarea ref={box} class="bidi" dir="auto" style={text ? 'min-height:22dvh' : 'min-height:40dvh'} value={text} placeholder="Paste here" onInput={(e) => setText(e.currentTarget.value)} />
        <CaptureForm source="paste" text={text} {...(senderHint ? { senderHint } : {})} />
      </main>
    </>
  );
}

function Speak() {
  const [text, setText] = useState('');
  return (
    <>
      <TopBar title="Speak" backTo="/home" />
      <main>
        <p class="muted small" style="margin-top:0">Say what happened — e.g. “Mrs. Katz suggested Chaya, 29, from Jerusalem.” You can fix the words.</p>
        <SpeechBox value={text} onChange={setText} rows={5} autoStart />
        <CaptureForm source="speak" text={text} />
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
        <p class="muted small" style="margin-top:0">A resume on paper, a screenshot, a business card — it’s kept in the Intake folder as it is.</p>
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
