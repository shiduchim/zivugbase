# ZivugBase — Research findings and build plan

Stage 0 of a multi-stage rebuild. **No application code has been written for this plan yet.**
This file is the handoff between stages: every later stage starts by reading it.

Revision 4 — 2026-09-24. Reference app: PeerMatch v131 (`shiduchim/match`, `main` @ `7fdfced`).
Rev 3 adds: dating sites and platforms (§2.5), one card shared by both modes (§3.5),
PeerMatch import mapping (§5.1), and the owner's answers to the rev 2 questions.
Rev 4 adds: organizing hundreds of shadchanim — shared categories, where each contact came
from, smart and manual lists, bulk import and tagging (§3.4).

---

## 0. The answer in one paragraph

ZivugBase is a **capture-first shidduch organizer** with **two modes**. The owner's biggest
problem is not organizing — it is that information arrives **outside the app** (an idea by
email, another by WhatsApp, a phone call saying "call this shadchan", someone asking for an
updated profile) and typing it in takes time. So the heart of the app is an **Inbox** that
accepts anything from any channel in one gesture, **does the typing itself** (detects what the
item is, extracts names, ages, phones, who sent it, checks for duplicates), and files it with
**one tap**. On top of that sit two modes over one shared database:
**Single mode** (you are the single: offers sent to you, the shadchanim you work with, your own
profile and who has which version of it) and **Shadchan mode** (the PeerMatch successor:
guys, girls, shadchanim, and matches between them). It is a free web app — no app store, no
cloud — with an **optional** Android add-on for the few things a web app cannot do.

---

## 1. Decisions recorded

| # | Question | Answer |
|---|---|---|
| — | Who uses it | The owner is **a single guy**. The app must also work for **anyone**: singles (guys or girls) and people who make matches. |
| 1 | "Offers sent to me" | Offers sent to the **user as a single**. → Two modes: **Single** (shadchanim + girls suggested / met) and **Shadchan** (match guys and girls, plus a shadchanim list — kept, see §5). |
| 2 | Follow-up dates on offers/suggestions | **Try it.** |
| 3 | Install | **No install by default**, so anyone can use it easily. Offer an **optional** install only for features that are really worth it (§9). |
| 4 | Cloud | **No cloud service.** All data stays on the device. |
| — | The #1 pain | "Info is sent to me outside the app and I don't like spending time entering info." → Capture-first design (§2). |
| 5 | What PeerMatch's data is | PeerMatch's Girls are **single girls, some suggested to the owner**, tracked so they can also be **offered to friends**. → One card serves both modes (§3.5); import mapping in §5.1. |
| 6 | App language | **English for now.** App text kept in one place so Hebrew/Russian can be added later. |
| 7 | Voice to text | **Transcribe**, using Chrome's recognition (on-device when available, otherwise Google's). |
| — | Dating sites | Ideas also come from **SawYouAtSinai, ChabadMatch, BasheretNow** and similar. Everyone contacted there must be recorded quickly so they are **not offered again** (§2.5). |

---

## 2. The #1 problem: capture from outside the app with no typing

### 2.1 Principles
1. **One gesture to capture, from wherever the information is.** Never "open the app, find
   the right screen, fill in a form".
