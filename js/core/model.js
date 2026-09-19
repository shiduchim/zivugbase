/* ZivugBase - the CRM model layer.

   Everything here is DERIVED from records that already exist, or stored in new
   optional fields. No migration runs, no existing field changes meaning, and a
   record that has never been touched by ZivugBase still resolves to sensible
   values. */

import { listOf, KINDS } from './store.js';
import { activityMs, daysSince, digits } from './format.js';

/* ---------- Stages (the shidduch equivalent of a CRM deal pipeline) ---------- */

export const STAGES = [
  { id: 'new',       label: 'New',            hint: 'Profile just came in' },
  { id: 'collected', label: 'Profile ready',  hint: 'Full profile and photo on file' },
  { id: 'sent',      label: 'Sent out',       hint: 'Shared with one or more shadchanim' },
  { id: 'pending',   label: 'Awaiting answer',hint: 'Suggestion made, waiting on a reply' },
  { id: 'dating',    label: 'Dating',         hint: 'Currently going out' },
  { id: 'closed',    label: 'Closed',         hint: 'Engaged, paused, or not relevant' }
];
export const STAGE_IDS = STAGES.map(s => s.id);
export const stageLabel = id => STAGES.find(s => s.id === id)?.label || 'New';

/* A record with no stage is inferred rather than dumped into "New", so a
   restored PeerMatch backup lands in a meaningful pipeline immediately. */
export function stageOf(x) {
  if (x.stage && STAGE_IDS.includes(x.stage)) return x.stage;
  if (x.waitingForReply === true) return 'pending';
  if (sentToShadchanIds(x).length) return 'sent';
  if (String(x.text || '').trim().length > 80) return 'collected';
  return 'new';
}

/* ---------- Tags as facets, not a substring haystack ---------- */

export function tagsOf(x) {
  return String(x.tags || '')
    .split(/[,;]+/).map(t => t.trim()).filter(Boolean);
}

