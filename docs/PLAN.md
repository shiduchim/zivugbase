# ZivugBase — Research findings and build plan

Stage 0 of a multi-stage rebuild. **No code has been written for this plan yet.**
This file is the handoff between stages: every later stage starts by reading it.

Date: 2026-09-24. Reference app: PeerMatch v131 (`shiduchim/match`, `main` @ `7fdfced`).

---

## 0. The one-paragraph answer

Build ZivugBase as a **shidduch card organizer**, not a sales CRM. The center of the app
is the **card** (a single's profile), and the things that happen to cards: they **arrive**
(from shadchanim, WhatsApp, PDFs), get **sent out** (to shadchanim), get **paired** into
**shidduch suggestions** (redt by you, or redt *to* you), and those suggestions move through
**yes / no / dating / closed**. PeerMatch already does most of the arriving and sending well,
but it has no suggestion object at all — a Make Match is only text copied into three
histories — so "offers sent to me" and "offers declined" cannot be tracked. The rebuild keeps
every PeerMatch feature, adds four real objects (**Suggestion, Submission, Activity, List**),
and replaces 75 layered patch files with one owner per behavior. Platform: **the same
free PWA**, with an **optional** Android companion APK later for the three things a browser
physically cannot do.

---

## 1. What was studied

**PeerMatch, completely.** All 75 live runtime files (~600 KB) in `sw.js` load order, every
user-facing string, every record field written, every history entry shape, the four docs
(`ARCHITECTURE`, `DECISIONS`, `KNOWN_ISSUES`, `TESTING`), the v128 handoff, the native
`android/` experiment, the `test/whatsapp-photo-recipient` branch, and the APK build history.

**Shidduch software.** MyShadchan (parent-side CRM, open source), shadchan.im (nonprofit
shadchan network), ZivugTech (free shadchan pipeline tool), Shadchan Pro (shadchan database
with search and scoring), SawYouAtSinai (two-sided accept/decline flow), ZUUG (boy's side
first, then girl's side), and the Between Carpools parent spreadsheet method.

**Platform facts** that decide what is possible on your phone: Contact Picker, persistent
storage, notification scheduling, on-device AI, the WhatsApp `jid` intent, Capacitor, NetSpark.

Sources are listed at the bottom.

---

## 2. What PeerMatch gets right — all of this is kept

This is the complete feature inventory, grouped by job. Everything here is a requirement.

### Getting information in (fast entry)
- **Paste profile** — clipboard → auto-fills name, age, contact person (`workflow-v103`).
- **Android Share → app** — text, image, or PDF from any app, filed as Guy / Girl / reply.
- **WhatsApp chat export import** — a chat ZIP becomes profiles + shadchanim (from vCards)
  + history, with duplicate checks (`whatsapp-import-v61`).
- **Trilingual profile parsing** — name, age, gender and "contact at bottom" detection in
  **English, Hebrew and Russian** (`שם / גיל / בן 25 / мужчина / возраст / лет`).
- **PDF / screenshot attach** with a choice of *Attach only* or *Attach + parse text*;
  parsing may fail and the file is always kept.
- **Guided voice entry** (field by field, spoken prompts) and **audio profile** with transcript.
- **Person photo separate from profile screenshot**; images compressed to full + thumbnail.
- **Age auto-derived** from profile text; **contact name auto-filled** from a matching
  Shadchan by phone.

### Organizing
- **Checkbox selection on every row, kept across tabs** (select profiles on Guys, then a
  Shadchan on Shadchanim, then send).
- Tags · Religious level · Religious details · **Quick flags**: divorced, with kids, kohen,
  kosher for kohen, baal teshuvah, watches movies, prays 3× daily, smokes · Languages
  (English / Hebrew / Russian) · Body type.
- **Looking for** + **To what age**.
- **Talked by phone / Met in person** with conversation notes (your own vetting).
- **Waiting for reply** on anyone (yellow = active, gray = inactive).
- **Call today / Call tomorrow** reminders and a Calls badge — **Shadchanim only**.
- **Shadchan referrals** — "referred by" grouping under the referring shadchan.
- **Linked shadchan** on a profile, and **linked profiles** shown on the shadchan.

### Sending
- Profile(s) → **one selected shadchan**, direct to that WhatsApp chat, **one message per
  profile**, never bundled, one tap each.
- One profile → **several shadchanim**, recipient by recipient.
- Profile → **any recipient** (saved shadchan, typed name/phone, or choose inside WhatsApp).
- **Make Match** — one Guy + one Girl → shadchan or either side's contact person, with a
  prepared "Shidduch suggestion" message.
- **Share a shadchan's contact card.**
- **PDF-first**: if a profile has a PDF, send the PDF; if removed, fall back to text.
- **Photo as an optional second step** with an explicit Yes / No.
- **Language filter at send time** — keep only the English / Hebrew / Russian lines.
- Channels: WhatsApp, SMS, Email, Copy. Android uses `whatsapp://` so leaving WhatsApp
  returns to the app.
- **Logged before handing off**, on both the profile and the shadchan.

### Tracking
- History on every record: WhatsApp-style in/out bubbles, text notes, audio notes, actions.
- **Add received reply** (paste a shadchan's answer into their history).
- **Post-call popup**: answered Yes/No guess, typed or recorded note, cancel follow-up.
- **Last call status** banner. **Added-to date.** Delete individual history entries.

### Data and tools
- Backup as a real **ZIP**; **email backup** as a base64 `.txt` (Android refuses ZIP shares);
  restore either.
- **On-device translation** (Chrome Translator API) that never replaces the original text.
- Feature-request email link · Running-version badge.

### Your standing preferences (all kept)
Call → Email → WhatsApp → SMS order · explicit **Yes / No**, never an X · waiting yellow /
inactive gray · **ב״ה above Edit** · Girl photo immediately left of Edit, girl list photos
click-only · Israeli numbers shown and dialed locally, WhatsApp internationalized, +1 and
other international numbers untouched · detail order: header → last-call banner → profile
text → looking for → attachment → contacts → quick details → history → added date ·
**free options only** · reminders never nudge you to chase singles · works on basic phones
where contacts only have Call/SMS.

---

## 3. What went wrong structurally, and how the rebuild prevents each

Measured on PeerMatch v131:

| Problem | Evidence | Rebuild rule |
|---|---|---|
| Many owners for one job | **22 files** open WhatsApp/SMS/email/share; 4 separate WhatsApp send queues bridged by a global `localStorage` patch | **One send service.** Every send in the app goes through it. One queue. |
| Layers fighting layers | **33 files** re-wrap `openP/openS/renderP/renderS`; **56 MutationObservers**; fixes that "never ran" (v111–v115) because another layer won | Screens are **rendered from data** by one component each. No file may move or patch another file's DOM. |
| One event stored as two copies | A profile→shadchan send is written into *both* histories, then reconciled; needed `shareLinkId`, fingerprints, tombstones, rollback (v100, v127) | **One Activity record with links** to every card/shadchan/suggestion it involves. Shown in each timeline, deleted once. The whole bug class disappears. |
| No suggestion object | Make Match writes free text into 3 histories; nothing has a status | **Suggestion** is a first-class object with a two-sided pipeline. |
| Whole database in one row | Every `save()` rewrites `kv['state']` — all records *and* photos/PDFs/audio | **Real tables** (Dexie/IndexedDB); a save writes only the changed row. Files stored once, by id. |
| Data can be evicted | `navigator.storage.persist()` is **never called** — Android may delete the database under storage pressure | Request persistent storage at startup; show its status on Home. |
| Share-in overwrites | Every Android share is stored under the single key `'pending'` — **a second share before opening the app erases the first** | **Inbox queue**: every share is its own item until you file it. |
| Age goes stale | Age is stored as a number; a "27" saved today is still "27" in two years | Store **age + the date it was true** (or date of birth); always show current age. |
| CDN dependencies | PDF.js and Tesseract (+ language data) load from cdnjs/jsDelivr, which NetSpark can block | **Self-host everything** on the same site. No runtime CDN. |
| Bugs found only on the phone | No automated tests; CI only checks files exist | **Tests gate every deploy**: parsers, phone rules, dedup, backup round-trip, key flows. |

---

## 4. What dedicated shidduch software teaches

- **MyShadchan** (closest in spirit, parent side): resumes arrive by WhatsApp share, email,
  SMS, upload into an **Inbox**; a triage pipeline *New → Look into → Not sure → For sure not*,
  then *Yes / Unsure / No* after research; **reusable references** with per-call logs; per-child
  **dating history**; and its headline feature — on capture, **check every new single against
  every past suggestion and dating history** by name + parents + yeshiva/seminary + shul +
  location, **across Hebrew ↔ English spellings**.
- **shadchan.im**: "every suggestion you've ever made, **what came back**, and **what's due
  next**", with follow-ups, meetings, notes and resumes attached to the single.
- **ZivugTech**: drag a suggestion through **stages**; "combo tags and filters find the right
  resume in seconds"; notes and follow-up tasks live on the resume.
- **Shadchan Pro**: criteria search, **side-by-side compare**, suggestion status, events,
  resume storage, emailing resumes, a **scoring** aid for finding suggestions.
- **SawYouAtSinai**: each side **accepts or declines**; a response window; **the same pair is
  never suggested twice**; relationship statuses *spoke on phone → first date → dating
  exclusively → engaged*, plus *unavailable* while seeing someone.
- **ZUUG**: the traditional order — **boy's side is asked first**, girl's side only if he's
  interested.
- **Between Carpools** (what parents do in a spreadsheet): name, age/DOB, city, shadchan,
  shadchan's phone, **date mentioned, status, reason**, resume link.

What none of them fit: you are neither a parent with one or two children nor a professional
with a team — you hold **many cards on both sides plus a large shadchan network**, working
alone, on a filtered Android phone, for free. ZivugBase takes their suggestion pipeline and
dedup, and keeps PeerMatch's intake and sending speed, which is better than any of them.

---

## 5. The core model — six objects

```
          ┌──────────────┐        Submission         ┌──────────────┐
          │   CARD       │───── "sent to" ──────────▶│   CONTACT    │
          │ (Guy / Girl) │                            │ (Shadchan,   │
          └──────┬───────┘                            │  contact     │
                 │ two cards                          │  person...)  │
                 ▼                                    └──────┬───────┘
          ┌──────────────┐   suggested by / to               │
          │ SUGGESTION   │◀──────────────────────────────────┘
          │ (the shidduch│
          │  idea)       │
          └──────────────┘
   ACTIVITY  = one timeline entry, linked to any of the above (shown in each)
   TASK      = a follow-up date on a Contact or Suggestion (never on a single)
   LIST      = a saved filter or a hand-picked group of cards / contacts
```

### Card (a single — Guy or Girl)
- `kind` guy | girl · **`status`**: Active · On hold · Dating · Engaged · Married · Not available
  (off-market cards leave the active lists but stay searchable)
- name, plus Hebrew/Russian spellings and aliases (for duplicate detection)
- **age as `{value, asOf}` or date of birth** → current age always computed
- city / country · profile text **kept verbatim** · looking for · min/max age sought
- all PeerMatch quick flags, languages, religious level/details, tags, body type, height
- photos (several), resume files (PDF / screenshots, several), audio profile + transcript
- people around them: the single's own phone, contact persons (parent, friend, rav),
  references — each optionally linked to a Contact
- **source**: who brought the card, from which shadchan, when, how (share / paste / import)
- vetting: talked by phone / met in person + notes
- share defaults: which languages, include photo
- waiting for reply (+ since when) · created / updated · untouched copy of any imported
  PeerMatch record

### Contact (a Shadchan, or anyone else in your rolodex)
- name · **roles**: shadchan, contact person, reference, parent (one person can be several —
  a shadchan who is also a girl's contact person is one record, not two)
- several phones (mobile / landline, so SMS is hidden for Israeli landlines), email
- city / region, **communities they serve** (Chabad, BT, Russian-speaking, older, divorced…),
  languages · **referred by** another contact
- follow-up date, waiting for reply · notes
- derived, not typed: cards you gave them, suggestions they sent you, last contact,
  how often they answer

### Suggestion (a shidduch idea — "offer")
- the two cards; **either side may be external** (a single you don't hold yet — entered with
  minimal details and upgraded to a full card later)
- **direction**: *I suggested* or *Suggested to me* · **by / through** which shadchan ·
  **for** which of your singles
- **stage**: Idea → Asked side 1 → Asked side 2 → Researching → Dating → **Engaged** / **Closed**
- **each side's answer**: Waiting · Thinking · Yes · No — with date and how it came back;
  which side goes first (default: the boy's side)
- **why it closed**: who declined, reason chips (age, hashkafa, location, height, family,
  "not now", already dating someone) + free text
- dates (date 1, 2, 3… with notes) · follow-up date
- **never the same pair twice without a warning** that shows what happened last time

### Submission (a card sent to a contact)
- card · contact · when · channel · what was sent (text / PDF / photo, which languages)
- optional light response: no reply · got it · has an idea · not relevant
- answers "who has Moshe's card?" and "what have I given Rivka?", and warns before sending
  the same card to the same shadchan again

### Activity (one entry in a timeline)
- when · kind (note, audio note, call + call note, message out, message in, status change,
  file sent) · channel · text / audio · **links** to every card, contact and suggestion involved
- **written once**, visible in every linked timeline, deleted once
- status changes are logged automatically, so the history is complete without extra typing

### Task, List, Inbox item, File
- **Task**: a due date + note on a Contact or Suggestion. Never on a single (your rule).
- **List**: *smart* (a saved filter: "Girls 28–35, Russian-speaking, active") or *manual*
  (hand-picked: "For Moshe", "Send to Rivka next").
- **Inbox item**: anything shared in or pasted, waiting to be filed — never overwritten.
- **File**: photo / PDF / audio stored once, referenced by id; thumbnails kept separately.

---

## 6. Screens

Keeping what you liked in the prototype: a **Home** tab (renamed from Today), **Data folded
into Home** (no separate tab), **small bottom tabs**, **recently added** and **action items**
on Home.

**Bottom tabs (small):** Home · Guys · Girls · Shadchanim · Shidduchim
**Everywhere:** a search button (searches everything) and a **+** button
(Paste profile · Guy · Girl · Shadchan · Suggestion · Import WhatsApp chat).

### Home
1. **Inbox** — "3 shared items to file" (only when there are any).
2. **Action items** — calls due · waiting for a reply for more than N days · suggestions
   waiting on a side's answer · follow-ups due today.
3. **Active shidduchim** — suggestions currently in Researching or Dating.
4. **Recently added** — newest cards and shadchanim.
5. **Recent activity.**
6. **Data** — "Last backup: 9 days ago" · Save backup · Email backup · Restore ·
   Import PeerMatch backup · storage protected Yes/No · version.

### Guys / Girls — the rolodex
- Chips across the top: **All · Active · Lists ▾ · Filter**.
- **Filter**: current age range · status · tags · flags · languages · religious level ·
  city · source shadchan · "not yet sent to anyone" · "sent to…" · saved as a List in one tap.
- Each row is a compact **card**: photo (girls click-only) or initials, name, **current age**,
  city, religious level, two key flags, status, "with 4 shadchanim", last activity.
- Checkbox selection kept across tabs; the selection bar offers **Send**, **Suggest**,
  **Add to list**, Copy, Delete.

### Card detail
Your established order, with the new parts slotted in:
header (name / photo / ב״ה + Edit) → last-call banner → **status + waiting** → profile text →
looking for / to what age → attachments → contacts → quick details → **Suggestions for this
person** (active, then declined, collapsed) → **Sent to** (which shadchanim, when) → history →
added date.
A **"Find matches"** button lists opposite-gender active cards inside the age limits that
have not already been suggested or declined.

### Shadchanim
- Chips: **All · Calls due · Waiting · Active · Dormant · by community**.
- Referral grouping kept. Each row: name, communities, "has 6 of your cards",
  last contact, reply rate.
- Detail: contact buttons (Call → Email → WhatsApp → SMS) → follow-up → cards you gave
  them → suggestions they sent you → history.

### Shidduchim (suggestions)
- Chips: **Active · Waiting on an answer · Dating · Engaged · Declined · All** and
  **Mine / Suggested to me**.
- Each row: *Guy ↔ Girl*, via which shadchan, stage, whose answer is pending and since when.
- Detail: both cards side by side (the compare view), each side's answer with Yes / No
  buttons, dates, reason when closed, history.

### The Send flow (one flow for everything)
**What** (card(s) — text / PDF / photo, which languages) → **To whom** (shadchan(s),
a contact person, or anyone) → **How** (WhatsApp · SMS · Email · Copy).
Multiple items go through **one queue, one tap each**, never bundled. Warns on a repeat
send. Writes one Activity + one Submission per message *before* opening the other app.
Make Match becomes "Suggest": creates the Suggestion first, then offers to send it.

### Filing an incoming offer
A shadchan WhatsApps "What about Chaya for Moshe?" → **Share → ZivugBase** → Inbox →
**File as: suggestion for Moshe** → duplicate check finds Chaya if you already hold her card
(or creates a light external card) → Suggestion created, *Suggested to me*, by that shadchan.
That is how "offers sent to me" and "offers declined" become trackable.

---

## 7. Features, by priority

**K** = kept from PeerMatch · **N** = new

### Must have (first usable version)
1. **N** Suggestion pipeline with both sides' answers, decline reasons, *mine / to me*.
2. **N** Submissions ("sent to") with repeat-send warning; "who has this card".
3. **N** **Duplicate detection** on every intake: phone first, then name + current age,
   matching across Hebrew / English / Russian spellings; also "this pair was suggested before".
4. **N** Card status (off-market cards drop out of active lists; engagement closes their
   open suggestions).
5. **N** Home with Inbox, action items, recently added, active shidduchim, and data section.
6. **N** Filters on every field + **smart and manual Lists**.
7. **N** Age that stays correct over time.
8. **N** Persistent storage request + backup reminder on Home.
9. **K** Every intake path: paste, share-in (now a queue), attach PDF/screenshot, photo,
   manual form, PeerMatch backup import.
10. **K** Every send path through the one send service, including PDF-first, photo step,
    language filter, `whatsapp://` return, logging first.
11. **K** Histories, notes, audio notes, add received reply, delete entry.
12. **K** Waiting, shadchan call reminders, referral grouping, linked shadchan.
13. **K** Backup ZIP + email TXT + restore; imports PeerMatch backups.

### Should have (next)
14. **N** Find matches for a card (rule-based: gender, age limits, not already tried).
15. **N** Message templates (first contact, sending a card, follow-up "any news?") in
    English / Hebrew / Russian, with your name filled in.
16. **N** References per card, with call log (from MyShadchan).
17. **N** Shadchan stats: cards given, suggestions received, reply rate, last contact.
18. **K** WhatsApp chat export import (profiles + vCards + history).
19. **K** Post-call status popup + last-call banner.
20. **K** Guided voice entry, audio profile transcript, on-device translation.
21. **N** Compare two cards side by side.

### Later / optional
22. **N** **Android companion APK** (see §8) — send a photo/PDF straight into one WhatsApp
    chat, real reminder notifications, real call answered/duration, auto-capture incoming
    WhatsApp messages.
23. **N** Calendar reminders as a free fallback: "Remind me" adds an event to your phone's
    calendar, which notifies even when ZivugBase is closed.
24. **N** Export a List as a printable page / CSV.
25. **N** Optional sync to a second device (needs a free backend; keep off unless asked).

### Deliberately dropped
Four WhatsApp queues (→ one) · MutationObserver layout patches · runtime CDN loading ·
duplicated phone helpers (→ one phone module) · positional selection (never again).

---

## 8. Platform and technology decisions

### PWA first, optional Android companion later
A browser app **cannot**, on any phone, for any amount of work:
1. send a **photo or PDF directly into one specific WhatsApp chat** (a link can pick the chat
   *or* carry a file, not both — the documented PeerMatch limitation);
2. **ring a reminder while the app is closed** without a server (scheduled-notification APIs
   never shipped for web);
3. know whether a call was **answered or how long** it lasted;
4. **read incoming WhatsApp messages** automatically.

A small native Android wrapper **can** do all four — and you already started down this road:
`match/android` has a WhatsApp notification listener, a signed 1.0 APK built successfully in
GitHub Actions on Sep 14, and the Sep 16 `test/whatsapp-photo-recipient` branch tests exactly
the undocumented WhatsApp `jid` extra for #1 (its build failed, so it was never answered).

**Recommendation:** build the web app first and make it complete on its own. Structure the
code so a **Capacitor** wrapper (free, open source) can later reuse the exact same app and
light up those four abilities when installed as an APK. Before committing to it, run a
**one-day spike**: build a tiny test APK that sends one photo + text to one chosen contact via
the `jid` extra, and confirm (a) it works on your current WhatsApp and (b) NetSpark lets you
install it. If either fails, nothing is lost — the PWA stands alone.

### Stack (all free)
| Part | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Claude maintains this code; type errors are caught at build time, not on your phone. (The prototype hit exactly such a bug — a wrong import that only failed when the page loaded.) |
| UI | **Preact** + signals | ~4 KB, component-based: each screen owns its own markup, which structurally prevents PeerMatch's "two files fight over one button". |
| Build | **Vite** in GitHub Actions | Static output to GitHub Pages; no server. |
| Database | **Dexie** (IndexedDB) | Real tables + indexes, versioned migrations, live queries so lists update themselves. |
| Search | **MiniSearch** | Fast in-memory search with typo tolerance, which helps with transliterated names. |
| PDF / OCR | **PDF.js + Tesseract**, **self-hosted** with English/Hebrew/Russian data | Loaded only when you tap "parse"; served from the app's own site so NetSpark can't block a CDN. |
| Tests | **Vitest** + **Playwright** | Parsers, phone rules, duplicate detection, backup round-trip, and main flows on a phone-sized screen — **must pass before anything deploys**. |
| Hosting | GitHub Pages | Already live at `shiduchim.github.io/zivugbase`. |
| Later | **Capacitor** APK via GitHub Actions | Same code; sideloaded; free. |

No AI service is used at runtime: Chrome's on-device model (Gemini Nano) is desktop-only in
2026, and paid APIs are excluded. Parsing stays rule-based — PeerMatch's trilingual parser is
already good and will be ported with tests.

### Data safety
- Separate site from PeerMatch → separate database. **PeerMatch is never touched**; you run
  both side by side until you're satisfied.
- ZivugBase **imports PeerMatch backups** (ZIP or email TXT) at any time, preserving every
  unknown field in an untouched `legacy` copy.
- Request persistent storage; show "Storage protected: Yes/No" and "Last backup" on Home.
- History and dates are never invented: imported records keep their real timestamps.

---

## 9. Build stages

Each stage ends with a deploy to `shiduchim.github.io/zivugbase`, an import of your real
PeerMatch backup, and your test on the phone. Nothing is called device-verified until you
test it.

| Stage | Delivers | You test |
|---|---|---|
| **1. Foundation** | Tooling + tests + CI gate; database tables; PeerMatch backup import; backup/restore; app shell with Home and 5 small tabs; Guys/Girls/Shadchanim lists with search, filters and status; card and shadchan detail (read) | Import your backup; every card, shadchan, photo, PDF, audio note and history entry is there |
| **2. Intake** | Add / edit forms; paste-profile parser (EN/HE/RU); share-in **Inbox queue**; attachments + optional parsing; photos; audio; **duplicate detection** | Share 3 profiles in a row, file them, catch a duplicate |
| **3. Send** | The one send service + queue; WhatsApp / SMS / Email / Copy; PDF-first; photo step; language filter; templates; Submissions; linked Activities | Send cards to one and to several shadchanim; histories and "sent to" are correct |
| **4. Shidduchim** | Suggestions pipeline, answers, reasons, dates, repeat-pair warning; filing an incoming offer; follow-ups; Home action items; post-call popup | Record an offer sent to you, decline it with a reason, find it again |
| **5. Organize** | Smart + manual Lists; Find matches; shadchan stats; compare; WhatsApp chat import; referral grouping; guided voice; translation | Build a list, find matches for a card |
| **6. Optional** | Android companion spike, then APK if it passes | Photo straight into one WhatsApp chat |

Stages 1–4 make ZivugBase a full replacement; 5–6 make it better than PeerMatch ever was.

---

## 10. Decisions needed from you before Stage 1

1. **"Offers sent to me"** — suggestions that shadchanim send you *for your singles*? Should
   ZivugBase also record suggestions where the other single is not one of your cards
   (a light "external" card)? *(Assumed yes to both.)*
2. **Follow-up dates on suggestions** — e.g. "girl's side answers by Thursday". These chase
   shadchanim/sides, not singles. OK? *(Assumed yes.)*
3. **Android companion APK** — would you install a sideloaded app if the one-day test works,
   and does your NetSpark setup allow it?
4. **Phone only, or computer too?** Everything stays on one device today. A second device
   needs sync, which means a free cloud service holding your data. *(Assumed phone only.)*

---

## 11. Two PeerMatch data-loss risks worth fixing now, independent of the rebuild

Both are small, contained changes to PeerMatch, not part of ZivugBase:
1. **Request persistent storage** at startup so Android cannot evict the database.
2. **Stop overwriting shared items**: the service worker stores every share under the single
   key `'pending'`, so a second share before opening the app erases the first.

---

## Sources

- MyShadchan — https://github.com/dniasoff/myshadchan
- shadchan.im — https://www.shadchan.im/
- ZivugTech — https://www.zivugtech.org/
- Shadchan Pro — https://www.shadchanpro.com/
- SawYouAtSinai — https://en.wikipedia.org/wiki/SawYouAtSinai
- ZUUG — https://zuug.app/
- Between Carpools, organizing shidduch resumes — https://betweencarpools.com/organize-keep-track-of-resumes/
- Shidduch resume sections — https://shidduchim101.com/writing-shidduch-resumes/
- Contact Picker API — https://developer.chrome.com/docs/capabilities/web-apis/contact-picker
- Persistent storage — https://web.dev/articles/persistent-storage
- Notification Triggers — https://developer.chrome.com/docs/web-platform/notification-triggers
- Chrome built-in AI / Prompt API — https://developer.chrome.com/docs/ai/prompt-api
- WhatsApp `jid` share intent — https://medium.com/@mkcode0323/simplifying-image-and-text-sharing-via-whatsapp-from-your-android-app-0cc914b118c6
- Capacitor Android builds in GitHub Actions — https://capgo.app/blog/automatic-capacitor-android-build-github-action/
- NetSpark — https://www.netsparkmobile.com/en/application/
