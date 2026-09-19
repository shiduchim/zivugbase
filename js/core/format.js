/* ZivugBase - formatting and escaping helpers. Pure functions, no DOM state. */

export const esc = s => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const DAY = 86400000;

/* Display stamp kept identical in spirit to the PeerMatch `stamp()` so restored
   records and newly written ones read the same way in History. */
export function stamp(ms = Date.now()) {
  return new Date(ms).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/* PeerMatch wrote activity timestamps as locale strings only, which cannot be
   sorted or used for staleness maths. Every activity we write carries `tsMs`;
   for legacy rows we parse `ts` once and fall back to the numeric id, which was
   `Date.now()` at creation time in every PeerMatch version. */
export function activityMs(a) {
  if (!a) return 0;
  if (Number.isFinite(a.tsMs)) return a.tsMs;
  const parsed = Date.parse(a.ts);
  if (Number.isFinite(parsed)) return parsed;
  const id = Number(a.id);
  return Number.isFinite(id) && id > 1e11 ? id : 0;
}

export function daysSince(ms) {
  if (!ms) return Infinity;
  return Math.floor((Date.now() - ms) / DAY);
}

export function relativeDay(ms) {
  if (!ms) return 'Never';
  const d = daysSince(ms);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return d + ' days ago';
  if (d < 14) return 'Last week';
  if (d < 60) return Math.floor(d / 7) + ' weeks ago';
  return Math.floor(d / 30) + ' months ago';
}

export function isoDay(ms = Date.now()) {
  const d = new Date(ms), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const digits = s => String(s || '').replace(/\D/g, '');

/* Israeli numbers display and dial in local form; everything else is preserved
   as entered so +1 and other international numbers keep working. */
export function displayPhone(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let d = digits(s);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) {
    const n = d.slice(3).replace(/^0/, '');
    if (n.length >= 8) return '0' + n;
  }
  return s;
}

export function dialPhone(raw) {
  const shown = displayPhone(raw);
  return shown.startsWith('0') ? digits(shown) : shown;
}

/* WhatsApp always needs an international msisdn with no plus. */
export function waPhone(raw) {
  let d = digits(raw);
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) return d;
  if (d.startsWith('0')) return '972' + d.slice(1);   /* local Israeli */
  return d;                                            /* already international */
}

export const initials = name => String(name || '?')
  .split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
