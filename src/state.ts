/* App-wide state: the current screen (from the address), the mode, and the toast with Undo. */
import { signal } from '@preact/signals';
import type { Mode } from './db/types';

export interface Route { path: string[]; query: URLSearchParams; hash: string }

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const i = h.indexOf('?');
  const p = i < 0 ? h : h.slice(0, i);
  const q = i < 0 ? '' : h.slice(i + 1);
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q), hash: location.hash };
}

export const route = signal<Route>(parse());
let cameBack = false;
let replaced = false;

function sync(fromHistory: boolean) {
  if (route.value.hash === location.hash) return;
  cameBack = fromHistory;
  replaced = false;
  route.value = parse();
}
window.addEventListener('popstate', () => sync(true));
window.addEventListener('hashchange', () => sync(true));

const depth = (): number => (typeof history.state?.zb === 'number' ? history.state.zb : 0);
let pendingBack: Promise<void> | undefined;

/* Moves to a screen. Our own history depth is kept so Back never leaves the app by accident.
   Leaving from an open sheet replaces the sheet's history entry instead of stacking on it. */
export function go(to: string, opts: { replace?: boolean } = {}): void {
  if (pendingBack) { void pendingBack.then(() => go(to, opts)); return; }
  const url = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to);
  const samePath = location.hash.split('?')[0] === url.split('?')[0];
  saveScroll();
  if (opts.replace || history.state?.layer) history.replaceState({ zb: depth() }, '', url);
  else if (url !== location.hash) history.pushState({ zb: depth() + 1 }, '', url);
  cameBack = false;
  replaced = !!opts.replace && samePath;
  route.value = parse();
}

/* A sheet or photo viewer gets its own history entry, so the phone's Back button closes it
   instead of leaving the screen. Returns the function to call when it closes by itself. */
export function pushLayer(onBack: () => void): () => void {
  const mine = depth() + 1;
  history.pushState({ zb: mine, layer: true }, '', location.hash);
  let done = false;
  const onPop = () => {
    if (done || depth() >= mine) return;
    done = true;
    window.removeEventListener('popstate', onPop);
    onBack();
  };
  window.addEventListener('popstate', onPop);
  return () => {
    if (done) return;
    done = true;
    window.removeEventListener('popstate', onPop);
    if (history.state?.layer && depth() === mine) {
      pendingBack = new Promise((resolve) => {
        const h = () => { window.removeEventListener('popstate', h); pendingBack = undefined; resolve(); };
        window.addEventListener('popstate', h);
      });
      history.back();
    }
  };
}

export function back(fallback = '/home'): void {
  if (depth() > 0) history.back();
  else go(fallback, { replace: true });
}

/* Returning to a list puts you where you were; a new screen starts at the top. */
const scrolls = new Map<string, number>();
function saveScroll() { scrolls.set(location.hash, window.scrollY); }
window.addEventListener('scroll', () => saveScroll(), { passive: true });
export function restoreScroll(hash: string): void {
  if (replaced) return; /* same screen, new filter: stay where you are */
  const y = cameBack ? scrolls.get(hash) ?? 0 : 0;
  let tries = 0;
  const attempt = () => {
    window.scrollTo(0, y);
    if (Math.abs(window.scrollY - y) > 2 && tries++ < 20) requestAnimationFrame(attempt);
  };
  attempt();
}

/* undefined = still loading, null = first run (not chosen yet) */
export const mode = signal<Mode | null | undefined>(undefined);
export const fatal = signal<string>('');

/* What the Paste button read from the clipboard, handed to the Paste screen. */
export const pasted = signal<string | null>(null);

/* Reads the clipboard inside the tap (Chrome asks once to allow it). '' when not allowed. */
export async function readClipboard(): Promise<string> {
  try {
    if (typeof navigator.clipboard?.readText !== 'function') return '';
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

export interface Toast { id: number; text: string; action?: { label: string; run: () => void | Promise<void> } }
export const toast = signal<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, action?: Toast['action'], ms = action ? 8000 : 4000): void {
  clearTimeout(toastTimer);
  const t: Toast = { id: Date.now(), text, ...(action ? { action } : {}) };
  toast.value = t;
  toastTimer = setTimeout(() => { if (toast.value?.id === t.id) toast.value = null; }, ms);
}

export function hideToast(): void {
  clearTimeout(toastTimer);
  toast.value = null;
}

/* Something went wrong: say what happened, what is safe, what to do next (PLAN §16). */
export function reportError(what: string, err: unknown): void {
  console.error(what, err);
  const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
  showToast(`${what}${detail}`, undefined, 8000);
}
