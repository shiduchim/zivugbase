/* ZivugBase - the single list renderer.

   PeerMatch had seven different files redefining renderS() and four redefining
   renderP(), each wrapping the last. Every list in ZivugBase goes through this
   one pipeline instead:

       records -> search -> view filter -> tag filter -> sort -> group -> render

   Features add behaviour by contributing a view (list/views.js) or a row
   decorator, never by replacing this function. */

import { listOf } from '../core/store.js';
import { esc, relativeDay, displayPhone, initials } from '../core/format.js';
import { blobUrl, releaseScope } from '../core/blobs.js';
import {
  haystack, tagsOf, stageOf, stageLabel, activitySummary, isWaiting,
  callDueState, tierOf, resolveShadchan, STAGES
} from '../core/model.js';
import { viewById, SORTS } from './views.js';

const PAGE = 30;   /* render a window, not 200 cards, then extend on demand */

export const listState = {
  guys:       { view: 'all', sort: null, tag: null, query: '', limit: PAGE, group: true },
  girls:      { view: 'all', sort: null, tag: null, query: '', limit: PAGE, group: true },
  shadchanim: { view: 'all', sort: null, tag: null, query: '', limit: PAGE, group: true }
};

export function resetPaging(kind) { listState[kind].limit = PAGE; }

/* ---------- pipeline ---------- */

export function selectRecords(kind) {
  const st = listState[kind];
  const view = viewById(kind, st.view);
  const q = st.query.trim().toLocaleLowerCase();

  let rows = listOf(kind).filter(view.filter);
  if (q) rows = rows.filter(x => haystack(x).includes(q));
  if (st.tag) {
    const want = st.tag.toLocaleLowerCase();
    rows = rows.filter(x => tagsOf(x).some(t => t.toLocaleLowerCase() === want));
  }

  const sortKey = st.sort || view.sort || 'recent';
  rows = rows.slice().sort(SORTS[sortKey]?.fn || SORTS.recent.fn);
  return { rows, view, sortKey };
}

function groupsFor(kind, rows, sortKey) {
  if (!listState[kind].group) return [{ key: '', label: '', rows }];

  if (sortKey === 'name') {
    const map = new Map();
    for (const x of rows) {
      const letter = (String(x.name || '?').trim()[0] || '?').toLocaleUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter).push(x);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, rows]) => ({ key, label: key, rows }));
  }

  if (kind === 'shadchanim') {
    const order = ['active', 'occasional', 'dormant', 'new'];
    const map = new Map();
    for (const x of rows) {
      const t = tierOf(x);
      if (!map.has(t.id)) map.set(t.id, { key: t.id, label: t.label, rows: [] });
      map.get(t.id).rows.push(x);
    }
    return order.filter(k => map.has(k)).map(k => map.get(k));
  }

  const map = new Map();
  for (const x of rows) {
    const id = stageOf(x);
    if (!map.has(id)) map.set(id, { key: id, label: stageLabel(id), rows: [] });
    map.get(id).rows.push(x);
  }
  return STAGES.filter(s => map.has(s.id)).map(s => map.get(s.id));
}

/* ---------- row rendering ---------- */

function pill(text, tone) {
  return `<span class="pill${tone ? ' pill-' + tone : ''}">${esc(text)}</span>`;
}

