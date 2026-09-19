/* ZivugBase - Guy / Girl / Shadchan detail.

   Section order follows the established PeerMatch layout so the app still
   reads the way the user expects:

     1. Header: name, photo, meta, with the blessing above Edit, top right
     2. Last call status banner, when a call note exists
     3. CRM status strip (stage, waiting, follow-up) - new in ZivugBase
     4. Profile text
     5. Looking for / To what age
     6. Attachment
     7. Contacts
     8. Relationships - new in ZivugBase
     9. Quick details
    10. History
    11. Added-to date near the bottom
*/

import { find } from '../core/store.js';
import { esc, relativeDay, displayPhone, initials, stamp, activityMs } from '../core/format.js';
import { blobUrl } from '../core/blobs.js';
import {
  stageOf, stageLabel, STAGES, tagsOf, lastCallNote, isWaiting,
  callDueState, resolveShadchan, profilesForShadchan, tierOf, lastActivityMs
} from '../core/model.js';
import { contactBar, runContact } from './contact.js';
import { addActivity, deleteActivity, setField } from './activity.js';
import { openSheet, replaceSheet, closeSheet, confirmSheet, toast } from './sheet.js';
import { bus } from '../core/bus.js';

/* ---------- shared fragments ---------- */

function callBanner(x) {
  const note = lastCallNote(x);
  if (!note) return '';
  const answered = note.answered ? 'Answered' : 'No answer';
  return `
    <div class="banner ${note.answered ? 'banner-ok' : 'banner-warn'}">
      <b>Last call: ${esc(answered)}</b>
      <span>${esc(relativeDay(activityMs(note)))}</span>
      ${note.text ? `<div class="banner-note">${esc(note.text)}</div>` : ''}
    </div>`;
}

function statusStrip(kind, x) {
  const stage = stageOf(x);
  const due = callDueState(x);
  const stageChips = kind === 'shadchanim' ? '' : `
    <div class="field">
      <label>Stage</label>
      <div class="chips">${STAGES.map(s =>
        `<button class="chip${s.id === stage ? ' is-on' : ''}" data-stage="${s.id}" title="${esc(s.hint)}">${esc(s.label)}</button>`
      ).join('')}</div>
    </div>`;

  return `
    <div class="card card-status">
      ${stageChips}
      <div class="field">
        <label>Waiting for a reply?</label>
        <div class="chips">
          <button class="chip chip-wait${isWaiting(x) ? ' is-on' : ''}" data-waiting="yes">Yes</button>
          <button class="chip${isWaiting(x) ? '' : ' is-on'}" data-waiting="no">No</button>
        </div>
      </div>
      ${kind === 'shadchanim' ? `
      <div class="field">
        <label>Call follow-up${due ? ` &middot; <b class="${due.days <= 0 ? 'warn-text' : ''}">${esc(due.label)}</b>` : ''}</label>
        <div class="chips">
          <button class="chip" data-remind="0">Today</button>
          <button class="chip" data-remind="1">Tomorrow</button>
          <button class="chip" data-remind="7">Next week</button>
          ${due ? '<button class="chip chip-clear" data-remind="clear">Clear</button>' : ''}
        </div>
      </div>` : ''}
      ${tagsOf(x).length ? `<div class="field"><label>Tags</label><div class="row-pills">${
        tagsOf(x).map(t => `<span class="pill pill-tag">${esc(t)}</span>`).join('')}</div></div>` : ''}
    </div>`;
}

function historyBlock(x) {
  const acts = [...(x.activities || [])].sort((a, b) => activityMs(b) - activityMs(a));
  if (!acts.length) return '<div class="empty">No history yet.</div>';

  return acts.map(a => {
    const label =
      a.type === 'audio' ? 'Audio note' :
      a.type === 'call-note' ? `Call note &middot; ${a.answered ? 'Answered' : 'No answer'}` :
      a.type === 'action' ? esc(a.action) : 'Note';

    const audio = a.audio ? `<audio controls preload="none" src="${blobUrl('sheet:act:' + a.id, a.audio)}"></audio>` : '';
    const body = a.text ? `<div class="pre">${esc(a.text)}</div>` : '';

    return `
      <div class="event">
        <div class="event-top">
          <span>${label}</span>
          <span>${esc(a.ts || stamp(activityMs(a)))}</span>
        </div>
        ${body}${audio}
        <button class="link-btn" data-del-act="${esc(a.id)}">Delete</button>
      </div>`;
  }).join('');
}

