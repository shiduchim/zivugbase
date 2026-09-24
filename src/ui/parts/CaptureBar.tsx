/* Quick capture, one tap each: Paste (straight into the Inbox) · Speak · Photo · Add. */
import { db } from '../../db/db';
import { addToInbox } from '../../inbox/inbox';
import { go, readClipboard, reportError, showToast } from '../../state';

/* One tap: what you copied goes into the Inbox as it is. File it now or later. */
export async function quickPaste(): Promise<void> {
  const text = (await readClipboard()).trim();
  if (!text) { go('/capture/paste'); return; }
  try {
    const recent = await db.inbox.where('receivedAt').above(Date.now() - 10 * 60000).toArray();
    const same = recent.find((i) => i.text.trim() === text);
    if (same) {
      showToast('Already in the Inbox.', { label: 'Open', run: () => go('/inbox/' + same.id) });
      return;
    }
    const item = await addToInbox('paste', text);
    showToast('Saved to the Inbox.', { label: 'File now', run: () => go('/inbox/' + item.id) });
  } catch (e) {
    reportError('Not saved. Try again, or open Paste and paste it by hand.', e);
  }
}

export function QuickActions() {
  const onPhoto = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return;
    try {
      const item = await addToInbox('photo', '', files.map((f) => ({ blob: f, name: f.name, type: f.type })));
      showToast('Photo saved to the Inbox.', { label: 'File now', run: () => go('/inbox/' + item.id) });
    } catch (err) {
      reportError('The photo was not saved. Nothing else changed — try again.', err);
    }
  };
  return (
    <div class="quick" role="group" aria-label="Add something">
      <button class="btn primary" type="button" onClick={quickPaste}>Paste</button>
      <button class="btn" type="button" onClick={() => go('/capture/speak')}>Speak</button>
      <label class="btn" style="cursor:pointer">Photo<input type="file" accept="image/*" multiple hidden onChange={onPhoto} /></label>
      <button class="btn" type="button" onClick={() => go('/person/new')}>+ Add</button>
    </div>
  );
}
