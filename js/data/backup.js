/* ZivugBase - backup and restore.

   Byte-compatible with PeerMatch's backup-v28 / v125 format on purpose:

     * a stored (uncompressed) ZIP containing data.json plus photos/, audio/
       and attachments/ media files;
     * Blobs encoded in the manifest as {__peerMatchFile:1, path, type, name};
     * Dates as {__peerMatchDate:1, value};
     * the emailed wrapper is 'PEERMATCH-BACKUP-TEXT-V1\n' + base64 of the
       exact ZIP bytes, because Android Chrome refused to share a real ZIP.

   That means a PeerMatch backup restores into ZivugBase, and a ZivugBase
   backup restores back into PeerMatch. Chunk sizes below preserve the v127
   base64 boundary fix: encode chunks must divide by 3, decode chunks by 4. */

import { db, data, replaceState, put } from '../core/store.js';
import { isoDay } from '../core/format.js';
import { downloadBlob } from '../core/blobs.js';

const FORMAT = 'PeerMatchBackup';
const VERSION = 2;
const TEXT_HEADER = 'PEERMATCH-BACKUP-TEXT-V1\n';
const te = new TextEncoder(), td = new TextDecoder();

/* ---------- ZIP primitives (stored, no deflate) ---------- */

const u16 = n => new Uint8Array([n & 255, (n >>> 8) & 255]);
const u32 = n => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[i] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(d) {
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, date };
}

function makeZip(entries) {
  const when = dosDateTime(new Date());
  const local = [], central = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = te.encode(e.name);
    const bytes = e.bytes;
    if (bytes.length > 0xffffffff) throw new Error('A file in this backup is too large for the ZIP format.');
    const crc = crc32(bytes);
    const head = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(when.time), ...u16(when.date),
      ...u32(crc), ...u32(bytes.length), ...u32(bytes.length), ...u16(nameBytes.length), ...u16(0), ...nameBytes
    ]);
    local.push(head, bytes);
    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(when.time), ...u16(when.date),
      ...u32(crc), ...u32(bytes.length), ...u32(bytes.length), ...u16(nameBytes.length),
      ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes
    ]));
    offset += head.length + bytes.length;
  }

  const centralBytes = central.reduce((n, p) => n + p.length, 0);
  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(centralBytes), ...u32(offset), ...u16(0)
  ]);
  return new Blob([...local, ...central, eocd], { type: 'application/zip' });
}

function parseZip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer), view = new DataView(arrayBuffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This does not look like a valid backup ZIP.');

  const count = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);
  const files = new Map();

  for (let i = 0; i < count; i++) {
    if (pos + 46 > bytes.length || view.getUint32(pos, true) !== 0x02014b50) throw new Error('The ZIP directory is damaged.');
    const method = view.getUint16(pos + 10, true);
    const expectedCrc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = td.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));

    if (method !== 0) throw new Error('This backup uses an unsupported compression method.');
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('The ZIP contains a damaged entry.');
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const end = start + size;
    if (end > bytes.length) throw new Error('A file inside the ZIP is incomplete.');
    const fileBytes = bytes.slice(start, end);
    if (crc32(fileBytes) !== expectedCrc) throw new Error('A file inside the ZIP failed its integrity check.');
    files.set(name, fileBytes);
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* ---------- base64 wrapper (v127 chunk boundaries preserved) ---------- */

function bytesToB64(bytes) {
  let out = '';
  const size = 0x6000;                       /* divisible by 3: no interior padding */
  for (let i = 0; i < bytes.length; i += size) {
    const part = bytes.subarray(i, Math.min(i + size, bytes.length));
    let s = '';
    for (let j = 0; j < part.length; j++) s += String.fromCharCode(part[j]);
    out += btoa(s);
  }
  return out;
}

function b64ToBytes(s) {
  const chunks = [], size = 0x100000;        /* divisible by 4: whole quartets */
  let total = 0;
  for (let i = 0; i < s.length; i += size) {
    const bin = atob(s.slice(i, i + size));
    const a = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) a[j] = bin.charCodeAt(j);
    chunks.push(a); total += a.length;
  }
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of chunks) { out.set(a, p); p += a.length; }
  return out;
}

/* ---------- encode / decode ---------- */

const cleanName = s => String(s || '').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80);

function extFor(blob, name) {
  const fromName = /\.[a-z0-9]{1,5}$/i.exec(String(name || ''));
  if (fromName) return fromName[0].toLowerCase();
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
    'audio/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/ogg': '.ogg',
    'audio/wav': '.wav', 'application/pdf': '.pdf', 'text/plain': '.txt'
  };
  return map[String(blob.type || '').split(';')[0]] || '';
}

async function readStore(d, name) {
  return new Promise((ok, no) => {
    const t = d.transaction(name, 'readonly'), s = t.objectStore(name);
    const kr = s.getAllKeys(), vr = s.getAll();
    t.oncomplete = () => ok({ keys: kr.result || [], values: vr.result || [] });
    t.onerror = () => no(t.error);
  });
}

