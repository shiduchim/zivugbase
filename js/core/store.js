/* ZivugBase - persistence.

   Deliberately the same IndexedDB database, stores and state shape as
   PeerMatch ('PeerMatchDB' v2, kv['state'] = {shadchanim, guys, girls}) so a
   PeerMatch backup restores here untouched and a ZivugBase backup restores
   back into PeerMatch. All ZivugBase additions are extra optional fields on
   existing records; nothing is renamed and nothing is dropped. */

import { bus } from './bus.js';

export const DB_NAME = 'PeerMatchDB';
export const DB_VERSION = 2;
export const KINDS = ['guys', 'girls', 'shadchanim'];

export let data = { shadchanim: [], guys: [], girls: [] };

export function db() {
  return new Promise((ok, no) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('inbox')) d.createObjectStore('inbox');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}

export async function get(store, key) {
  const d = await db();
  return new Promise((ok, no) => {
    const t = d.transaction(store, 'readonly'), r = t.objectStore(store).get(key);
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
}

export async function put(store, key, val) {
  const d = await db();
  return new Promise((ok, no) => {
    const t = d.transaction(store, 'readwrite');
    t.objectStore(store).put(val, key);
    t.oncomplete = ok; t.onerror = () => no(t.error);
  });
}

export async function del(store, key) {
  const d = await db();
  return new Promise((ok, no) => {
    const t = d.transaction(store, 'readwrite');
    t.objectStore(store).delete(key);
    t.oncomplete = ok; t.onerror = () => no(t.error);
  });
}

/* Unknown fields on old records are preserved: we only ever add. */
function normalise(state) {
  const out = (state && typeof state === 'object') ? state : {};
  for (const k of KINDS) {
    if (!Array.isArray(out[k])) out[k] = [];
    for (const x of out[k]) {
      if (!Array.isArray(x.activities)) x.activities = [];
      if (x.id == null) x.id = Date.now() + Math.floor(Math.random() * 1000);
    }
  }
  return out;
}

export async function load() {
  data = normalise(await get('kv', 'state'));
  bus.emit('data:loaded');
  return data;
}

let pending = null;
export function save() {
  /* Coalesce bursts of writes (e.g. a form saving several fields) into one
     IndexedDB round trip, but always resolve against a real completed put. */
  if (!pending) {
    pending = Promise.resolve().then(async () => {
      pending = null;
      await put('kv', 'state', data);
      bus.emit('data:saved');
    });
  }
  return pending;
}

export function replaceState(next) {
  data = normalise(next);
  bus.emit('data:loaded');
  return data;
}

export const listOf = kind => data[kind] || [];
export const find = (kind, id) => listOf(kind).find(x => String(x.id) === String(id)) || null;
