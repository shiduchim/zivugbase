/* ZivugBase - the single modal sheet.

   One owner, one element, one close path. PeerMatch had several overlapping
   sheet implementations at different z-indexes, which is why popups sometimes
   opened behind each other. */

import { releaseScope } from '../core/blobs.js';

let stack = [];

function el() { return document.getElementById('sheet'); }
function shade() { return document.getElementById('modal'); }

export function openSheet(html, onMount) {
  stack.push({ html, onMount });
  paint();
}

export function replaceSheet(html, onMount) {
  stack[stack.length - 1] = { html, onMount };
  paint();
}

export function closeSheet() {
  stack.pop();
  if (!stack.length) {
    shade().classList.add('hidden');
    el().innerHTML = '';
    releaseScope('sheet:');
    document.body.classList.remove('sheet-open');
    return;
  }
  paint();
}

export function closeAllSheets() {
  stack = [];
  shade().classList.add('hidden');
  el().innerHTML = '';
  releaseScope('sheet:');
  document.body.classList.remove('sheet-open');
}

function paint() {
  const top = stack[stack.length - 1];
  if (!top) return;
  releaseScope('sheet:');
  el().innerHTML = top.html;
  el().scrollTop = 0;
  shade().classList.remove('hidden');
  document.body.classList.add('sheet-open');
  top.onMount?.(el());
}

export function initSheet() {
  shade().onclick = e => { if (e.target === shade()) closeSheet(); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && stack.length) closeSheet();
  });
}

/* A Yes / No confirmation. The house style avoids X / cross symbols for
   choices, so both options are always spelled out. */
export function confirmSheet(title, body, onYes, yesLabel = 'Yes', noLabel = 'No') {
  openSheet(`
    <h2>${title}</h2>
    <p class="muted">${body}</p>
    <div class="actions-2">
      <button class="btn btn-primary" data-yes>${yesLabel}</button>
      <button class="btn btn-soft" data-no>${noLabel}</button>
    </div>`, root => {
    root.querySelector('[data-yes]').onclick = async () => { closeSheet(); await onYes(); };
    root.querySelector('[data-no]').onclick = closeSheet;
  });
}

export function toast(message) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}
