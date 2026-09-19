/* ZivugBase - the Today screen.

   Every CRM opens on a dashboard rather than on a raw object list. PeerMatch
   opened on the Shadchanim list and hid its two real signals (calls due,
   waiting for reply) behind small coloured badges. Those signals are the whole
   screen here. */

import { esc, relativeDay, initials } from '../core/format.js';
import { dashboard, stageCounts, STAGES, lastActivityMs } from '../core/model.js';
import { listOf } from '../core/store.js';

function card(title, rows, emptyText) {
  return `
    <section class="panel">
      <h3 class="panel-head"><span>${esc(title)}</span><i>${rows.length}</i></h3>
      ${rows.length ? rows.join('') : `<div class="empty small">${esc(emptyText)}</div>`}
    </section>`;
}

const row = (kind, r, right, tone = '') => `
  <button class="mini-row${tone ? ' ' + tone : ''}" data-goto="${kind}:${esc(r.id)}">
    <span class="mini-avatar">${esc(initials(r.name))}</span>
    <b>${esc(r.name || 'Unnamed')}</b>
    <span>${esc(right)}</span>
  </button>`;

export function renderToday(mount, onOpen) {
  const { calls, waiting, stale, recent } = dashboard();

  const totals = {
    guys: listOf('guys').length,
    girls: listOf('girls').length,
    shadchanim: listOf('shadchanim').length
  };

  const pipeline = ['guys', 'girls'].map(kind => {
    const counts = stageCounts(kind);
    return `
      <div class="pipe">
        <h4>${kind === 'guys' ? 'Guys' : 'Girls'}</h4>
        <div class="pipe-bars">${STAGES.map(s => {
          const n = counts.get(s.id) || 0;
          const pct = totals[kind] ? Math.round((n / totals[kind]) * 100) : 0;
          return `<div class="pipe-bar" title="${esc(s.label)}: ${n}">
            <i style="height:${Math.max(pct, n ? 6 : 2)}%" class="stage-${s.id}"></i>
            <u>${n}</u>
          </div>`;
        }).join('')}</div>
        <div class="pipe-labels">${STAGES.map(s => `<span>${esc(s.label.split(' ')[0])}</span>`).join('')}</div>
      </div>`;
  }).join('');

  mount.innerHTML = `
    <div class="stat-row">
      <div class="stat"><b>${totals.guys}</b><span>Guys</span></div>
      <div class="stat"><b>${totals.girls}</b><span>Girls</span></div>
      <div class="stat"><b>${totals.shadchanim}</b><span>Shadchanim</span></div>
    </div>

    ${card('Calls due', calls.map(c =>
      row('shadchanim', c.shadchan, c.due.label, c.due.days < 0 ? 'is-warn' : 'is-warn')
    ), 'Nothing to call today.')}

    ${card('Waiting on a reply', waiting.slice(0, 10).map(w =>
      row(w.kind, w.record, 'Since ' + relativeDay(lastActivityMs(w.record)), 'is-warn')
    ), 'Nothing is waiting.')}

    ${card('Going stale', stale.slice(0, 10).map(s =>
      row(s.kind, s.record, s.days + ' days quiet')
    ), 'Everything active is fresh.')}

    <section class="panel">
      <h3 class="panel-head"><span>Pipeline</span></h3>
      ${pipeline}
    </section>

    ${card('Recent activity', recent.map(r =>
      row(r.kind, r.record, relativeDay(r.ms))
    ), 'No activity recorded yet.')}`;

  mount.querySelectorAll('[data-goto]').forEach(btn => {
    btn.onclick = () => {
      const [kind, id] = btn.dataset.goto.split(':');
      onOpen(kind, id);
    };
  });
}
