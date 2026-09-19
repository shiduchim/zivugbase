/* ZivugBase - screen router and global search. */

import { load, KINDS, listOf } from '../core/store.js';
import { bus } from '../core/bus.js';
import { esc, initials, relativeDay } from '../core/format.js';
import { haystack, lastActivityMs, stageLabel, stageOf } from '../core/model.js';
import { renderToday } from './today.js';
import { renderListScreen } from './listscreen.js';
import { renderSettings } from './settings.js';
import { openDetail } from './detail.js';
import { profileForm, shadchanForm } from './forms.js';
import { initSheet, openSheet, closeSheet, closeAllSheets } from './sheet.js';

const SCREENS = ['today', 'guys', 'girls', 'shadchanim', 'data'];
let current = 'today';

const mount = () => document.getElementById('screen');

function openRecord(kind, id) { openDetail(kind, id); }

function addRecord(kind) {
  kind === 'shadchanim' ? shadchanForm() : profileForm(kind);
}

export function paint() {
  const el = mount();
  el.scrollTop = 0;
  if (current === 'today') renderToday(el, openRecord);
  else if (current === 'data') renderSettings(el);
  else renderListScreen(current, el, openRecord, addRecord);

  document.querySelectorAll('nav button[data-screen]').forEach(b => {
    b.classList.toggle('is-on', b.dataset.screen === current);
    b.setAttribute('aria-current', b.dataset.screen === current ? 'page' : 'false');
  });
}

export function go(screen) {
  if (!SCREENS.includes(screen)) return;
  current = screen;
  paint();
}

/* ---------- global search across all three objects ---------- */

function globalSearch() {
  openSheet(`
    <h2>Search everything</h2>
    <input class="search" type="search" id="gs" placeholder="Name, note, tag, phone…" autocomplete="off">
    <div id="gs-results" class="list"></div>`, root => {
    const input = root.querySelector('#gs');
    const out = root.querySelector('#gs-results');

    const run = () => {
      const q = input.value.trim().toLocaleLowerCase();
      if (q.length < 2) { out.innerHTML = '<div class="empty small">Type at least two letters.</div>'; return; }

      const hits = [];
      for (const kind of KINDS) {
        for (const x of listOf(kind)) {
          if (haystack(x).includes(q)) hits.push({ kind, record: x, ms: lastActivityMs(x) });
        }
      }
      hits.sort((a, b) => b.ms - a.ms);

      out.innerHTML = hits.length
        ? hits.slice(0, 40).map(h => `
            <button class="mini-row" data-goto="${h.kind}:${esc(h.record.id)}">
              <span class="mini-avatar">${esc(initials(h.record.name))}</span>
              <b>${esc(h.record.name || 'Unnamed')}</b>
              <span>${esc(h.kind === 'shadchanim' ? 'Shadchan' : stageLabel(stageOf(h.record)))} &middot; ${esc(relativeDay(h.ms))}</span>
            </button>`).join('')
        : '<div class="empty small">Nothing matched.</div>';

      out.querySelectorAll('[data-goto]').forEach(btn => {
        btn.onclick = () => {
          const [kind, id] = btn.dataset.goto.split(':');
          closeAllSheets();
          openDetail(kind, id);
        };
      });
    };

    let timer = null;
    input.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 120); };
    input.focus();
    run();
  });
}

/* ---------- boot ---------- */

export async function start() {
  initSheet();
  await load();

  document.querySelectorAll('nav button[data-screen]').forEach(b => {
    b.onclick = () => go(b.dataset.screen);
  });
  document.getElementById('global-search').onclick = globalSearch;

  bus.on('data:changed', paint);
  bus.on('activity:added', paint);
  bus.on('activity:deleted', paint);
  bus.on('record:changed', paint);
  bus.on('detail:open', ({ kind, id }) => openDetail(kind, id));
  bus.on('edit:open', ({ kind, id }) => {
    closeSheet();
    kind === 'shadchanim' ? shadchanForm(id) : profileForm(kind, id);
  });

  paint();

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch (_) {}
  }
}
