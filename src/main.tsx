import { render } from 'preact';
import './styles.css';
import { App } from './ui/App';
import { db } from './db/db';
import { getSetting, purgeTrash } from './db/repo';
import type { Mode } from './db/types';
import { drainIncoming } from './inbox/inbox';
import { fatal, mode } from './state';

render(<App />, document.getElementById('app')!);

async function boot() {
  try {
    await db.open();
  } catch (e) {
    console.error(e);
    fatal.value = 'This browser is not letting ZivugBase keep data (a private window, or storage turned off). Open it in a normal Chrome window.';
    return;
  }
  const saved = await getSetting<Mode | null>('mode', null);
  mode.value = saved === 'both' ? 'helping' : saved; /* "Both" became shadchan mode */
  drainIncoming().catch((e) => console.error('share queue', e));
  purgeTrash().catch((e) => console.error('purge', e));
  try {
    if ((await db.people.count()) > 0 && navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* asking is optional */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') drainIncoming().catch(() => undefined);
});

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.error('service worker', e));
}

void boot();