2. **Capture now, file later.** Every captured thing lands in the **Inbox** as its own item.
   Nothing is ever overwritten (PeerMatch's share-in overwrote itself — see §7).
3. **The original is the record.** The message, PDF, photo or voice note is kept exactly as it
   arrived. Structured fields are extracted from it for search and duplicate-checking, and
   are **never required**.
4. **The app proposes, you tap.** For each item the app guesses what it is and offers
   one-tap actions. You correct only when it guessed wrong.
5. **File a batch in a minute.** A triage screen shows one item at a time with the likely
   action highlighted; one tap files it and moves to the next.

### 2.2 Capture channels — what works with no install

| Where the info is | How it gets in (no install) | Taps | With the optional Android add-on |
|---|---|---|---|
| **WhatsApp** message, PDF, photo, voice note, contact | Select → **Share → ZivugBase**. Several messages at once are fine. | 2–3 | Messages from known shadchanim are **captured automatically** from notifications (0 taps) |
| **WhatsApp**, keeping who sent it | Select messages → **Copy** → open ZivugBase → **Paste**. Copying several messages includes each sender's name and time, so the shadchan is recognized. | 3–4 | same |
| **Email** text | Press-and-hold the text → Select all → **Share → ZivugBase** (or Copy → Paste) | 3–4 | Email notifications from known contacts are captured as a pointer ("Email from Mrs. Katz: *Shidduch idea…*") |
| **Email** attachment (PDF / photo resume) | Tap attachment → **Share → ZivugBase** | 2 | same |
| **SMS** | Select → Share, or Copy → Paste | 2–3 | Captured from notifications |
| **Phone call** (someone told you something) | Right after the call: long-press the ZivugBase icon → **"Voice note"** → speak. The app transcribes and proposes actions. | 2 + speaking | A popup appears **by itself after every call** with a known contact |
| **In person / anywhere** | Same **Voice note** shortcut, or the mic button on Home | 2 + speaking | same |
| **Paper resume / screenshot** | **Photo** button → optional text reading (runs on the phone) | 2 | same |
| **A contact in your phone book** | "Add from contacts" (Android contact picker) — no typing | 2 | same |
| **A call you made from ZivugBase** | Post-call popup (kept from PeerMatch v129): Yes/No answered, voice or typed note | 1 + note | Knows the real call duration and whether it was answered |

Two platform facts shape this table:
- To appear in Android's **Share menu**, the web app must be **added to the home screen**
  (one tap in Chrome's menu, no app store, no permissions). Everything else works in a normal
  browser tab.
- A web app can **read the clipboard** only with permission; if Android refuses, a paste box
  opens so it's one long-press → Paste.

### 2.3 What the app does to every captured item
1. **Detect what it is**: a profile / offer · a contact card · a task ("call…", "send…") ·
   a request to update your profile · a reply or note on something existing.
2. **Extract** (English, Hebrew, Russian — PeerMatch's parser, extended): name, age (stored
   *with the date*, so it stays correct), city, phones, emails, parents' names, school,
   who sent it (from a copied WhatsApp header or a known phone number), dates ("Thursday",
   "next week").
3. **Link and warn**: match phones and names to existing shadchanim and offers →
   *"From Mrs. Katz"* · *"⚠ Chaya L. was suggested by Mr. Stein on May 3 — you said No
   (age)"* · *"⚠ You went out with her in 2025"*. Matching uses several signals (phone,
   name across Hebrew/English/Russian spellings, parents, city, school) and **never
   auto-merges**; you confirm.
4. **Offer one-tap actions**, e.g.
   `New offer from Mrs. Katz` · `Add to existing offer: Chaya L.` · `New shadchan: Rabbi Cohen` ·
   `Call Rabbi Cohen — today / tomorrow` · `Update my profile` · `Note on Mrs. Katz` · `Dismiss`.

### 2.4 Your four examples, end to end

1. **Shidduch idea by email.** In Gmail, Select all → Share → ZivugBase (or share the
   attached PDF). The app sees a profile, pulls out her name, age and city, and asks
   *"From which shadchan?"* with your most recent shadchanim first → **1 tap** → a new
   offer, already checked for duplicates.
2. **Shidduch idea by WhatsApp.** Select the message(s) → Share → ZivugBase. Same as above.
   If you *copy* instead, the sender's name is included, so even the shadchan question is
   skipped.
3. **On the phone: "call Rabbi Cohen, 052-…".** After hanging up, long-press the icon →
   Voice note → say it. The app hears a name, a phone number and "call" → proposes
   **`New shadchan: Rabbi Cohen · remind me to call: today / tomorrow`** → **1 tap**.
   (With the add-on, the popup appears on its own when the call ends.)
4. **"Send your updated profile with these new items."** Voice note or paste → the app files
   it as a **profile update checklist** ("new job", "moved", "add height") on *My profile*.
   When you update the profile (edit text or attach the new PDF), the app shows
   **"11 shadchanim have an older version — send the new one?"** → one tap each, logged.

### 2.5 Dating sites and platforms (SawYouAtSinai, ChabadMatch, BasheretNow…)

**The goal:** everyone you already contacted, declined or were declined by on a site is in
ZivugBase, so when anyone suggests her again, the app says so.

**Each site is a *Source*** — recorded like a shadchan, so every offer shows where it came from
(a site, a site's matchmaker, a shadchan, a friend). A person can carry her **site profile
number / link** for each site she's on.

**Getting a whole site's worth in at once — "Paste a list":**
1. On the site, open the list (search results, your matches, people you contacted) →
   **Select all → Copy**. (If the site is an app and won't copy: take **screenshots** of the list
   and share them all at once — the text is read on the phone.)
2. In ZivugBase → **Paste a list**. The app splits it into people and shows a table:
   *23 people found* — first name/name, age, city, profile number where shown. Untick mistakes.
3. One tap for all of them: **"Contacted on ChabadMatch — Sep 2026"** (or *Declined on
   SawYouAtSinai*, *She declined*, *Went out*). Each becomes a light card + an offer in that
   status. Duplicates with existing cards are merged only after you confirm.

The first time for each site, a **sample paste** from you (names can be removed) lets the reader
be tuned to that site's exact layout; after that it's automatic. Until then, the general list
reader handles "name, age, city" lines, and **typing a quick list** (one person per line,
`Chaya 26 Crown Heights`) is always available as a last resort.

**When she is suggested again**, the warning uses what's known:
- **Same site profile number or link** → certain: *"You contacted her on ChabadMatch, Sep 2026."*
- **Same name** (across Hebrew/English/Russian spellings) + age + city → likely.
- **Only age + city match** → shown as *possible*. This only matters for the few entries
  saved without a name. (ChabadMatch's FAQ says names are limited for singles, but the owner
  sees the names of most people there, so most ChabadMatch entries will carry a name and get
  the normal name-based warning.) When a name is learned later, one tap confirms
  *"same person"* and joins the records, so it's certain from then on.

**Email alerts** from sites ("You have a new match…") can be shared in like any email; the
site is recognized from the text and set as the source automatically.

---

## 3. Two modes over one database

The mode only changes **which tabs you see**. Shadchanim, Inbox, tasks, history and files are
shared, so switching never loses anything. First launch asks: *I'm a single (guy / girl)* or
*I help make matches*. It can be changed any time on Home.

| | **Single mode** (the owner's daily use) | **Shadchan mode** (PeerMatch successor) |
|---|---|---|
| Bottom tabs (small) | **Home · Offers · Shadchanim · My profile** | **Home · Guys · Girls · Shadchanim · Shidduchim** |
| Main object | **Offer** — someone suggested to you | **Card** (a single) and **Suggestion** (a pair) |
| Your own profile | Central: versions, who has which version | Not needed |
| Shadchanim | Who has your profile, what they sent you, keep in touch | Who you send cards to, who sends you cards |

### 3.1 Single mode

**Home**
1. **Capture bar** — `Paste` · `Speak` · `Photo` · `+`
2. **Inbox** — "4 new items" → triage (only shown when there are any)
3. **Action items** — calls due · shadchanim due for a check-in · offers waiting on an answer
   · follow-ups due · profile update pending
4. **Active offers** — looking into / dating
5. **Recently added**
6. **Data** — last backup · Save / Email backup · Restore · Import · storage protected Yes/No
   · mode switch · version

**Offers** (girls suggested to you — "previous girls sent or met" is a filter here)
- Chips: **Active · Looking into · Dating · Went out · Declined · Contacted on a site · All**,
  plus *by source* (a shadchan or a site).
- Row: her name, **current age**, city, source — shadchan or site (and "also by 2 others"),
  stage, how long it has been waiting.
- **Stages**: New → Looking into → **Yes** / **No** (a quick no is kept apart from a
  no after looking into, as MyShadchan does) / Maybe later → Waiting for her side → She said
  yes / no → **Dating** (date 1, 2, 3… with notes) → **Engaged** / **Ended** (who ended it, why).
- The **original message / PDF / photo** is always one tap away.
- **Several shadchanim can suggest the same girl** — one offer, all of them recorded,
  the first suggester credited.
- **Duplicate and "already went out" warnings** at capture time.
- **References** (people to ask about her): name, how they know her, call status
  (answered / no answer / call back), what they said.
- **Follow-up date** ("shadchan gets back to me Thursday").

**Shadchanim**
- Chips: **All · Calls due · Check-in due · Waiting · Has my profile · Outdated profile**.
- Row: name, communities, **has your profile (version, date)**, offers they sent, last contact.
- **Keep-in-touch interval** per shadchan ("every 30 days") → shows up on Home when due.
  Staying on shadchanim's radar is part of the single's job; this does it for you.
- Call reminders (kept), waiting for reply (kept), referral grouping (kept).
- Stats: offers sent to you, how many led to a date.

**My profile**
- Your profile text (English / Hebrew / Russian), PDF resume(s), photos, key facts,
  what you're looking for.
- **Versions**: every saved change is a dated version with a short "what changed".
- **Who has it**: every shadchan you sent it to, which version, when; outdated ones flagged.
- **Pending updates checklist**, filled from captured requests (§2.4 example 4).
- **Send to shadchan(s)**: PDF-first, optional photo, language filter, a ready intro message
  ("Hi, this is … here is my updated profile"), one tap per recipient, logged.

### 3.2 Shadchan mode
The PeerMatch successor, restructured (details in revision 1's design, kept here in short):
- **Guys / Girls** — the rolodex of cards with filters (current age, status, tags, flags,
  languages, religious level, city, source), **smart and manual Lists**, compact card rows,
  checkbox selection kept across tabs.
- **Shidduchim** — each suggested pair with both sides' answers (boy's side asked first by
  default), dates, decline reasons, and a warning if the same pair comes up again.
- **Sent to** tracking — which shadchan has which card, repeat-send warning.
- **Find matches** for a card — opposite-gender active cards inside the age limits, not
  already tried.
- **Shadchanim list: kept.** In shadchan mode you still send cards to other shadchanim and
  receive cards from them; the list is where that network lives.

### 3.4 Organizing hundreds of shadchanim (and singles)

Researched how phone books (Google Contacts labels), personal CRMs (Monica, Dex, Clay, folk),
sales CRMs (HubSpot active vs static lists), recruitment agencies (candidate and client
specialty tagging), and information-architecture work on tags vs folders handle large contact
sets. What carries over:

**1. One shared set of categories for singles *and* shadchanim.** The categories you'd put on
a shadchan (*handles older singles, BT, divorced…*) are the same ones that describe a single.
Recruitment agencies do exactly this: candidates' skills and clients' specialties use one
vocabulary, so search matches them. With one shared set, the app can answer on its own:
- *Single mode:* **"Who should have my profile?"** — your profile's categories vs every
  shadchan's → *"38 shadchanim work with singles like you; 14 don't have your profile yet —
  send?"*
- *Shadchan mode:* **"Who should get this card?"** — ranked by fit and by how responsive each
  shadchan is.

**2. Categories as tap-to-pick chips, not typed tags.** Free-typed tags turn into a mess
("BT", "baal teshuva", "Baal Teshuvah" become three different tags). The research is
consistent: group them into **categories with fixed options** (faceted classification). You
tap; you never type. You own the list — add, rename, merge or hide options any time.

Starting set (all editable):

| Category | Options | On a shadchan | On a single |
|---|---|---|---|
| Age | under 25 · 25–30 · 30–35 · 35–45 · 45+ | ranges they handle | worked out from the age |
| Religious level | Chabad · Chassidish · Yeshivish · Modern Yeshivish · Modern Orthodox · Dati Leumi · Traditional · Not religious | several | usually one |
| Background | Baal teshuvah · FFB · Convert · Russian-speaking · Sephardi · Ashkenazi · Israeli · English-speaking · French-speaking | several | several |
| Marital status | Never married · Divorced · Divorced with kids · Widowed | several | one |
| Work / learning | Learning full-time · Learning and working · Working · Good job / professional · Studying | several | one |
| Location | regions (Jerusalem, Beit Shemesh, Bnei Brak, Center, North, South, Crown Heights, Lakewood, …) | several | worked out from the city |
| Languages | English · Hebrew · Russian · French · Yiddish | several | several |
| 🔒 Appearance | your own private scale | what they handle | your private note |
| 🔒 Special situations | Health / medical · Special needs · Fertility / genetic · Other sensitive | what they handle | private |
| Shadchan only: how they work | Professional · Volunteer · Organization · Site matchmaker · Rebbetzin · Friend | | |
| Shadchan only: reach them by | WhatsApp · Calls only (kosher phone) · Email | | |

🔒 = **private**: never included in anything you send, shown with a lock, and can be hidden
completely. Everything stays on your phone.

**3. Where each contact came from.** Every shadchan (and every single) records **how you got
them**, picked from chips, plus the date added:
*Referred by a person* (linked to that person — a shadchan, friend or relative, so the
**referral tree** shows who introduced whom) · *Friend* · *Family* · *Internet search* ·
*Dating site's shadchan list* (which site) · *WhatsApp group* (which group) · *Organization* ·
*Event / shiur* · *Ad / newspaper* · *Already knew them* · *Other* — with an optional note
(*"met at the Kiddush in Beit Shemesh"*). This answers **"where do my good shadchanim come
from?"**. Combined with the usefulness numbers (point 7), you can see, for example, that
friends' referrals send better offers than internet searches. The Inbox fills it in when it
can (a contact shared from a WhatsApp group becomes *WhatsApp group: <name>*).

**4. Lists: smart and manual** (HubSpot's active vs static lists, Google's labels).
- **Smart list** = a saved combination of categories that updates itself: *"Older + BT +
  Jerusalem"*. A new shadchan tagged that way appears in it automatically.
- **Manual list** = hand-picked: *"Top 10"*, *"Send my new profile to these"*,
  *"Rosh Hashanah greetings"*.
- A shadchan can be in **any number of lists** — labels, not folders.
- Each list can have its own **keep-in-touch interval** (*Top 10: every 2 weeks; everyone
  else: every 2 months*).

**5. Phone-book habits for long lists**: **A–Z index** down the side · **Favorites** (star)
pinned on top · **Recent** · search across every field, category and note, forgiving of
spelling · **Group by** letter / region / category / where they came from / last contact ·
**merge duplicates** (same phone number).

**6. Getting hundreds in and categorized without typing**:
- **Bulk import** from your phone's contacts (the contact picker lets you tick many at once),
  from a shared contacts file (`.vcf`), or from a WhatsApp group chat export — shown as a
  table, *"all of these are shadchanim, from: WhatsApp group X"* in one tap, duplicates merged.
- **Bulk tagging**: tick 30 shadchanim → set a category, a source or a list in one action.
- **Tagging sprint**: one shadchan per screen, tap the chips, next — like filing the Inbox.
  Hundreds of shadchanim in one sitting.
- **Suggested categories**: the app proposes them from what it already knows. Examples:
  PeerMatch's free-text tags, the notes, and the offers a shadchan has sent you (*"Mrs. Katz
  sent you 12 offers, mostly 30+ and Russian-speaking — add these?"*). You confirm with one tap.

**7. Which shadchanim are actually useful**: per shadchan, per list and per source — offers
sent to you, how many you looked into, how many led to a date, how fast they reply.

### 3.5 One card, two uses
A girl suggested **to you** may also be someone you'd suggest **to a friend**. She exists
**once**, as one card:
- in **single mode** she appears in *Offers*, with your own stage (looking into, declined,
  went out…);
- in **shadchan mode** she appears in *Girls*, available to suggest to your friends — with a
  small private marker of your own history with her (*offered to you · you declined*), so
  nothing embarrassing slips through.
Friends you match are **Guy cards** in shadchan mode.

---

## 4. What PeerMatch gets right — all of this is kept

### Getting information in
Paste profile with auto-fill · Android Share → app (text, image, PDF) · WhatsApp chat-export
import (profiles + vCard contacts + history) · **trilingual parsing** (English / Hebrew /
Russian: `שם / גיל / בן 25 / возраст / лет`) · PDF/screenshot attach with *Attach only* or
*Attach + parse*, file always kept · guided voice entry · audio profile with transcript ·
person photo separate from profile screenshot · age derived from text · contact name filled
from a matching shadchan by phone.

### Organizing
Checkbox selection kept across tabs · tags · religious level and details · quick flags
(divorced, with kids, kohen, kosher for kohen, baal teshuvah, watches movies, prays 3×
daily, smokes) · languages · body type · looking for + to what age · talked by phone / met in
person with notes · waiting for reply · call today / tomorrow reminders on shadchanim ·
shadchan referral grouping · linked shadchan / linked profiles.

### Sending
One message per profile, one tap each, never bundled · one profile → several shadchanim ·
any recipient (saved, typed, or chosen inside WhatsApp) · Make Match → shadchan or either
side's contact person with a prepared message · share a shadchan's contact card ·
**PDF-first** with text fallback · photo as an optional Yes/No second step · **language filter
by line** (English / Hebrew / Russian) · WhatsApp, SMS, Email, Copy · `whatsapp://` on Android so
you return to the app · **logged before handing off**.

### Tracking
History with WhatsApp-style in/out bubbles, text and audio notes · add received reply ·
post-call popup (answered Yes/No, note) · last-call banner · added date · delete an entry.

### Data and tools
ZIP backup · email backup as `.txt` · restore both · on-device translation that never
replaces the original · feature-request link · version badge.

### Standing preferences
Call → Email → WhatsApp → SMS · explicit **Yes / No**, never an X · waiting yellow / inactive
gray · **ב״ה above Edit** · Girl photo left of Edit, girl list photos click-only · Israeli
numbers local, WhatsApp international, +1 and others untouched · PeerMatch's detail order ·
**free options only** · reminders never chase singles · basic phones (Call/SMS only) supported.

---

## 5. The data model

```
   INBOX ITEM ──file──▶ becomes / attaches to any of:

   ME (single mode)          CARD (a single)            CONTACT (shadchan, contact
   profile versions ──sent──▶ …                         person, reference, parent)
          │                        │                         ▲
          │                        ▼                         │
          └──────────────▶ SUGGESTION / OFFER ◀──suggested by┘
                           (me ↔ her in single mode,
                            guy ↔ girl in shadchan mode)

   ACTIVITY  one timeline entry, linked to every record it involves (shown in each, deleted once)
   TASK      a due date on a contact, offer/suggestion, or "update my profile" — never chases a single
   LIST      smart (saved categories, updates itself) or manual (hand-picked); own keep-in-touch interval
   CATEGORY  the shared, editable chip vocabulary used by contacts, cards and my profile
   FILE      photo / PDF / audio stored once, referenced by id
```

- **Inbox item** — received when, from which channel, raw text / files / audio + transcript,
  what the app detected, status (new / filed / dismissed), what it was filed as. Never lost.
- **Me** (single mode) — the owner's own profile, as **versions** (text, PDF, photos, facts,
  date, what changed) + pending-update checklist.
- **Card** — a single: name + Hebrew/Russian spellings, **age with its date** (or date of
  birth), city, profile text **verbatim**, looking for, all PeerMatch flags and fields,
  photos, resume files, audio, contact people, references, **categories** (§3.4, many worked
  out automatically), **source** (who, when, how),
  status (active / on hold / dating / engaged / married / not available), untouched copy of
  any imported PeerMatch record.
- **Contact** — name, **roles** (shadchan, contact person, reference, parent — one person,
  one record), several phones (mobile / landline), email, city, communities, languages,
  **categories** (the shared set, §3.4), **where they came from** (+ referred by, linked),
  favorite, lists, keep-in-touch interval, follow-up, waiting, notes.
- **Suggestion / Offer** — the two sides (in single mode one side is *me*; the other side
  may be a light card created from the offer text), who suggested it (several allowed,
  first credited), stage, each side's answer with date, why it ended, dates list,
  references, follow-up.
- **Submission** — what was sent (card or *my profile version*), to whom, when, how, which
  languages / PDF / photo. Powers "who has my profile" and repeat-send warnings.
- **Activity** — one record with links (PeerMatch stored a shared event twice and needed
  `shareLinkId`, fingerprints and tombstones to keep the copies in sync; this removes that).
- **Source** — where an offer or card came from: a shadchan (a Contact), a **site**
  (SawYouAtSinai, ChabadMatch, BasheretNow, FindYourBashert, …), a site's matchmaker, a friend,
  or yourself. Cards carry **site profile numbers / links** per site (`{site, profileId, url}`),
  the strongest duplicate signal there is.

### 5.1 Importing PeerMatch
- **Shadchanim** → Contacts (role *shadchan*), with their full history, reminders, waiting
  state and referral links.
- **Girls** → Girl cards (shadchan mode). Because some were suggested **to you**, the import
  ends with one quick screen: every girl with a **Yes / No — "was she suggested to me?"**
  (pre-ticked where her history makes it likely, e.g. an incoming WhatsApp from a shadchan).
  Yes → she also gets an Offer in single mode. This can be changed later per card.
- **Guys** → Guy cards (your friends / people you match).
- **History, photos, PDFs, audio** → Activities and Files, with their **real original dates**.
- Every record also keeps an **untouched copy** of its PeerMatch fields.
- Import can be repeated; records already imported are recognized, not duplicated.

---

## 6. What dedicated shidduch software teaches

- **MyShadchan** (open-source parent/single-side CRM; its full product spec was read):
  - an **Inbox distinct from the pipeline** — nothing lands in a decision state by itself;
  - an optional **quick-link step at capture** ("which shadchan? which offer?") that is
    **one-tap skippable**, never a blocking form;
  - **non-resume messages file as notes** on a shadchan or offer;
  - the key feature: on capture, **check against every past suggestion and dating
    history** on name + parents + school + shul + location, across **Hebrew ↔ English**,
    **never name-only**, **never auto-merge**; age is too unreliable to match on;
  - triage *New → Look into → Not sure → For sure not*, then *Yes / Unsure / No* — a gut
    no is kept distinct from a considered no;
  - references as reusable contacts with call status and "what they said";
  - reminders on a shadchan, suggestion or reference;
  - per-shadchan **productivity**: offers → how many progressed → how many led to dates;
  - the single's view is **calm**: only live offers, never the pile of rejections.
- **shadchan.im**: "every suggestion, **what came back**, and **what's due next**."
- **ZivugTech**: stages you move a suggestion through; "combo tags and filters".
- **Shadchan Pro**: criteria search, **side-by-side compare**, suggestion status.
- **SawYouAtSinai**: each side accepts or declines; a response window; **never the same
  pair twice**; statuses *spoke on phone → first date → dating exclusively → engaged*.
- **ZUUG**: boy's side is asked first.
- **Between Carpools** (parents' spreadsheet): date mentioned, status, **reason**.

Where ZivugBase differs: MyShadchan relies on a cloud server (email-in address, paid AI
reading). With **no cloud**, ZivugBase replaces email-in with Share / Paste and paid AI with
the on-phone trilingual parser — and keeps PeerMatch's sending speed, which none of them have.

---

## 7. What went wrong structurally in PeerMatch, and the rebuild rule for each

Measured on v131 (75 live files, ~600 KB):

| Problem | Evidence | Rebuild rule |
|---|---|---|
| Many owners for one job | **22 files** open WhatsApp/SMS/email/share; 4 WhatsApp queues bridged by a global `localStorage` patch | **One send service**, one queue |
| Layers fighting layers | **33 files** re-wrap `openP/openS/renderP/renderS`; **56 MutationObservers**; fixes that never ran (v111–v115) | Each screen rendered from data by **one** component; no file patches another's screen |
| One event stored twice | share history mirrored into two records, then reconciled (v100, v127) | **One Activity with links** |
| No suggestion object | Make Match writes text into 3 histories | **Suggestion/Offer** is a real object |
| Whole database in one row | every `save()` rewrites `kv['state']` including photos/PDFs/audio | **Real tables**; save only what changed |
| **Data can be evicted** | `navigator.storage.persist()` never called | Request persistent storage; show status on Home |
| **Share-in overwrites** | every share stored under the single key `'pending'`; a 2nd share erases the 1st | **Inbox queue** |
| Age goes stale | age stored as a bare number | age + the date it was true |
| CDN dependencies | PDF.js / Tesseract loaded from public CDNs NetSpark can block | **Self-host everything** |
| Bugs found only on the phone | no automated tests | **Tests gate every deploy** |

---

## 8. Features by priority

**K** = kept from PeerMatch · **N** = new

### Must have
1. **N** Inbox: Share-in queue, Paste (with WhatsApp sender detection), Voice note with
   transcript, Photo, Add from contacts; nothing ever overwritten.
2. **N** Automatic detection, extraction (EN/HE/RU) and one-tap filing; triage screen.
3. **N** Duplicate / "already suggested" / "already went out" / **"already contacted on a
   site"** warnings.
3a. **N** **Sites as sources** + **Paste a list** (copy a site's list or share screenshots →
   table → one status for all) + site profile numbers.
4. **N** Single mode: Offers pipeline with stages, several suggesters, follow-ups.
5. **N** Single mode: My profile with versions, "who has it", update checklist, send updates.
6. **N** Shadchanim book: keep-in-touch intervals, has-my-profile, offers from them;
   **shared categories** (chips, private ones locked), **where they came from** + referral
   tree, favorites, A–Z index, **bulk import** from phone contacts / `.vcf` / WhatsApp group,
   **bulk tagging** and the **tagging sprint**.
6a. **N** **Smart and manual lists**, each with its own keep-in-touch interval;
   **"Who should have my profile?"** coverage.
7. **N** Home with capture bar, Inbox, action items, recently added, data section; mode switch.
8. **N** Persistent storage + backup reminder. Age that stays correct.
9. **K** The one send service: WhatsApp / SMS / Email / Copy, PDF-first, photo step,
   language filter, `whatsapp://`, logged first.
10. **K** Notes, audio notes, post-call popup, waiting, call reminders, history delete.
11. **K** Backup ZIP + email TXT + restore; **import PeerMatch backups**.
12. **N** Long-press icon shortcuts: *Voice note · Paste · New offer*.

### Should have
13. **N/K** Shadchan mode: Guys / Girls / Shidduchim / Lists / Find matches / Sent-to
    (everything in §3.2 and §4).
14. **N** References with call status and notes.
15. **N** Shadchan stats (offers, progressed, led to dates).
16. **K** WhatsApp chat-export import.
17. **N** Message templates (intro, sending profile, follow-up) in English / Hebrew / Russian.
18. **N** App text in **Hebrew (right-to-left) and Russian** as well as English, for "anyone".
19. **N** Password-protected backups (the email `.txt` is readable by anyone today) and an
    optional app PIN.
20. **K** Guided voice, audio profile transcript, on-device translation.

### Later / optional
21. **N** Optional Android add-on (§9).
22. **N** "Remind me" through the phone's calendar — a free way to get a reminder that
    rings while the app is closed, with no install.
23. **N** Experiment: an AI model running inside the browser to fill fields from messy text
    (see §10) — only if it proves good enough in Hebrew and Russian.
24. **N** Export a list as a printable page.

---

## 9. The optional Android add-on — only what's really worth installing

A web app **cannot**, on any phone: read incoming WhatsApp/SMS/email notifications; know that
a call just ended (or whether it was answered, or who called you); ring a reminder while the
app is closed; send a photo or PDF **straight into one chosen WhatsApp chat**.

Ranked by how much typing and chasing each one removes:
1. **Automatic capture** of WhatsApp, SMS and email notifications from **known contacts**
   into the Inbox — zero taps. (Limits: only what the notification shows — text, not the
   attached PDF; nothing if you were already inside that chat.)
2. **After every call** with a known contact (incoming too): *"Anything to note from your
   call with Rabbi Cohen?"* with a voice-note button.
3. **Real reminder notifications** for calls due, check-ins and follow-ups.
4. **Send a photo / PDF directly into one chosen WhatsApp chat** (undocumented WhatsApp
   feature — may stop working).

How: the same app wrapped with **Capacitor** (free), built into an APK by GitHub Actions
(already proven: PeerMatch's signed 1.0 APK built there on Sep 14). You already started this —
`match/android` has a WhatsApp notification listener, and the Sep 16
`test/whatsapp-photo-recipient` branch tried #4 (its build failed, so it was never answered).
**First a one-day test APK** proving #1 and #4 on your phone and that NetSpark allows the
install. The web app never depends on the add-on.

---

## 10. Technology (all free)

| Part | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Claude maintains this code; errors are caught when building, not on your phone |
| UI | **Preact** + signals | ~4 KB, one component per screen — no file can patch another's screen |
| Build / hosting | **Vite** → **GitHub Pages** via Actions | Static site, no server; live at `shiduchim.github.io/zivugbase` |
| Database | **Dexie** (IndexedDB) | Real tables, indexes, versioned migrations, lists that update themselves |
| Search | **MiniSearch** | Fast, typo-tolerant — helps with transliterated names |
| PDF / OCR | **PDF.js + Tesseract**, self-hosted, English / Hebrew / Russian data | Loaded only when asked; same site, so NetSpark can't block a CDN |
| Speech | Chrome speech recognition, **on-device when the phone supports it** | Otherwise Chrome may use Google's servers for the transcript — the same as PeerMatch's voice features today |
| Tests | **Vitest + Playwright** | Parsers, phone rules, duplicate checks, backup round-trip, capture flows — **must pass before any deploy** |
| Add-on (optional) | **Capacitor** APK | Same code |

**No AI service.** Chrome's built-in model is desktop-only, and paid APIs are excluded.
An AI model *can* run inside Chrome on many Android phones (WebGPU, Chrome 121+), but needs a
one-time 300 MB–2 GB download and its Hebrew/Russian quality at that size is unproven — so it
is a later experiment (#23), never a dependency. The rule-based trilingual parser is the default.

### Data safety
Separate site from PeerMatch → separate database; **PeerMatch is never touched**, and both run
side by side until you're satisfied. ZivugBase imports PeerMatch backups at any time and keeps
an untouched copy of every imported record. Persistent storage requested. Dates and history are
never invented.

---

## 11. Build stages

Single mode first — it is the owner's daily use, and PeerMatch keeps covering shadchan work
until Stage 4. Every stage: deploy → you import your real PeerMatch backup → you test on the
phone. Nothing is called device-verified until you test it.

| Stage | Delivers | You test |
|---|---|---|
| **1. Foundation + capture** | Tooling, tests, CI gate; database; PeerMatch import; backup/restore; Home with capture bar; **Inbox** (Share-in queue, Paste with WhatsApp sender detection, Voice note, Photo); detection + extraction; triage screen; Shadchanim book with **categories, where-they-came-from, favorites, A–Z, bulk import from contacts, bulk tagging, tagging sprint**; mode switch | Share 3 things in a row, paste a WhatsApp conversation, dictate a call note — all in the Inbox, nothing lost; import 50 shadchanim from your contacts and categorize them in one sitting |
| **2. Single mode** | Smart + manual lists, **"Who should have my profile?"**; Offers pipeline, duplicate / already-went-out / already-contacted warnings, several suggesters, follow-ups; **sites as sources + Paste a list**; the PeerMatch "suggested to me?" screen; **My profile** with versions and "who has it"; the one send service | Paste your ChabadMatch list and mark it contacted; file an email idea and get warned it's a repeat; send your updated profile to everyone with the old one |
| **3. Tracking** | Action items on Home, keep-in-touch intervals, post-call popup, references, dates log, shadchan stats, templates, calendar reminders | A week of real use |
| **4. Shadchan mode** | Guys / Girls / Shidduchim, Make Match → Suggestion, Sent-to, filters, Lists, Find matches; full PeerMatch parity | Your PeerMatch data working in shadchan mode |
| **5. Polish for anyone** | Hebrew + Russian app text, WhatsApp chat import, guided voice, translation, password-protected backups, PIN | Hand it to someone else |
| **6. Optional add-on** | One-day test APK, then the add-on if it passes | Automatic capture of a shadchan's WhatsApp |

---

## 12. Status of open questions

Rev 2's three questions are answered (§1, rows 5–7). Remaining:
1. **Go-ahead for Stage 1.**
2. **One sample per site** (SawYouAtSinai, ChabadMatch, BasheretNow): a copied list page or a
   screenshot, names removed if preferred, to tune *Paste a list* for that site. Needed by
   Stage 2, not Stage 1.
3. **One settings switch when Stage 1 is ready:** the new app has a build step, so GitHub Pages
   must be set to deploy from **GitHub Actions** (Settings → Pages → Source). Until then the
   old prototype keeps serving.

---

## Sources

- MyShadchan — https://github.com/dniasoff/myshadchan
- MyShadchan product spec — https://github.com/dniasoff/myshadchan/blob/main/_bmad-output/planning-artifacts/prds/prd-myshadchan-2026-07-21/prd.md
- shadchan.im — https://www.shadchan.im/
- ZivugTech — https://www.zivugtech.org/
- Shadchan Pro — https://www.shadchanpro.com/
- SawYouAtSinai — https://en.wikipedia.org/wiki/SawYouAtSinai
- ZUUG — https://zuug.app/
- Google Contacts labels — https://support.google.com/contacts/answer/30970
- Monica personal CRM — https://github.com/monicahq/monica
- folk CRM groups and fields — https://help.folk.app/en/articles/9790806-folk-data-model
- HubSpot active vs static lists — https://www.hublead.io/blog/hubspot-active-vs-static-list
- Recruitment tagging vs custom fields — https://giighire.com/2026/08/10/custom-fields-vs-custom-tagging/
- Faceted classification — https://www.hedden-information.com/faceted-classification-and-faceted-taxonomies/
- Specialized shadchanim (special needs) — https://www.beineinu.org/special-needs/special-needs-shidduchim/641-shadchanim/2932-special-needs-shadchanim-israel
- Hashkafa categories — https://en.wikipedia.org/wiki/Hashkafa
- ChabadMatch FAQ — https://www.chabadmatch.com/about.php
- BasheretNow — https://jewishjournal.com/community/327779/new-jewish-dating-app-basheret-allows-users-to-play-matchmaker-re-define-online-dating/
- Between Carpools — https://betweencarpools.com/organize-keep-track-of-resumes/
- Shidduch resume sections — https://shidduchim101.com/writing-shidduch-resumes/
- WhatsApp copy includes sender and time — https://www.guidingtech.com/whatsapp-forward-tricks/
- PWA shortcuts and share target — https://web.dev/learn/pwa/enhancements
- Contact Picker API — https://developer.chrome.com/docs/capabilities/web-apis/contact-picker
- On-device speech recognition — https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static
- Persistent storage — https://web.dev/articles/persistent-storage
- Notification Triggers — https://developer.chrome.com/docs/web-platform/notification-triggers
- Chrome built-in AI — https://developer.chrome.com/docs/ai/prompt-api
- WebLLM (AI in the browser) — https://github.com/mlc-ai/web-llm
- WhatsApp `jid` share intent — https://medium.com/@mkcode0323/simplifying-image-and-text-sharing-via-whatsapp-from-your-android-app-0cc914b118c6
- Capacitor Android builds in GitHub Actions — https://capgo.app/blog/automatic-capacitor-android-build-github-action/
- NetSpark — https://www.netsparkmobile.com/en/application/