export function allTags(kind) {
  const counts = new Map();
  for (const x of listOf(kind)) {
    for (const t of tagsOf(x)) {
      const key = t.toLocaleLowerCase();
      const hit = counts.get(key) || { tag: t, count: 0 };
      hit.count++; counts.set(key, hit);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/* ---------- Activity-derived signals ---------- */

export function lastActivity(x) {
  let best = null, bestMs = 0;
  for (const a of x.activities || []) {
    const ms = activityMs(a);
    if (ms >= bestMs) { bestMs = ms; best = a; }
  }
  return { activity: best, ms: bestMs };
}

export const lastActivityMs = x => lastActivity(x).ms;
export const staleDays = x => daysSince(lastActivityMs(x));

export function lastCallNote(x) {
  const notes = (x.activities || []).filter(a => a.type === 'call-note');
  if (!notes.length) return null;
  return notes.reduce((a, b) => (activityMs(b) >= activityMs(a) ? b : a));
}

export function activitySummary(x) {
  const { activity, ms } = lastActivity(x);
  if (!activity) return { text: 'No contact yet', ms: 0 };
  const label =
    activity.type === 'audio' ? 'Audio note' :
    activity.type === 'call-note' ? (activity.text ? 'Call: ' + activity.text : 'Call note') :
    activity.type === 'action' ? activity.action :
    activity.text || 'Note';
  return { text: label, ms };
}

/* ---------- Relationships (the part that makes 100x100 navigable) ---------- */

const norm = s => String(s || '').trim().toLocaleLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/* PeerMatch recorded the originating shadchan across several fields depending
   on which version created the record, so all of them are read here. */
export function sentToShadchanIds(x) {
  const ids = new Set();
  for (const key of ['sourceShadchanId', 'sourceShadchanId2', 'linkedShadchanId', 'referredById']) {
    if (x[key] != null && x[key] !== '') ids.add(String(x[key]));
  }
  for (const a of x.activities || []) {
    if (a.shadchanId != null) ids.add(String(a.shadchanId));
  }
  return [...ids];
}

/* Fall back to matching by name/phone when no id was ever stored. */
export function resolveShadchan(x) {
  const ids = sentToShadchanIds(x);
  const out = [];
  const shadchanim = listOf('shadchanim');
  for (const id of ids) {
    const hit = shadchanim.find(s => String(s.id) === id);
    if (hit && !out.includes(hit)) out.push(hit);
  }
  if (!out.length) {
    const name = norm(x.sourceName || x.source || x.referredBy);
    const phone = digits(x.sourcePhone || x.sourcePhone2);
    for (const s of shadchanim) {
      if ((name && norm(s.name) === name) || (phone && phone.length >= 7 && digits(s.phone) === phone)) {
        if (!out.includes(s)) out.push(s);
      }
    }
  }
  return out;
}

/* Reverse edge: every guy/girl connected to this shadchan. */
export function profilesForShadchan(shadchanId) {
  const id = String(shadchanId);
  const out = { guys: [], girls: [] };
  for (const kind of ['guys', 'girls']) {
    for (const x of listOf(kind)) {
      if (sentToShadchanIds(x).includes(id) || resolveShadchan(x).some(s => String(s.id) === id)) {
        out[kind].push(x);
      }
    }
  }
  return out;
}

/* Shadchan tier, derived from real activity rather than typed in by hand. */
export function tierOf(s) {
  const n = (s.activities || []).length;
  const d = staleDays(s);
  if (d <= 30 && n >= 5) return { id: 'active', label: 'Active' };
  if (d <= 90) return { id: 'occasional', label: 'Occasional' };
  if (!Number.isFinite(d)) return { id: 'new', label: 'No contact yet' };
  return { id: 'dormant', label: 'Dormant' };
}

/* ---------- Follow-up state ---------- */

export function callDueState(s) {
  const raw = s.callReminderDate;
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  /* Compare whole calendar days. PeerMatch did not always store the reminder
     at midnight, so diffing raw timestamps made a reminder set yesterday
     afternoon round to "today". Both sides are floored to their own midnight. */
  const due = new Date(parsed); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { state: 'overdue', label: 'Overdue', days: diff };
  if (diff === 0) return { state: 'today', label: 'Call today', days: 0 };
  if (diff === 1) return { state: 'tomorrow', label: 'Call tomorrow', days: 1 };
  return { state: 'later', label: 'In ' + diff + ' days', days: diff };
}

export const isWaiting = x => x.waitingForReply === true;

/* ---------- Search index ---------- */

/* PeerMatch rebuilt a concatenated lowercase haystack for every record on
   every keystroke, including the full text of every activity. Here it is built
   once per record and cached until that record actually changes. */
const haystacks = new WeakMap();

export function haystack(x) {
  const cached = haystacks.get(x);
  const fingerprint = (x.activities || []).length + ':' + (x.name || '') + ':' + (x.tags || '') + ':' + String(x.text || '').length;
  if (cached && cached.fingerprint === fingerprint) return cached.value;
  const value = [
    x.name, x.age, x.text, x.tags, x.source, x.sourceName, x.sourcePhone,
    x.phone, x.email, x.religiousLevel, x.lookingFor,
    x.contact1Name, x.contact2Name,
    ...(x.activities || []).map(a => a.text || a.action || '')
  ].filter(Boolean).join(' ').toLocaleLowerCase();
  haystacks.set(x, { fingerprint, value });
  return value;
}

export function invalidateSearch(x) { haystacks.delete(x); }

/* ---------- Global counts for the Today screen ---------- */

export function dashboard() {
  const calls = listOf('shadchanim')
    .map(s => ({ shadchan: s, due: callDueState(s) }))
    .filter(r => r.due && r.due.days <= 0)
    .sort((a, b) => a.due.days - b.due.days);

  const waiting = [];
  for (const kind of KINDS) {
    for (const x of listOf(kind)) if (isWaiting(x)) waiting.push({ kind, record: x });
  }
  waiting.sort((a, b) => lastActivityMs(a.record) - lastActivityMs(b.record));

  const stale = [];
  for (const kind of ['guys', 'girls']) {
    for (const x of listOf(kind)) {
      const d = staleDays(x);
      const stage = stageOf(x);
      if (stage !== 'closed' && d >= 30) stale.push({ kind, record: x, days: d });
    }
  }
  stale.sort((a, b) => b.days - a.days);

  const recent = [];
  for (const kind of KINDS) {
    for (const x of listOf(kind)) {
      const ms = lastActivityMs(x);
      if (ms) recent.push({ kind, record: x, ms });
    }
  }
  recent.sort((a, b) => b.ms - a.ms);

  return { calls, waiting, stale, recent: recent.slice(0, 12) };
}

export function stageCounts(kind) {
  const counts = new Map(STAGE_IDS.map(id => [id, 0]));
  for (const x of listOf(kind)) counts.set(stageOf(x), (counts.get(stageOf(x)) || 0) + 1);
  return counts;
}
