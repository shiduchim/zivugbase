/* The capture bar, where the thumb is: Paste · Speak · Photo · Add. Capturing never opens a form. */
import { addToInbox } from '../../inbox/inbox';
import { go, pasted, readClipboard, reportError } from '../../state';

export function CaptureBar() {
  const onPhoto = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return;
    try {
      const item = await addToInbox('photo', '', files.map((f) => ({ blob: f, name: f.name, type: f.type })));
      go('/capture/saved?id=' + item.id);
    } catch (err) {
      reportError('The photo was not saved. Nothing else changed — try again.', err);
    }
  };
  return (
    <div class="capture" role="group" aria-label="Add something">
      <button class="btn" type="button" onClick={async () => { pasted.value = await readClipboard(); go('/capture/paste'); }}>Paste</button>
      <button class="btn" type="button" onClick={() => go('/capture/speak')}>Speak</button>
      <label class="btn" style="cursor:pointer">
        Photo
        <input type="file" accept="image/*" multiple hidden onChange={onPhoto} />
      </label>
      <button class="btn primary" type="button" onClick={() => go('/person/new')}>+ Add</button>
    </div>
  );
}