function relationshipBlock(kind, x) {
  if (kind === 'shadchanim') {
    const { guys, girls } = profilesForShadchan(x.id);
    const total = guys.length + girls.length;
    if (!total) return '<div class="empty">No profiles linked to this shadchan yet.</div>';
    const row = (k, r) => `<button class="mini-row" data-goto="${k}:${esc(r.id)}">
        <b>${esc(r.name || 'Unnamed')}</b>
        <span>${esc(stageLabel(stageOf(r)))} &middot; ${esc(relativeDay(lastActivityMs(r)))}</span>
      </button>`;
    return `
      ${guys.length ? `<h4 class="mini-head">Guys (${guys.length})</h4>${guys.map(r => row('guys', r)).join('')}` : ''}
      ${girls.length ? `<h4 class="mini-head">Girls (${girls.length})</h4>${girls.map(r => row('girls', r)).join('')}` : ''}`;
  }

  const shadchanim = resolveShadchan(x);
  if (!shadchanim.length) return '<div class="empty">Not linked to a shadchan yet.</div>';
  return shadchanim.map(s => `
    <button class="mini-row" data-goto="shadchanim:${esc(s.id)}">
      <b>${esc(s.name || 'Unnamed')}</b>
      <span>${esc(tierOf(s).label)} &middot; ${esc(relativeDay(lastActivityMs(s)))}</span>
    </button>`).join('');
}

function section(title, body, extra = '') {
  return `<div class="section"><h3 class="section-title">${esc(title)}${extra}</h3>${body}</div>`;
}

/* ---------- detail screens ---------- */

/* `replace` swaps the current sheet in place instead of stacking a new one.
   Re-rendering after an edit must replace, or every stage tap and saved note
   would add another layer the user has to dismiss one by one. Navigating to a
   RELATED record still pushes, so closing it returns to where you came from. */
export function openDetail(kind, id, { replace = false } = {}) {
  const x = find(kind, id);
  if (!x) { toast('That record no longer exists.'); return; }
  kind === 'shadchanim' ? paintShadchan(x, replace) : paintProfile(kind, x, replace);
}

function paintProfile(kind, x, replace = false) {
  const photo = x.photo ? blobUrl('sheet:photo:' + x.id, x.photo) : '';
  const shot = x.profileImage ? blobUrl('sheet:shot:' + x.id, x.profileImage) : '';
  const added = Number(x.id) > 1e11 ? new Date(Number(x.id)).toLocaleDateString() : '';

  const html = `
    <header class="detail-head">
      <div class="detail-id">
        ${photo ? `<img class="detail-photo" alt="" src="${photo}">` : `<div class="detail-photo detail-photo-text">${esc(initials(x.name))}</div>`}
        <div>
          <h2>${esc(x.name || 'Unnamed profile')}</h2>
          <div class="muted">${[x.age ? 'Age ' + x.age : '', x.religiousLevel, x.sourceName || x.source ? 'From ' + (x.sourceName || x.source) : '']
            .filter(Boolean).map(esc).join(' &middot; ')}</div>
        </div>
      </div>
      <div class="detail-edit">
        <div class="bh">&#1489;&#8221;&#1492;</div>
        <button class="btn btn-soft btn-sm" data-edit>Edit</button>
      </div>
    </header>

    ${callBanner(x)}
    ${statusStrip(kind, x)}

    ${section('Profile', `<div class="card"><div class="pre">${esc(x.text || 'No profile text yet.')}</div></div>`)}

    ${(x.lookingFor || x.lookingForMaxAge) ? section('Looking for', `<div class="card">
      ${x.lookingFor ? `<div class="pre">${esc(x.lookingFor)}</div>` : ''}
      ${x.lookingForMaxAge ? `<div class="muted">To what age: ${esc(x.lookingForMaxAge)}</div>` : ''}
    </div>`) : ''}

    ${x.profileAttachmentName ? section('Attachment', `<div class="card"><div class="muted">${esc(x.profileAttachmentName)}</div></div>`) : ''}
    ${shot ? section('Screenshot', `<div class="card"><img class="shot" alt="" src="${shot}"></div>`) : ''}

    ${section('Contacts', contactBar(x) + [
      [x.contact1Name, x.contact1Phone], [x.contact2Name, x.contact2Phone]
    ].filter(([, p]) => p).map(([n, p]) =>
      `<div class="mini-row static"><b>${esc(n || 'Contact')}</b><span>${esc(displayPhone(p))}</span></div>`).join(''))}

    ${section('Shadchanim', relationshipBlock(kind, x))}

    ${section('History', historyBlock(x))}

    <div class="actions-2">
      <button class="btn btn-soft" data-note>Add note</button>
      <button class="btn btn-soft" data-audio>Record audio</button>
    </div>

    ${added ? `<p class="muted added">Added to ZivugBase ${esc(added)}</p>` : ''}
    <button class="btn btn-soft btn-full" data-close>Close</button>`;

  (replace ? replaceSheet : openSheet)(html, root => wire(root, kind, x));
}