function profileRow(kind, x) {
  const photoKey = `${kind}:${x.id}:photo`;
  const src = x.photo ? blobUrl(photoKey, x.photo) : '';
  const media = src
    ? `<img class="avatar" loading="lazy" alt="" src="${src}">`
    : `<div class="avatar avatar-text">${esc(initials(x.name))}</div>`;

  const summary = activitySummary(x);
  const pills = [
    x.age ? pill('Age ' + x.age) : '',
    pill(stageLabel(stageOf(x)), 'stage-' + stageOf(x)),
    isWaiting(x) ? pill('Waiting', 'warn') : '',
    ...tagsOf(x).slice(0, 2).map(t => pill(t, 'tag'))
  ].filter(Boolean).join('');

  const sentTo = resolveShadchan(x);
  const rel = sentTo.length
    ? `<div class="row-sub">With ${esc(sentTo.slice(0, 2).map(s => s.name).join(', '))}${sentTo.length > 2 ? ` +${sentTo.length - 2}` : ''}</div>`
    : '';

  return `
    <article class="row${isWaiting(x) ? ' row-waiting' : ''}" data-kind="${kind}" data-id="${esc(x.id)}" tabindex="0">
      ${media}
      <div class="row-body">
        <div class="row-title">${esc(x.name || 'Unnamed profile')}</div>
        <div class="row-pills">${pills}</div>
        ${rel}
        <div class="row-sub row-last"><span>${esc(summary.text.slice(0, 70))}</span><b>${esc(relativeDay(summary.ms))}</b></div>
      </div>
      <div class="row-chev" aria-hidden="true">&rsaquo;</div>
    </article>`;
}

function shadchanRow(x) {
  const summary = activitySummary(x);
  const due = callDueState(x);
  const pills = [
    due && due.days <= 1 ? pill(due.label, 'warn') : '',
    isWaiting(x) ? pill('Waiting', 'warn') : '',
    ...tagsOf(x).slice(0, 3).map(t => pill(t, 'tag'))
  ].filter(Boolean).join('');

  const phone = displayPhone(x.phone);

  return `
    <article class="row${isWaiting(x) || (due && due.days <= 0) ? ' row-waiting' : ''}" data-kind="shadchanim" data-id="${esc(x.id)}" tabindex="0">
      <div class="avatar avatar-text">${esc(initials(x.name))}</div>
      <div class="row-body">
        <div class="row-title">${esc(x.name || 'Unnamed shadchan')}</div>
        ${pills ? `<div class="row-pills">${pills}</div>` : ''}
        ${phone ? `<div class="row-sub">${esc(phone)}</div>` : ''}
        <div class="row-sub row-last"><span>${esc(summary.text.slice(0, 70))}</span><b>${esc(relativeDay(summary.ms))}</b></div>
      </div>
      <div class="row-chev" aria-hidden="true">&rsaquo;</div>
    </article>`;
}

export const renderRow = (kind, x) => (kind === 'shadchanim' ? shadchanRow(x) : profileRow(kind, x));

/* ---------- list rendering ---------- */

export function renderList(kind, mount, onOpen) {
  const st = listState[kind];
  const { rows, view, sortKey } = selectRecords(kind);

  /* Photos for rows that fell out of the window are released, so scrolling a
     long list does not accumulate blob URLs the way PeerMatch's did. */
  releaseScope(`${kind}:`);

  if (!rows.length) {
    mount.innerHTML = `<div class="empty">${esc(view.empty || 'Nothing here yet.')}</div>`;
    return { shown: 0, total: 0 };
  }

  const windowed = rows.slice(0, st.limit);
  const groups = groupsFor(kind, windowed, sortKey);

  mount.innerHTML = groups.map(g => `
    ${g.label ? `<h3 class="group-head"><span>${esc(g.label)}</span><i>${g.rows.length}</i></h3>` : ''}
    ${g.rows.map(x => renderRow(kind, x)).join('')}
  `).join('') + (rows.length > windowed.length
    ? `<button class="btn btn-soft btn-full" data-more="1">Show ${Math.min(PAGE, rows.length - windowed.length)} more of ${rows.length}</button>`
    : '');

  mount.querySelectorAll('.row').forEach(el => {
    const open = () => onOpen(el.dataset.kind, el.dataset.id);
    el.onclick = open;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });

  const more = mount.querySelector('[data-more]');
  if (more) more.onclick = () => { st.limit += PAGE; renderList(kind, mount, onOpen); };

  return { shown: windowed.length, total: rows.length };
}
