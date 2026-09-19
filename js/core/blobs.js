/* ZivugBase - object URL lifecycle.

   PeerMatch's list renderer called URL.createObjectURL() per card on every
   render and never revoked, so each keystroke in the search box leaked one blob
   URL per visible photo. At 100 profiles that is thousands of retained blobs.
   Here every URL is keyed and reused, and a scope can be released wholesale
   when the screen that owns it goes away. */

const urls = new Map();   /* key -> {url, blob} */

export function blobUrl(key, blob) {
  if (!blob) return '';
  const hit = urls.get(key);
  if (hit && hit.blob === blob) return hit.url;
  if (hit) { try { URL.revokeObjectURL(hit.url); } catch (_) {} }
  const url = URL.createObjectURL(blob);
  urls.set(key, { url, blob });
  return url;
}

export function releaseScope(prefix) {
  for (const [key, hit] of urls) {
    if (!key.startsWith(prefix)) continue;
    try { URL.revokeObjectURL(hit.url); } catch (_) {}
    urls.delete(key);
  }
}

export function releaseAll() { releaseScope(''); }

/* Downloads are one-shot and must not be retained in the map at all. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 30000);
}
