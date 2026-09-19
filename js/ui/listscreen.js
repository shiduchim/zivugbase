/* ZivugBase - a list screen (Guys, Girls, Shadchanim).

   All three tabs share this one implementation: view chips, tag facets, a sort
   control and a debounced search, all feeding list/engine.js. */

import { esc } from '../core/format.js';
import { allTags } from '../core/model.js';
import { listState, renderList, resetPaging } from '../list/engine.js';
import { viewsFor, SORTS } from '../list/views.js';

const TITLES = { guys: 'Guys', girls: 'Girls', shadchanim: 'Shadchanim' };

export function renderListScreen(kind, mount, onOpen, onAdd) {
  const st = listState[kind];
  const views = viewsFor(kind);
  const tags = allTags(kind).slice(0, 12);

  mount.innerHTML = `
    <div class="screen-head">
      <h1>${esc(TITLES[kind])}</h1>
      <button class="btn btn-primary btn-sm" data-add>Add</button>
    </div>

    <div class="search-row">
      <input class="search" type="search" placeholder="Search ${esc(TITLES[kind].toLowerCase())}" value="${esc(st.query)}" data-search>
    </div>

    <div class="chips scroller" data-views>
      ${views.map(v => `<button class="chip${v.id === st.view ? ' is-on' : ''}${v.tone === 'warn' ? ' chip-wait' : ''}" data-view="${v.id}">${esc(v.label)}</button>`).join('')}
    </div>

    ${tags.length ? `<div class="chips scroller" data-tags>
      ${st.tag ? `<button class="chip chip-clear" data-tag="">Clear tag</button>` : ''}
      ${tags.map(t => `<button class="chip chip-tag${st.tag === t.tag ? ' is-on' : ''}" data-tag="${esc(t.tag)}">${esc(t.tag)} <i>${t.count}</i></button>`).join('')}
    </div>` : ''}

    <div class="list-meta">
      <span data-count></span>
      <label class="sort">
        Sort
        <select data-sort>
          ${Object.entries(SORTS).map(([id, s]) =>
            `<option value="${id}"${(st.sort || viewsFor(kind).find(v => v.id === st.view).sort) === id ? ' selected' : ''}>${esc(s.label)}</option>`
          ).join('')}
        </select>
      </label>
    </div>

    <div class="list" data-list></div>`;

  const listEl = mount.querySelector('[data-list]');
  const countEl = mount.querySelector('[data-count]');

  const paint = () => {
    const { shown, total } = renderList(kind, listEl, onOpen);
    countEl.textContent = total ? `Showing ${shown} of ${total}` : '';
  };

  /* Debounced so typing in a 200-record list does not rebuild every card on
     every keypress, which is what made PeerMatch's search feel slow. */
  let timer = null;
  mount.querySelector('[data-search]').oninput = e => {
    st.query = e.target.value;
    clearTimeout(timer);
    timer = setTimeout(() => { resetPaging(kind); paint(); }, 120);
  };

  mount.querySelectorAll('[data-view]').forEach(btn => {
    btn.onclick = () => {
      st.view = btn.dataset.view;
      st.sort = null;
      resetPaging(kind);
      renderListScreen(kind, mount, onOpen, onAdd);
    };
  });

  mount.querySelectorAll('[data-tag]').forEach(btn => {
    btn.onclick = () => {
      st.tag = btn.dataset.tag || null;
      resetPaging(kind);
      renderListScreen(kind, mount, onOpen, onAdd);
    };
  });

  mount.querySelector('[data-sort]').onchange = e => {
    st.sort = e.target.value;
    resetPaging(kind);
    paint();
  };

  mount.querySelector('[data-add]').onclick = () => onAdd(kind);

  paint();
}