function paintShadchan(x, replace = false) {
  const added = Number(x.id) > 1e11 ? new Date(Number(x.id)).toLocaleDateString() : '';

  const html = `
    <header class="detail-head">
      <div class="detail-id">
        <div class="detail-photo detail-photo-text">${esc(initials(x.name))}</div>
        <div>
          <h2>${esc(x.name || 'Unnamed shadchan')}</h2>
          <div class="muted">${esc(tierOf(x).label)} &middot; ${esc(relativeDay(lastActivityMs(x)))}</div>
        </div>
      </div>
      <div class="detail-edit">
        <div class="bh">&#1489;&#8221;&#1492;</div>
        <button class="btn btn-soft btn-sm" data-edit>Edit</button>
      </div>
    </header>

    ${callBanner(x)}
    ${section('Contact', contactBar(x) + `
      ${x.phone ? `<div class="mini-row static"><b>Phone</b><span>${esc(displayPhone(x.phone))}</span></div>` : ''}
      ${x.email ? `<div class="mini-row static"><b>Email</b><span>${esc(x.email)}</span></div>` : ''}`)}

    ${statusStrip('shadchanim', x)}
    ${section('Profiles with this shadchan', relationshipBlock('shadchanim', x))}
    ${section('History', historyBlock(x))}

    <div class="actions-2">
      <button class="btn btn-soft" data-note>Add note</button>
      <button class="btn btn-soft" data-audio>Record audio</button>
    </div>

    ${added ? `<p class="muted added">Added to ZivugBase ${esc(added)}</p>` : ''}
    <button class="btn btn-soft btn-full" data-close>Close</button>`;

  (replace ? replaceSheet : openSheet)(html, root => wire(root, 'shadchanim', x));
}

/* ---------- wiring ---------- */

function wire(root, kind, x) {
  const refresh = () => openDetail(kind, x.id, { replace: true });

  root.querySelector('[data-close]').onclick = closeSheet;
  root.querySelector('[data-edit]').onclick = () => bus.emit('edit:open', { kind, id: x.id });

  root.querySelectorAll('[data-contact]').forEach(btn => {
    btn.onclick = () => runContact(x, btn.dataset.contact);
  });

  root.querySelectorAll('[data-stage]').forEach(btn => {
    btn.onclick = async () => {
      await setField(x, 'stage', btn.dataset.stage);
      await addActivity(x, { type: 'text', text: 'Stage set to ' + stageLabel(btn.dataset.stage) });
      refresh();
    };
  });

  root.querySelectorAll('[data-waiting]').forEach(btn => {
    btn.onclick = async () => {
      await setField(x, 'waitingForReply', btn.dataset.waiting === 'yes');
      refresh();
    };
  });

  root.querySelectorAll('[data-remind]').forEach(btn => {
    btn.onclick = async () => {
      const v = btn.dataset.remind;
      if (v === 'clear') {
        await setField(x, 'callReminderDate', '');
      } else {
        const d = new Date();
        d.setDate(d.getDate() + Number(v));
        d.setHours(0, 0, 0, 0);
        await setField(x, 'callReminderDate', d.toISOString());
      }
      refresh();
    };
  });

  root.querySelectorAll('[data-goto]').forEach(btn => {
    btn.onclick = () => {
      const [k, id] = btn.dataset.goto.split(':');
      openDetail(k, id);
    };
  });

  root.querySelectorAll('[data-del-act]').forEach(btn => {
    btn.onclick = () => confirmSheet(
      'Delete this history entry?',
      'It will be removed from this record permanently.',
      async () => { await deleteActivity(x, btn.dataset.delAct); refresh(); toast('History entry deleted.'); },
      'Yes, delete', 'No, keep it'
    );
  });

  root.querySelector('[data-note]').onclick = () => noteSheet(kind, x);
  root.querySelector('[data-audio]').onclick = () => audioSheet(kind, x);
}

function noteSheet(kind, x) {
  openSheet(`
    <h2>Add note</h2>
    <textarea id="note-text" placeholder="What happened?"></textarea>
    <div class="actions-2">
      <button class="btn btn-primary" data-save>Save note</button>
      <button class="btn btn-soft" data-cancel>Cancel</button>
    </div>`, root => {
    root.querySelector('[data-save]').onclick = async () => {
      const text = root.querySelector('#note-text').value.trim();
      if (!text) return;
      await addActivity(x, { type: 'text', text });
      closeSheet();
      openDetail(kind, x.id, { replace: true });
    };
    root.querySelector('[data-cancel]').onclick = closeSheet;
    root.querySelector('#note-text').focus();
  });
}

function audioSheet(kind, x) {
  let recorder = null, chunks = [], stream = null;

  openSheet(`
    <h2>Record audio note</h2>
    <p class="muted" id="rec-state">Tap record to start.</p>
    <div class="actions-2">
      <button class="btn btn-primary" data-rec>Record</button>
      <button class="btn btn-soft" data-cancel>Cancel</button>
    </div>`, root => {
    const state = root.querySelector('#rec-state');
    const recBtn = root.querySelector('[data-rec]');

    const stop = () => {
      if (recorder && recorder.state === 'recording') recorder.stop();
      stream?.getTracks().forEach(t => t.stop());
    };

    recBtn.onclick = async () => {
      if (recorder && recorder.state === 'recording') { stop(); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (_) {
        state.textContent = 'Microphone permission is required.';
        return;
      }
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        await addActivity(x, { type: 'audio', audio: blob });
        closeSheet();
        openDetail(kind, x.id, { replace: true });
      };
      recorder.start();
      recBtn.textContent = 'Stop and save';
      state.textContent = 'Recording…';
    };

    root.querySelector('[data-cancel]').onclick = () => { stop(); closeSheet(); };
  });
}
