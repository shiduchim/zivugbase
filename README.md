# ZivugBase

A CRM-structured shidduch relationship tracker. Browser/PWA, offline-first, all
data stays in IndexedDB on the device. Nothing is uploaded anywhere.

This is a **test rebuild** of PeerMatch's structure, built to answer one
question: what does the app need to look like when there are 100 shadchanim and
100 guys in it instead of fifteen?

## Why a rebuild rather than a patch

PeerMatch's runtime is 72 ordered scripts loaded through the service worker, of
which **seven** redefine `renderS()` and four redefine `renderP()`, each
wrapping the last. Adding saved views and grouping on top of that would mean an
eighth wrapper. The structural changes needed here touch list rendering
directly, so the list renderer became one module with an explicit pipeline.

**Data is fully compatible in both directions.** Same database (`PeerMatchDB`
v2), same stores, same `kv['state'] = {shadchanim, guys, girls}` shape, same
backup format. A PeerMatch backup restores into ZivugBase, and a ZivugBase
backup restores back into PeerMatch. Every ZivugBase addition is an extra
optional field; nothing is renamed, dropped, or migrated.

## What changed, and why

| Area | PeerMatch | ZivugBase | CRM precedent |
|---|---|---|---|
| Home screen | Opened on the Shadchanim list | **Today**: calls due, waiting, going stale, pipeline, recent | Every CRM opens on a dashboard |
| Views | Waiting and Calls hidden behind badge popups | First-class view chips on every list | HubSpot / Attio saved views |
| Sort | Insertion order only | Last contact, most neglected, A–Z, recently added | Pipedrive sorts by last touch |
| Grouping | One flat scroll | Collapsible sections by stage, tier, or letter | Pipedrive stage columns |
| Stage | None | 6-stage pipeline on Guys/Girls, inferred for old records | CRM deal stages |
| Tags | Free-text, substring-matched | Faceted chips with counts, tap to filter | Controlled vocabularies |
| Search | Rebuilt every card per keystroke | Debounced, cached per-record index, plus global search | Command-bar search |
| Relationships | Scattered across several files | Both directions surfaced on the detail screen | Contact ↔ deal association |
| Rendering | All records, every keystroke | 30-row window with "Show more" | List virtualization |
| Photos | A new blob URL per card per render, never revoked | Keyed, reused, scope-released | — |

### Timestamps

PeerMatch stored activity timestamps only as locale strings (`toLocaleString()`),
which cannot be sorted or used for staleness arithmetic. Every activity written
here carries both the original display `ts` **and** a numeric `tsMs`. Legacy rows
fall back to parsing `ts`, then to the numeric `id` (which was `Date.now()` in
every PeerMatch version). Nothing is rewritten on load.

## Architecture

```
index.html          shell only, loads one ES module
sw.js               cache + version. No script injection, no ordered SCRIPTS list
css/app.css         design tokens on :root, dark mode
js/
  core/store.js     IndexedDB, PeerMatch-compatible state
  core/model.js     all derived CRM state: stages, tiers, staleness, relationships
  core/format.js    dates, phone normalization, escaping
  core/blobs.js     object URL lifecycle
  core/bus.js       event bus - features subscribe instead of wrapping each other
  data/backup.js    ZIP + base64 text wrapper, byte-compatible with PeerMatch
  list/engine.js    the single list renderer: filter -> sort -> group -> render
  list/views.js     saved view definitions
  ui/*              screens, sheets, forms, contact actions
```

Load order is not load-bearing: the module graph resolves it. Adding a view
means adding one object to `list/views.js`.

## Preserved conventions

- Contact action order is always **Call → Email → WhatsApp → SMS**
- Yes / No for choices, never an X or cross
- Waiting is active yellow, inactive gray
- ב״ה sits above Edit, top right of a detail
- Israeli numbers display and dial locally; WhatsApp gets an internationalized
  number; +1 and other international numbers pass through untouched
- WhatsApp uses `whatsapp://` on Android so leaving WhatsApp returns to the app
- Reminders remain Shadchan-only
- Guy/Girl detail section order is unchanged

## Verified automatically

Run against 300 seeded records (100/100/100, ~1200 activities) in headless
Chromium:

- lists render, window at 30, extend on demand
- view chips, tag facets, sort control and debounced search all filter correctly
- detail opens with correct section order and contact-button order
- stage changes persist and re-render in place
- relationships resolve in both directions
- **backup round trip**: ZIP and emailed-TXT both rebuild byte-identical record
  and note counts
- **blob URLs**: 360 created, 360 revoked, 0 retained after heavy typing over a
  120-record list where every record has a photo
- day-boundary handling for call reminders set at any time of day
- no console errors

## Still to verify on a real device

Automated tests cannot cover these. Nothing below should be treated as working
until tested on the actual phone:

- [ ] install as a PWA and confirm offline launch
- [ ] restore a **real** PeerMatch backup (both .zip and emailed .txt)
- [ ] confirm restored history, photos, audio notes and attachments all survive
- [ ] audio recording and playback
- [ ] Call / Email / WhatsApp / SMS actually launch the right app
- [ ] WhatsApp returns to ZivugBase rather than the browser
- [ ] behaviour under NetSpark filtering

## Not ported

Deliberately out of scope for a structural test. These remain PeerMatch's:
Make Match, PDF-first profile sharing, multi-shadchan send queues, WhatsApp
import, OCR/PDF parsing, screenshot import, translation, and the post-call
status popup.
