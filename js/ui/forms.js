/* ZivugBase - add and edit forms. */

import { data, save, find } from '../core/store.js';
import { esc } from '../core/format.js';
import { invalidateSearch, STAGES, stageOf } from '../core/model.js';
import { openSheet, closeSheet, toast, confirmSheet } from './sheet.js';
import { bus } from '../core/bus.js';

const field = (id, label, value = '', type = 'text', placeholder = '') => `
  <div class="field">
    <label for="${id}">${esc(label)}</label>
    <input id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">
  </div>`;

const area = (id, label, value = '', placeholder = '') => `
  <div class="field">
    <label for="${id}">${esc(label)}</label>
    <textarea id="${id}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
  </div>`;

const val = (root, id) => root.querySelector('#' + id)?.value.trim() ?? '';

/* ---------- Shadchan ---------- */

export function shadchanForm(id = null) {
  const x = id ? find('shadchanim', id) : null;
  openSheet(`
    <h2>${x ? 'Edit shadchan' : 'Add shadchan'}</h2>
    ${field('f-name', 'Name', x?.name)}
    ${field('f-phone', 'Phone', x?.phone, 'tel')}
    ${field('f-email', 'Email', x?.email, 'email')}
    ${field('f-tags', 'Tags', x?.tags, 'text', 'Chabad, Israel, older singles')}
    <div class="actions-2">
      <button class="btn btn-primary" data-save>Save</button>
      <button class="btn btn-soft" data-cancel>Cancel</button>
    </div>
    ${x ? '<button class="btn btn-danger btn-full" data-delete>Delete shadchan</button>' : ''}`,
  root => {
    root.querySelector('[data-save]').onclick = async () => {
      const name = val(root, 'f-name');
      if (!name) return toast('Enter a name.');
      const target = x || { id: Date.now(), activities: [] };
      Object.assign(target, {
        name,
        phone: val(root, 'f-phone'),
        email: val(root, 'f-email'),
        tags: val(root, 'f-tags')
      });
      if (!x) data.shadchanim.unshift(target);
      invalidateSearch(target);
      await save();
      closeSheet();
      bus.emit('data:changed');
      bus.emit('detail:open', { kind: 'shadchanim', id: target.id });
    };
    root.querySelector('[data-cancel]').onclick = closeSheet;
    root.querySelector('[data-delete]')?.addEventListener('click', () => deleteRecord('shadchanim', x));
    root.querySelector('#f-name').focus();
  });
}

/* ---------- Guy / Girl ---------- */

export function profileForm(kind, id = null) {
  const x = id ? find(kind, id) : null;
  const noun = kind === 'guys' ? 'guy' : 'girl';

  openSheet(`
    <h2>${x ? 'Edit ' + noun : 'Add ' + noun}</h2>
    ${area('f-text', 'Full profile', x?.text, 'Paste the whole shidduch profile here')}
    ${field('f-name', 'Name', x?.name, 'text', 'Leave blank to use the first line')}
    ${field('f-age', 'Age', x?.age)}
    ${field('f-level', 'Religious level', x?.religiousLevel)}
    ${area('f-looking', 'Looking for', x?.lookingFor)}
    ${field('f-maxage', 'To what age', x?.lookingForMaxAge)}
    ${field('f-source', 'Who sent it', x?.sourceName || x?.source)}
    ${field('f-sourcephone', 'Their phone', x?.sourcePhone, 'tel')}
    ${field('f-tags', 'Tags', x?.tags, 'text', 'Chabad, Israel, learning')}
    <div class="field">
      <label for="f-photo">Photo</label>
      <input id="f-photo" type="file" accept="image/*">
    </div>
    <div class="field">
      <label>Stage</label>
      <div class="chips" id="f-stage">${STAGES.map(s =>
        `<button type="button" class="chip${(x ? stageOf(x) : 'new') === s.id ? ' is-on' : ''}" data-stage="${s.id}">${esc(s.label)}</button>`
      ).join('')}</div>
    </div>
    <div class="actions-2">
      <button class="btn btn-primary" data-save>Save</button>
      <button class="btn btn-soft" data-cancel>Cancel</button>
    </div>
    ${x ? `<button class="btn btn-danger btn-full" data-delete>Delete ${noun}</button>` : ''}`,
  root => {
    let stage = x ? stageOf(x) : 'new';
    root.querySelectorAll('#f-stage .chip').forEach(btn => {
      btn.onclick = () => {
        stage = btn.dataset.stage;
        root.querySelectorAll('#f-stage .chip').forEach(b => b.classList.toggle('is-on', b === btn));
      };
    });

    root.querySelector('[data-save]').onclick = async () => {
      const text = val(root, 'f-text');
      if (!text && !val(root, 'f-name')) return toast('Add a name or some profile text.');
      const target = x || { id: Date.now(), activities: [] };
      const photo = root.querySelector('#f-photo').files?.[0] || null;

      Object.assign(target, {
        text,
        name: val(root, 'f-name') || (text.split(/\r?\n/).map(s => s.trim()).find(Boolean) || noun).slice(0, 70),
        age: val(root, 'f-age'),
        religiousLevel: val(root, 'f-level'),
        lookingFor: val(root, 'f-looking'),
        lookingForMaxAge: val(root, 'f-maxage'),
        sourceName: val(root, 'f-source'),
        sourcePhone: val(root, 'f-sourcephone'),
        tags: val(root, 'f-tags'),
        stage
      });
      if (photo) target.photo = photo;
      if (!x) data[kind].unshift(target);
      invalidateSearch(target);
      await save();
      closeSheet();
      bus.emit('data:changed');
      bus.emit('detail:open', { kind, id: target.id });
    };
    root.querySelector('[data-cancel]').onclick = closeSheet;
    root.querySelector('[data-delete]')?.addEventListener('click', () => deleteRecord(kind, x));
    root.querySelector('#f-text').focus();
  });
}

function deleteRecord(kind, x) {
  confirmSheet(
    `Delete ${esc(x.name || 'this record')}?`,
    'This removes the record and all of its history from this device. It cannot be undone.',
    async () => {
      data[kind] = data[kind].filter(r => String(r.id) !== String(x.id));
      await save();
      closeSheet();
      bus.emit('data:changed');
      toast('Deleted.');
    },
    'Yes, delete', 'No, keep it'
  );
}