export async function buildBackup() {
  const d = await db(), media = new Map(), seen = new WeakMap();
  let seq = 0;

  async function encode(v) {
    if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (v instanceof Blob) {
      if (seen.has(v)) return seen.get(v);
      const original = (typeof File !== 'undefined' && v instanceof File) ? v.name : '';
      const type = String(v.type || 'application/octet-stream');
      const folder = type.startsWith('image/') ? 'photos' : type.startsWith('audio/') ? 'audio' : 'attachments';
      const base = cleanName(original.replace(/\.[^.]+$/, '')) || String(++seq).padStart(6, '0');
      if (original) seq++;
      const path = `${folder}/${String(seq).padStart(6, '0')}_${base}${extFor(v, original)}`;
      const ref = {
        __peerMatchFile: 1, path, type, name: original,
        lastModified: (typeof File !== 'undefined' && v instanceof File) ? v.lastModified : 0
      };
      seen.set(v, ref);
      media.set(path, new Uint8Array(await v.arrayBuffer()));
      return ref;
    }
    if (v instanceof Date) return { __peerMatchDate: 1, value: v.toISOString() };
    if (Array.isArray(v)) { const a = []; for (const x of v) a.push(await encode(x)); return a; }
    if (typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) out[k] = await encode(val);
      return out;
    }
    return null;
  }

  const stores = {};
  for (const name of Array.from(d.objectStoreNames)) {
    const raw = await readStore(d, name), entries = [];
    for (let i = 0; i < raw.keys.length; i++) {
      entries.push({ key: await encode(raw.keys[i]), value: await encode(raw.values[i]) });
    }
    stores[name] = entries;
  }

  const counts = {
    shadchanim: (data.shadchanim || []).length,
    guys: (data.guys || []).length,
    girls: (data.girls || []).length,
    notes: [...(data.shadchanim || []), ...(data.guys || []), ...(data.girls || [])]
      .reduce((n, x) => n + (x.activities || []).length, 0)
  };

  const manifest = {
    format: FORMAT, version: VERSION, createdAt: new Date().toISOString(),
    appVersion: document.documentElement.dataset.zivugBaseVersion || '',
    database: 'PeerMatchDB', databaseVersion: 2, counts, stores
  };

  const files = [
    { name: 'data.json', bytes: te.encode(JSON.stringify(manifest, null, 2)) },
    { name: 'photos/.keep', bytes: new Uint8Array(0) },
    { name: 'audio/.keep', bytes: new Uint8Array(0) },
    { name: 'attachments/.keep', bytes: new Uint8Array(0) }
  ];
  for (const [name, bytes] of media) files.push({ name, bytes });

  return { zip: makeZip(files), manifest };
}

async function decode(v, files) {
  if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) { const a = []; for (const x of v) a.push(await decode(x, files)); return a; }
  if (typeof v === 'object' && v.__peerMatchFile) {
    const bytes = files.get(v.path);
    if (!bytes) throw new Error('The backup is missing ' + v.path + '.');
    const opts = { type: v.type || 'application/octet-stream' };
    if (v.name && typeof File !== 'undefined') {
      try { return new File([bytes], v.name, { ...opts, lastModified: v.lastModified || Date.now() }); } catch (_) {}
    }
    return new Blob([bytes], opts);
  }
  if (typeof v === 'object' && v.__peerMatchDate) return new Date(v.value);
  if (typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = await decode(val, files);
    return out;
  }
  return v;
}

/* ---------- public API ---------- */

export const backupFilename = ext => `ZivugBase_Backup_${isoDay()}.${ext}`;

export async function saveBackupZip() {
  const { zip, manifest } = await buildBackup();
  downloadBlob(zip, backupFilename('zip'));
  return manifest;
}

export async function buildBackupText() {
  const { zip, manifest } = await buildBackup();
  const bytes = new Uint8Array(await zip.arrayBuffer());
  const file = new File([TEXT_HEADER, bytesToB64(bytes)], backupFilename('txt'),
    { type: 'text/plain', lastModified: Date.now() });
  return { file, manifest };
}

/* Accepts a real ZIP or the emailed PeerMatch/ZivugBase TXT wrapper. */
export async function readBackupFile(file) {
  let buffer;
  if (/\.txt$/i.test(file.name || '') || String(file.type || '').startsWith('text/')) {
    const text = await file.text();
    if (!text.startsWith(TEXT_HEADER)) throw new Error('That text file is not a backup wrapper.');
    buffer = b64ToBytes(text.slice(TEXT_HEADER.length).replace(/\s+/g, '')).buffer;
  } else {
    buffer = await file.arrayBuffer();
  }

  const files = parseZip(buffer);
  const manifestBytes = files.get('data.json');
  if (!manifestBytes) throw new Error('The backup has no data.json.');
  const manifest = JSON.parse(td.decode(manifestBytes));
  if (manifest?.format !== FORMAT) throw new Error('This is not a PeerMatch or ZivugBase backup.');
  if (Number(manifest.version) !== VERSION) throw new Error('This backup version is not supported.');
  return { manifest, files };
}

export async function restoreBackup(manifest, files) {
  const d = await db();
  const existing = Array.from(d.objectStoreNames);
  const names = Object.keys(manifest.stores || {}).filter(n => existing.includes(n));

  const decoded = {};
  for (const name of names) {
    decoded[name] = [];
    for (const entry of manifest.stores[name]) {
      decoded[name].push({ key: await decode(entry.key, files), value: await decode(entry.value, files) });
    }
  }

  /* Decode everything before touching the database, so a corrupt backup can
     never leave the app half-restored. */
  for (const name of names) {
    await new Promise((ok, no) => {
      const t = d.transaction(name, 'readwrite'), s = t.objectStore(name);
      s.clear();
      for (const { key, value } of decoded[name]) s.put(value, key);
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
  }

  const state = decoded.kv?.find(e => e.key === 'state')?.value;
  if (state) replaceState(state);
  return manifest.counts || {};
}
