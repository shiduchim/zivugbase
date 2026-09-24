# ZivugBase — Product design and build plan

Revision 5 — 2026-09-24. **Design only; no application code has been written for it yet.**
This is the handoff between stages: every later stage starts by reading it, and code must follow
the design principles in §2.

Reference app: PeerMatch v131 (`shiduchim/match`, `main` @ `7fdfced`).
Revision history: rev 1 audit + first model · rev 2 capture-first + two modes · rev 3 dating
sites, shared cards, import mapping · rev 4 organizing hundreds of shadchanim · **rev 5 a
research round on simplicity, privacy, backup, accessibility, errors and real workflows; the
model is simplified and the whole plan is consolidated into one design.**

---

## 0. In one paragraph

ZivugBase is a private, free, **capture-first shidduch organizer** that anyone can use without
learning it. Information arrives outside the app — WhatsApp, email, phone calls, dating sites —
so the app's first job is to take it in with **one gesture** and **do the typing itself**. Its
second job is to answer, every morning, **"who do I need to deal with today?"** in one list.
Everything else follows three rules: **one person = one record**, **one way to do each thing**,
and **nothing leaves the phone unless you send it**. Two modes over one shared database: **for
me** (you are single) and **for people I help** (shadchan work). No accounts, no cloud, no app
store; an optional Android add-on exists only for what a web app cannot do.

---

## 1. Decisions recorded

| # | Topic | Decision |
|---|---|---|
| 1 | Who it's for | The owner is **a single guy**; the app must work for **anyone** — singles (guy or girl), parents, friends, shadchanim. |
| 2 | Modes | **"For me"** (single) and **"For people I help"** (shadchan). Both can be on. Kept after challenge — see §6.1. |
| 3 | Follow-ups on ideas | Yes, try it. |
| 4 | Install | **None by default.** Optional Android add-on only for features really worth it (§20). |
| 5 | Cloud | **None.** Everything stays on the device. |
| 6 | #1 pain | Information arrives outside the app; typing it in wastes time → capture-first (§8). |
| 7 | PeerMatch's data | Its Girls are single girls, some suggested to the owner, kept so they can be **offered to friends** → one person record serves both modes. |
| 8 | Language | English app text for now; all text kept in one place for Hebrew/Russian later. |
| 9 | Voice | Voice notes are transcribed (on the phone when possible, otherwise Chrome's recognition). |
| 10 | Dating sites | SawYouAtSinai, ChabadMatch, BasheretNow… are sources; everyone contacted there is recorded so they're **not offered again** (§8.5). ChabadMatch shows the owner most names. |
| 11 | Hundreds of shadchanim | Shared categories, where each contact came from, lists, bulk import and tagging (§9). |

---

## 2. The ten design principles (rules for the code)

Derived from the research in this document. Every screen and every change is checked against them.

1. **Capture in one gesture, file in one tap.** Never make the user type what already exists
   somewhere — a message, a PDF, a contact, a site's list.
2. **One person = one record.** Whatever roles a person has (single, shadchan, a girl's mother,
   a reference, a friend), they exist once. Duplicates are **never** merged silently and
   **never** created silently.
3. **The original is the record.** The message, PDF, photo or voice note is kept exactly as it
   came. Extracted fields exist to help search and duplicate-checking — **never required**.
4. **Where things stand is always one line, at the top.** Every person and every idea shows its
   status, whether you're waiting and since when, the next step, and last contact — never buried.
5. **One list for today.** Everything needing attention is on Home in one list, with the reason
   and a one-tap action. No second place to check.
6. **One way to do each thing, one owner in the code.** One share flow, one timeline, one search,
   one capture inbox. (PeerMatch had 22 files that could send a message.)
7. **Nothing leaves the phone unless you send it — and you see it first.** Outgoing messages are
   built **only** from fields marked shareable, and the exact text is shown before sending.
   Private fields cannot go out.
8. **Nothing is lost.** Record before handing off to another app; **Undo** instead of
   "Are you sure?"; deleted items kept 30 days; forms saved as drafts; backups reminded. Every
   failure says **what happened, what is safe, what to do next**.
9. **Plain words, big targets, thumb reach.** Words, not icon-only buttons; touch targets at least
   48 px; main actions at the bottom of the screen; follows the phone's text size; nothing that
   exists **only** as a swipe or long-press.
10. **The app grows with the data.** Empty screens teach what to do; filters, the A–Z index and
    lists appear when there is enough data to need them. No tutorial, nothing to configure first.

---

## 3. What rev 5 changes — challenges to our own plan and to PeerMatch

The owner's research brief asked to challenge assumptions, merge concepts and remove features.

### 3.1 Merged (fewer concepts, same power)

| Before | After | Why |
|---|---|---|
| Separate **Card** (single), **Contact** (shadchan, contact person) and **Me** | **Person**, with roles | One person = one record (a shadchan who's also a girl's mother; the owner, who is single *and* matches friends). One phone number → one person → duplicate-checking works everywhere. |
| "Suggestion" / "Offer" / "Shidduch" / "Match" | **Idea** | The owner's own word ("someone sent me a shidduch idea"). One word in both modes. |
| **Submission** object | an **Activity** of kind *Sent profile* | "Who has my profile / which version" is computed from what was sent. One less object. |
| **Task** object (due date + note) | **Next step** on a person or idea: *what + when*, with Snooze | Avoids becoming a task manager; one next step per person/idea keeps it simple. |
| Manual **Waiting** toggle (PeerMatch) | **Automatic**: sending starts waiting; logging a reply or a call ends it. Manual override kept. | One less thing to remember; "no answer in 5 days" appears in Today by itself. |
| Last-call banner + waiting badge + call reminder (3 PeerMatch features) | one **"Where things stand" line** | Principle 4. |
| Home panels: calls due / waiting / follow-ups / check-ins | one **Today** list, most urgent first, each row with its reason | Principle 5 — one place to look at 9 AM. |
| Quick flags + tags + religious level + body type (4 PeerMatch systems) | one **Categories** system (tap chips) | One vocabulary for people and shadchanim; private ones locked. |
| "Talked by phone" / "Met in person" checkboxes | derived from the **timeline** (a logged call = talked by phone; *Met in person* is a one-tap entry) | Record once, not twice. |
| Person photo + profile screenshot + PDF attachment (3 slots) | **Photos** and **Resume** (a resume is a PDF *or* an image) | Two clear slots. |
| Sender name/phone (4 legacy fields) + Contact 1/2 + profile phone | the person's own phone + **Contact people** (linked persons: mother, friend, rav…) | One model instead of three generations of fields. |
| Smart lists / manual lists / saved searches | **Lists** — a list is a saved search or a hand-picked group | One concept. |
| Make Match as its own flow | **New idea** from two selected people, then Share | Same flow as any idea. |

### 3.2 Removed from PeerMatch

| Removed | Replaced by |
|---|---|
| Four WhatsApp send queues + the global `localStorage` patch | one share flow and one queue |
| Guided voice (the app prompts field by field) | speak freely → the app extracts the fields (**owner to confirm**, §25) |
| Referral nesting in the Shadchan list (4 style files, v98–v101) | "Referred by" on the person + *group by referrer* when wanted |
| "Are you sure? This cannot be undone" deletes | Undo + Recently deleted (30 days) |
| Logging a send as done the moment WhatsApp opens | recorded as *sending*, then **"Sent? Yes / No"** on return |
| Separate "Copy" button in the selection bar | *Copy* is one of the channels in the share flow |
| Every layout patch / MutationObserver / screen-rewrapping file | one component per screen |

### 3.3 Added because research showed a big gain

**Today** list · **"Where things stand"** line · **Undo / Recently deleted** · **Sent? Yes/No** ·
**search words become filters** ("jerusalem 30 last year") · **Compare two people** ·
**emailed backup as a PDF** instead of a text file · **encrypted backups** · **photos cleaned of
hidden location data** · **first run that offers Restore / Import / Start** · **drafts** ·
**CSV import** (for people who kept a spreadsheet).

---

## 4. Words used in the app

Research on older and non-technical users (Nielsen Norman Group) is consistent: everyday words,
never system words.

| Say | Never say |
|---|---|
| People | contacts, records, entities, leads |
| Idea | suggestion object, match, lead, opportunity, pipeline |
| Status | stage |
| Next step | task, follow-up item, reminder object |
| Waiting for an answer | pending, awaiting response |
| Where they came from | source, lead source, attribution |
| Share | export, send via channel |
| Resume | attachment |
| Backup / Restore | export / import database |
| Categories (shown by their names: *Age*, *Religious level*…) | tags, facets, metadata |

---

## 5. Data model

```
                         ┌─────────────────────────────┐
   INBOX ITEM ─file───▶  │ PERSON  (one per human)     │ roles: me · single · shadchan ·
   (anything captured,   │  profile, photos, resume,   │ contact person · reference · friend
    never overwritten)   │  categories, where they came│
                         │  from, next step, lists     │
                         └──────┬──────────────┬───────┘
                                │ two people   │ "contact people", "referred by"
                                ▼              │  (links between persons)
                         ┌──────────────┐      │
                         │ IDEA         │◀─────┘ suggested by (a person or a site)
                         │ status, each │
                         │ side's answer│
                         └──────────────┘
   ACTIVITY  one timeline entry (note, call, message in/out, profile sent/received, status
             change, met in person) linked to every person and idea involved — shown in each
             timeline, deleted once
   FILE      photo / PDF / audio stored once; referenced by id
   LIST      saved search or hand-picked group of people; optional keep-in-touch interval
   CATEGORY  the shared, editable chip vocabulary (private ones locked)
```

**Person** — name (+ other spellings), gender, **roles**, **age with the date it was true** (or
date of birth → current age always right), city, phone(s) (mobile/landline), email,
**profile** (text verbatim + **versions** with dates), **Resume** files, **Photos** (re-encoded,
§12), **Looking for** + **age range sought**, **categories**, **contact people** (links),
**where they came from** (+ referred by, date added), **site profile numbers** per dating site,
**next step**, favorite, lists, status (for singles: available · on hold · dating · engaged ·
married), notes, untouched copy of any imported PeerMatch record.
*Derived, never typed:* last contact, waiting since, talked by phone, who has their profile,
ideas they're part of; for shadchanim, the ideas they sent you and how useful they've been.

**Idea** — the two people (one may be *me*; the other may be a light record made from the
message), **suggested by** (one or more persons or sites; first one credited), **status**
(new · looking into · yes / no / maybe later · waiting for the other side · dating · paused ·
engaged · ended), **each side's answer** with date, **why it ended** (who, reason chips + note),
dates, references asked (+ what they said), next step, notes. **Notes about the idea stay on the
idea**; notes about a person stay on the person.

**Activity** — when, kind, channel, text/audio, links; for *Sent profile* also which version,
which files, which languages. Status changes are recorded automatically.

**Inbox item** — received when, from which channel, raw text/files/audio + transcript, what was
detected, status (new · filed · dismissed), what it became.

---

## 6. Navigation and screens

### 6.1 Modes — challenged, kept, made light
The brief warned against modes unless research supports them. It does, narrowly: every product
found serves **one side** — MyShadchan is parent/single-side only; ZivugTech and Shadchan Pro are
shadchan-side only — because the two sides need **different first screens and lists**. A single
should not wade through *Guys / Girls / ideas between others*. But the data is identical, so a
mode is only **which tabs show**. First run asks *"Who is this for?"* — **Me (I'm single)** ·
**People I help** · **Both**. Changeable any time; nothing is lost.

| Me | People I help | Both |
|---|---|---|
| **Home · Ideas · People · Me** | **Home · Ideas · People** | **Home · Ideas · People · Me** |
| Ideas = ideas for me | Ideas = ideas between people | Ideas has chips *For me · For others* |
| People opens on *Shadchanim* | People opens on *Singles* | People has chips |

**People** always has chips across the top — *Shadchanim · Girls · Guys · Everyone* — one tab
instead of three. Small bottom tabs, with words.

### 6.2 Home — "what do I do now?"
1. **Inbox** — *"4 new items — file them"* (only when there are any).
2. **Today** — one list, most urgent first. Each row: who, **why** (*"Call — planned for today"*,
   *"No answer in 6 days"*, *"Check in — 45 days"*, *"Her side's answer is due"*, *"Update your
   profile: 3 changes"*), and one tap: **Done · Snooze · Call · WhatsApp**.
3. **Going on now** — ideas being looked into or dating.
4. **Recently added.**
5. **Backup line** — *"Last backup: 9 days ago · Back up now"* (yellow when overdue).
6. **Capture bar**, fixed at the bottom where the thumb is: **Paste · Speak · Photo · +**
Settings (mode, backup, restore, import, storage, about) sit behind one ⚙ at the top — Data is
not a tab.

### 6.3 The person screen — the whole state on one screen
Modelled on the medical **patient banner**: the facts that prevent mistakes are always at the top,
in a fixed place.
1. **Banner**: photo/initials · name · current age · city · role chips · ⭐ · **Edit** (ב״ה above).
2. **Where things stand**: status · waiting since · next step · last contact (one line; tap to change).
3. **Action row**: **Call · Email · WhatsApp · SMS** (owner's order) · **Share** — only the ones
   with a number/address.
4. **Profile** (text, or the resume) → **Looking for** / age range → **Resume & Photos**.
5. Collapsed, each with a count: **Ideas (3)** · **Has their profile (7)** · **Contact people (2)**
   · **Categories** · **Where they came from** · **Timeline (41)** · **Notes**.
6. Added date at the bottom.
For a shadchan the same screen shows *Ideas they sent you*, *Has your profile (version)*,
*Categories they handle*, *Where they came from*.
**Never more than two taps** from any person to: calling them, sharing their profile, their last
conversation, their next step.

### 6.4 Ideas
Chips: *Active · Looking into · Waiting · Dating · Went out · Declined · Contacted on a site ·
All*, plus *by who suggested it*. Row: *Her ↔ Me* or *Him ↔ Her* · who suggested · status ·
whose answer is pending and for how long. Idea screen: **both people side by side** (this is also
the Compare view) · each side's answer with **Yes / No** · dates · references · why it ended ·
timeline.

### 6.5 Me (single mode)
Your profile and its **versions** · **Pending updates** (filled from captured requests) · **Has
your profile**: every shadchan, which version, when — outdated ones flagged · **Share** ·
**"Who should have it?"** (§9).

### 6.6 Search — in the top bar of every screen
Goal: **find the right person in 2–3 seconds** — not a search engine.
- **As you type**: people, ideas, notes and the Inbox; most recently touched first; forgiving of
  spelling.
- **Words become filters automatically**, shown as removable chips: a number → *age ≈ 30*; a known
  city/region → *Jerusalem*; *guy/girl* → gender; a shadchan's name → *from Mrs. Katz*;
  *last year / this month* → date added; *waiting / dating…* → status. So *"jerusalem 30 last
  year"* finds "that guy from Jerusalem, around 30, someone gave me last year".
- **Recent searches** under the box; any search can be **saved as a list** in one tap.
- No separate advanced-search screen — the chips are the filters. No AI search, no query syntax.

### 6.7 Desktop
The same app. On a wide screen it becomes **two panes** (list left, person right) with a few
keyboard shortcuts (`/` search, `n` new). **Stated plainly:** with no cloud, the computer has its
**own copy**; moving data between phone and computer is **backup → restore**.

---

## 7. The share flow — the only way anything is sent

**What** (a person's profile, your profile, an idea) → **To whom** (search or recent; for a
profile, **suggested recipients**: shadchanim who handle this kind of single and don't have it
yet) → **How** (WhatsApp · SMS · Email · Copy) → **preview of exactly what goes out** → send.
- **PDF-first**: a resume PDF is sent as the PDF; if it's removed, the text profile is used
  automatically. OCR'd text never replaces the PDF.
- **Photo** as an optional Yes/No second step.
- **Language lines** (English/Hebrew/Russian) chosen at send time.
- **Looking for** only if ticked in the preview (unticked by default, as in PeerMatch; remembered
  per person). **Age range sought** is never shared.
- **Built only from shareable fields** (profile, resume, photos, chosen contact person). Notes,
  categories, timeline, where they came from and 🔒 categories **cannot** go out.
- Several recipients: **one message each, one tap each**, never bundled — a web page cannot
  automate WhatsApp, so this is the minimum (the add-on can remove the chat-picking step).
- Android uses `whatsapp://` so you return to ZivugBase, not a browser page.
- Recorded before leaving as *sending*; on return **"Sent? Yes / No"** (No removes it). Sending
  starts **waiting** automatically.

---

## 8. Capture

### 8.1 Principles
One gesture to capture · capture now, file later (Inbox, never overwritten) · the original is the
record · the app proposes, you tap · file a batch in a minute (one item per screen, likely action
highlighted).

**Capturing never opens a form.** A share or paste shows *"Saved to Inbox ✓ — File now · Later"*;
*Later* (or the phone's Back button) returns you straight to WhatsApp or email. Capture takes
two seconds; filing happens when you have a minute. When the app opens and you've just copied
something, a one-tap banner offers *"Add what you copied?"*.

### 8.2 Channels with no install

| Where it is | How it gets in | Taps | With the add-on |
|---|---|---|---|
| WhatsApp **text** messages | Select one or several → **Copy** → ZivugBase → **Paste**. The main path for text: copying several messages also includes each sender's name and time, so the shadchan is recognized | 3–4 | auto-captured from notifications |
| WhatsApp **files**: PDF, photo, voice note, contact card | Select → **Share → ZivugBase** | 2–3 | — |
| Email text | Select all → Share (or Copy → Paste) | 3–4 | email notifications captured as a pointer |
| Email attachment | Tap attachment → Share | 2 | — |
| SMS | Select → Share, or Copy → Paste | 2–3 | auto-captured |
| A phone call | After hanging up: long-press the icon → **Speak** → say it | 2 + speaking | popup after every call |
| Paper / screenshot | **Photo** → text read on the phone | 2 | — |
| Phone contacts | **Add from contacts** (tick many at once) | 2+ | — |
| A dating site's list | **Paste a list** (§8.5) | 3–4 | — |
| A spreadsheet | **CSV import** with a column preview | 3–4 | — |

To appear in Android's Share menu the web app must be **added to the home screen** (one tap in
Chrome; no app store). On iPhone, Paste, Speak and Photo work; sharing into the app does not.

**Honest limits.** A forwarded WhatsApp **voice note** is stored and playable, but a web app
cannot turn a recorded audio *file* into text (browser speech recognition only listens to the
microphone) — so it's filed with a one-line note you type or speak. **Email** is the clunkiest
channel (Gmail has no "share this email"), hence Select all → Share or Copy → Paste. Nothing is
captured **automatically** without the optional add-on.

### 8.3 What the app does with each item
Detects the kind (profile/idea · contact · "call…/send…" · profile-update request · reply/note) →
extracts in English/Hebrew/Russian (name, age with its date, city, phones, emails, parents, school,
who sent it, dates) → links and warns (*"From Mrs. Katz"*, *"⚠ suggested by Mr. Stein on May 3 —
you said No (age)"*, *"⚠ you went out in 2025"*, *"⚠ contacted on ChabadMatch"*) → offers one-tap
actions (*New idea from Mrs. Katz · Add to existing idea · New shadchan: Rabbi Cohen · Call him
today/tomorrow · Update my profile · Note on … · Dismiss*).

### 8.4 The owner's four examples
1. **Idea by email** → Select all → Share → name/age/city filled in, "from which shadchan?" with
   recent ones first → 1 tap → saved, repeats flagged.
2. **Idea by WhatsApp** → Share; if *copied*, the sender is recognized and nothing is asked.
3. **"Call this shadchan, 052-…" on the phone** → Speak → *New shadchan + next step: call today* →
   1 tap.
4. **"Send an updated profile with these new items"** → filed as **Pending updates** on *Me*;
   after updating, *"11 shadchanim have an older version — share the new one?"*

### 8.5 Dating sites
Each site is a **source**. **Paste a list**: select all + copy a site's list (or share
screenshots) → a table of the people found → untick mistakes → one status for all (*Contacted on
ChabadMatch — Sep 2026*, *Declined on SawYouAtSinai*…). A one-time **sample per site** tunes the
reader to its layout; a typed quick list (`Chaya 26 Crown Heights`) always works. Repeat warnings
are *certain* (same site profile number/link), *likely* (same name in any spelling + age + city)
or *possible* (age + city only, for entries without a name); one tap confirms "same person".
Site email alerts can be shared in, and the site is recognized as the source.

---

## 9. Organizing hundreds of shadchanim

- **One shared set of categories** for people and shadchanim: age range, religious level,
  background, marital status, work/learning, region, languages, 🔒 appearance, 🔒 special
  situations; for shadchanim also *how they work* and *reach them by*. Tap chips; the owner can
  add, rename, merge or hide options. 🔒 = never sent, can be hidden entirely.
- **"Who should have my profile?"** / **"Who should get this profile?"** — computed by matching
  categories, ranked by how useful each shadchan has been.
- **Where they came from** — referred by a person (linked, forming a referral tree) · friend ·
  family · internet search · a site's shadchan list · WhatsApp group · organization · event · ad ·
  already knew them · other — plus date and note → *which sources give useful shadchanim*.
- **Lists** (saved search or hand-picked), each with an optional **keep-in-touch interval**.
- Phone-book habits: **A–Z index**, ⭐ favorites on top, recent, group by letter / region /
  category / source, merge duplicates.
- Hundreds in without typing: **bulk import** (contact picker, `.vcf`, WhatsApp group export, CSV)
  → table → *"all shadchanim, from WhatsApp group X"*; **bulk tagging**; **tagging sprint** (one per
  screen, tap chips, next); **suggested categories** from the ideas they've sent you.
- **Usefulness** per shadchan, list and source: ideas sent → looked into → dated; reply speed.

---

## 10. Follow-ups — deliberately small

Answers one question: **"Who do I need to deal with today?"**
- **Next step** on a person or idea: *what* + *when* (Today · Tomorrow · Next week · a date).
  **Snooze** from Today. Done clears it.
- **Waiting** is automatic (§3.1). After N days with no reply (default 5, changeable) it appears in
  Today as *"No answer in 6 days"*.
- **Keep in touch** (shadchanim): every N days per person or per list; any contact moves the next
  check-in forward by itself.
- **Not included:** recurring tasks, sub-tasks, priorities, projects, a calendar.
- Reminders show when the app is open (a web limit). Two optional ways past it: **"Add to my
  calendar"** (the phone's calendar rings) or the Android add-on.
- Singles are never nagged: next steps go on shadchanim and ideas, not on chasing a single.

---

## 11. Backup and restore

**Findings.** From a web app, Android Chrome can share only certain file types — Chromium's list
includes `.pdf`, `.txt`, `.html`, images, audio and video, **not `.zip`**. That is why PeerMatch
wraps the ZIP as base64 inside a `.txt` (a third larger, and gibberish if opened). Gmail
attachments are limited to 25 MB. No web API can back up in the background.

**Design.**
- **Save to phone/computer**: a real ZIP (unchanged).
- **Email / Drive backup as a PDF** instead of a `.txt`. Page 1 is a readable cover (*"ZivugBase
  backup · 24 Sep 2026 · 312 people · keep private · to restore: open ZivugBase → Restore"*); the
  backup rides inside the PDF as raw bytes — **no base64, so about a quarter smaller** than today's
  `.txt`, which also helps stay under Gmail's 25 MB. Needs an on-phone test that Gmail and Drive
  keep it byte-exact; if not, the `.txt` stays. Old `.zip` and `.txt` backups (PeerMatch or
  ZivugBase) always restore.
- **Encrypted with a backup password** (key stretching per OWASP's recommendation, AES encryption
  built into the browser). Base64 is not encryption: anyone with a PeerMatch `.txt` backup can
  read it. The password is set once and remembered on this phone, so backing up stays one tap;
  restoring on a new phone asks for it. **Accepted knowingly:** a forgotten password means an
  unreadable backup — mitigated by a one-page **recovery sheet** to print or photograph.
- **Reminders, not background jobs**: the Home backup line turns yellow after 7 days with changes
  since the last backup; one tap backs up.
- **Big backups**: share to **Google Drive** from the same share sheet (no 25 MB limit); the app
  warns before a backup would be too big for email.
- **Restore** is the first choice on a fresh install (§15), shows what's in the file before
  replacing anything, and changes nothing if it fails.

---

## 12. Privacy and security

**Three different things, never confused:**
- **Privacy** — the data doesn't leave: no server, no accounts, no analytics, no third-party
  scripts, no CDNs. The only ways out are the share flow and backups, both started by you.
- **Security** — protection even if data leaves or the phone is taken: encrypted backups; the
  phone's lock screen and device encryption for a lost phone.
- **Obscurity** — merely hard to read (base64, hidden screens). Never presented as protection.

| Risk | Protection |
|---|---|
| Someone picks up the unlocked phone | Optional **app PIN**, honestly labelled a privacy screen, not encryption |
| Phone lost or stolen | Android lock screen + device encryption; a recent **encrypted** backup to restore |
| Backup file forwarded, or email account hacked | **Encrypted backups** |
| Private notes sent to a shadchan by mistake | Outgoing text built only from shareable fields; **preview before sending**; 🔒 fields can't be selected |
| A photo reveals where it was taken | Photos **re-encoded when saved**, removing hidden location data. Resume **PDFs kept untouched** — sent exactly as received |
| Browser clears the data | **Persistent storage** requested; status shown in ⚙; backups |
| Storage full / a save fails | Checked before big imports; a failed save is shown at once with "back up now"; never silent |
| Deleting a person | Gone from lists at once, with Undo; kept 30 days in Recently deleted; **Delete forever** available; their files deleted with them. Earlier backups still contain them — said plainly |
| Voice transcription | Chrome may send audio to Google when on-phone recognition isn't available (owner accepted) |

Field tiers: **Shareable** (profile, resume, photos, chosen contact person, optionally *looking
for*) · **Internal** (notes, timeline, categories, where they came from, age range sought,
references, ideas) · **🔒 Private** (appearance, special situations).

---

## 13. Mobile, accessibility and older users

- **Thumb zone**: about half of people use a phone one-handed and the top third is hard to reach
  (Hoober), so the capture bar, main buttons and form Save/Cancel sit at the bottom; destructive
  actions are never where the thumb rests.
- **Text**: 16 px base, **follows the phone's text-size setting**; body contrast aimed at **7:1**
  (NN/g's recommendation for older adults).
- **Targets**: at least **48 × 48 px**, with space between neighbours.
- **Words on buttons**; an icon only *with* a word.
- **No hidden-only actions**: every long-press shortcut or swipe also exists as a visible button.
- **Forms**: short — a name or any one of text / resume / photo is enough; the right keyboard per
  field; *More details* collapsed; **drafts** kept if the app closes.
- **Phone numbers** anywhere in text are tappable → Call · WhatsApp · SMS (kept from PeerMatch).
- **Kosher phones**: a person marked *calls only* is never offered WhatsApp.

---

## 14. Information density — what shows when

| Always visible | One tap away | Two taps at most |
|---|---|---|
| Name, age, city, role · where things stand · contact buttons · profile or resume | timeline, ideas, who has the profile, categories, contact people, where they came from | editing any field, sharing, compare, an idea's history |

Collapsed sections show a **count**; one main button per screen; **one sheet deep** (never a
dialog on a dialog); list rows are two lines; nothing is shown twice.

---

## 15. First run and empty states

No tutorial (NN/g: guidance in context works better than an up-front tutorial; the empty state is
the teaching moment).
- **0 people** — three big choices: **Restore a backup** · **Import from PeerMatch** · **Start
  fresh**, and below them *"Try it: share any WhatsApp message to ZivugBase"* with a three-picture
  how-to.
- **1–10 people** — one-line hints where the action is (*"Tap Share to send this profile"*).
- **About 20+** — filters and Lists appear.
- **100+** — the A–Z index and search chips come forward.
- Every empty list says what would fill it and has the button that does it.

---

## 16. Error recovery

Every message answers: **what happened · what is safe · what to do next.**

| Situation | Behaviour |
|---|---|
| Backup fails | "The backup wasn't created. Nothing on your phone changed. Try again, or save it to the phone instead of email." |
| Share fails / you didn't send | On return: **Sent? Yes / No**; No removes the record |
| A PDF/photo can't be read | The file is **kept**; "Couldn't read the text — type the name, or leave it" |
| Accidental delete | **Undo**, or Recently deleted (30 days) → Restore |
| Browser storage problem | Warning in ⚙ and on Home, with "Back up now" |
| Import interrupted | Imports are **all or nothing**; safe to run again |
| Same import twice | Already-imported records recognized, not duplicated |
| Broken WhatsApp export | Shows what was understood and what was skipped; imports the good part only if you say so |
| Half-filled form, app closed | Next time: "Continue adding Chaya?" |
| Damaged backup | Checked completely **before** anything is replaced; current data untouched on failure |

---

## 17. Import and duplicates

**Sources**: PeerMatch backups (ZIP/TXT) · ZivugBase backups · WhatsApp chat exports · phone
contacts / `.vcf` · CSV spreadsheets (column-matching preview) · pasted text and lists · PDFs and
photos · emails (via Share).

**PeerMatch import**: shadchanim → Persons (role shadchan) with history, reminders and referral
links · girls/guys → Persons (role single) · history and files with real dates · ends with the
**"Was she suggested to me? Yes/No"** screen (pre-ticked where likely) · untouched legacy copy
kept · repeatable without duplicating.

**Duplicates**: signals — phone (strongest), site profile number, email, name across
Hebrew/English/Russian spellings, parents, city, age (weak: resumes are unreliable on age).
**Never merged silently.** A side-by-side merge screen picks each field; *"Not the same person"* is
remembered so it isn't asked again.

---

## 18. AI — only where it truly saves work

| Helps | How |
|---|---|
| Names, ages, phones, dates, cities out of messages | **Rules** — PeerMatch's trilingual parser, extended; no AI needed |
| Text from PDFs and photos | PDF.js + Tesseract **on the phone**, self-hosted |
| Suggested categories | Simple counts of what a shadchan has sent |
| Duplicate detection | Rules + spelling-tolerant name matching |
| Turning a long WhatsApp export into timeline entries | **Later experiment**: an AI model running inside Chrome (WebGPU) — one-time 300 MB–2 GB download, Hebrew/Russian quality unproven |

**Never**: judging compatibility or scoring people · sending anything AI wrote without you reading
it · auto-merging · rewriting the original profile · sending data to an online AI service.

---

## 19. What ZivugBase deliberately does not have

Accounts and sign-in · cloud sync or any server · a public directory, profiles others can see,
likes or any social feature · matching algorithms or compatibility scores · in-app chat (WhatsApp
exists) · paid SMS/email/WhatsApp gateways · streaks, badges, gamification · notification spam ·
charts and dashboards (a few plain counts only) · a form or field designer · a task manager ·
drag-and-drop boards · revocable resume links and an email-in address (both need a server) ·
analytics, trackers, third-party scripts, CDNs · location features · two ways to do the same thing.

---

## 20. Optional Android add-on

Only for what a web app physically cannot do, most valuable first:
1. **Automatic capture** of WhatsApp, SMS and email notifications from known people (text only; not
   attachments; not if you were already inside that chat).
2. **A popup after every call** with a known person, incoming ones too.
3. **Reminders that ring** with the app closed.
4. **A photo / PDF straight into one chosen WhatsApp chat** (undocumented WhatsApp behaviour — may
   break).

Same code wrapped with **Capacitor** (free), built by GitHub Actions (PeerMatch's signed APK built
there on Sep 14; `match/android` already has a WhatsApp notification listener; the Sep 16
`test/whatsapp-photo-recipient` experiment tried #4, but its build failed). **First a one-day test
APK**, including whether NetSpark allows installing it. The web app never depends on it.

---

## 21. Workflows — taps and typing, PeerMatch today vs this design

Estimates from reading PeerMatch's code, not measurements; WhatsApp's own taps included.

| # | Workflow | PeerMatch today | ZivugBase | Main gain |
|---|---|---|---|---|
| A | Single receives a profile from a shadchan (WhatsApp) | ~5 taps, **types sender name + phone**, no repeat check, no status | ~4–5 taps, **no typing** (nothing asked if copied) | no typing; repeat warning; it's an idea with a status |
| B | Single sends own profile to a shadchan | ~8 taps across 2 tabs; version not recorded | ~5–6 taps from *Me*; version recorded | "who has which version" |
| C | Shadchan receives a new person | ~5 taps + typing the sender | ~4 taps, no typing | as A |
| D | A WhatsApp conversation updates a person | find the shadchan, *Add received reply*, paste (~6 taps); not linked to the person | Copy → Paste (~5 taps); linked to the shadchan **and** the person | lands on the right people |
| E | Who needs follow-up today | 3+ places (Calls badge, waiting counts per tab) | **0 taps** — Today on Home | one list |
| F | "That guy from Jerusalem, ~30, got him last year" | text search, then open each to check age and date | 1 tap + "jerusalem 30 last year" | words become filters |
| G | Compare two possible matches | open one, close, open the other | tick 2 → Compare | side by side |
| H | One profile to several shadchanim | ~3 taps each + setup; recipients from memory | ~2 taps each + setup; **suggested recipients** | fewer taps; nobody forgotten |
| I | Lost phone → new phone | only if a manual backup exists; readable by anyone | reminded backups; first screen offers Restore; encrypted | nothing forgotten or exposed |
| J | Share a profile that has a PDF | PDF sent | PDF sent, with a preview | same |
| K | PDF removed, share again | text sent | text sent | same |
| L | Accidental delete | gone after a confirm | **Undo** or Recently deleted | recoverable |

---

## 22. Lessons carried over (condensed from earlier revisions)

**PeerMatch features kept** (the behaviour, not the code): paste profile · share-in · WhatsApp chat
import · trilingual parsing · PDF/screenshot with *Attach only / Attach + parse* · audio profile +
transcript · age from text · contact name from a matching shadchan · checkbox selection across tabs
· looking for + to what age · waiting · shadchan call reminders · referral links · one message per
profile · several shadchanim · any recipient · share a shadchan's card · PDF-first · photo Yes/No ·
language lines · `whatsapp://` · WhatsApp-style timeline · add received reply · post-call popup ·
ZIP + email backup + restore · on-device translation · owner preferences (Call → Email → WhatsApp →
SMS · Yes/No, never ✗ · waiting yellow · ב״ה above Edit · girl photo left of Edit, girl list photos
click-only · Israeli numbers local, WhatsApp international · free only · basic phones supported).

**PeerMatch structural lessons** (v131: 75 live files, ~600 KB): 22 files could send · 4 queues ·
33 files re-wrap the render functions · 56 MutationObservers · fixes that never ran · events stored
twice, then reconciled · the whole database in one row · **persistent storage never requested** ·
**share-in overwrote itself** (one `'pending'` key) · ages go stale · CDN dependencies · no tests.

**Shidduch software**: MyShadchan (Inbox kept apart from the pipeline; skippable quick-link at
capture; multi-signal repeat detection across Hebrew↔English, never name-only, never auto-merge; a
quick *no* kept apart from a considered *no*; references with call status; per-shadchan usefulness;
a calm single's view) · shadchan.im ("what came back, what's due next") · ZivugTech (stages, combo
filters) · Shadchan Pro (criteria search, compare) · SawYouAtSinai (two-sided answers, never the same
pair twice) · ZUUG (boy's side first) · Between Carpools (date mentioned, status, reason).

**Contact management**: Google Contacts (labels, not folders) · Monica ("how you met") · folk
(groups with their own fields) · HubSpot (lists that update themselves vs fixed lists) · recruitment
agencies (one vocabulary for candidates and clients; review tags periodically) · faceted
classification (fixed options stop tag sprawl) · task apps (one *Today* view) · medical records (a
fixed banner of the facts that prevent mistakes).

---

## 23. Technology (all free)

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript | errors caught when building, not on the phone |
| UI | Preact + signals | ~4 KB; one component per screen |
| Build / hosting | Vite → GitHub Pages via Actions | static, no server |
| Database | Dexie (IndexedDB) | real tables, indexes, migrations, lists that update themselves |
| Search | MiniSearch | fast, spelling-tolerant |
| PDF / OCR | PDF.js + Tesseract, **self-hosted**, eng/heb/rus data | loaded only when asked; nothing from a CDN |
| Encryption | Web Crypto (built into the browser) | no library needed |
| Speech | Chrome speech recognition, on-device when available | owner accepted |
| Tests | Vitest + Playwright | **must pass before any deploy** |
| Add-on (optional) | Capacitor APK | same code |

---

## 24. Build stages

Each stage: deploy → the owner imports a real PeerMatch backup → tests on the phone. Nothing is
called device-verified until the owner tests it. PeerMatch keeps running, untouched, until
ZivugBase replaces it.

| Stage | Delivers |
|---|---|
| **1. Foundation** | Tooling, tests, CI gate · data model (§5) · PeerMatch import + "suggested to me?" screen · backup/restore (ZIP, PDF email backup, encryption, reminders) · persistent storage · first run · modes and tabs · People with search chips, A–Z, favorites · person screen · Undo + Recently deleted · drafts · **basic Inbox** (share-in queue, Paste, Speak, Photo; file as a person or a note) |
| **2. Smart capture + organizing** | Detection and extraction (EN/HE/RU), sender recognition from copied WhatsApp, repeat warnings + merge screen, one-per-screen triage · categories, where they came from, bulk import (contacts, `.vcf`), bulk tagging, tagging sprint · Lists |
| **3. Ideas, Me, Share, Today** | Ideas (both modes) · dating sites + Paste a list · Me with versions, pending updates, who has it, "who should have it" · the share flow (PDF-first, preview, Sent? Yes/No) · Today with next steps, automatic waiting, keep-in-touch · post-call popup |
| **4. Helping others, fully** | New idea from two people, Compare, suggested recipients, usefulness numbers, message templates, WhatsApp chat import, CSV import |
| **5. Polish** | Desktop two-pane · app PIN · translation · accessibility pass · Hebrew/Russian app text when wanted |
| **6. Optional add-on** | One-day test APK, then the add-on if it passes |

---

## 25. Open decisions (the owner's answer is needed before Stage 1)

1. **Encrypted backups by default?** Recommended **yes** for email/Drive backups, with a remembered
   password and a printable recovery sheet. Trade-off: a forgotten password makes that backup
   unreadable.
2. **Remove guided voice** (field-by-field prompts) in favour of speak-freely-then-extract?
   Recommended yes.
3. **"Ideas"** as the one word for suggestions/offers/matches in both modes? Recommended yes.
4. **"Looking for"** in outgoing profiles: unticked by default with a checkbox in the preview
   (today's behaviour, made visible); *age range sought* never shared? Recommended yes.
5. **Go-ahead for Stage 1.**

Later (before Stage 3): **one sample per dating site** (a copied list page or a screenshot, names
removed). One GitHub Pages settings switch when Stage 1 is ready.

---

## Sources

Shidduch: [MyShadchan](https://github.com/dniasoff/myshadchan) ·
[MyShadchan product spec](https://github.com/dniasoff/myshadchan/blob/main/_bmad-output/planning-artifacts/prds/prd-myshadchan-2026-07-21/prd.md) ·
[shadchan.im](https://www.shadchan.im/) · [ZivugTech](https://www.zivugtech.org/) ·
[Shadchan Pro](https://www.shadchanpro.com/) · [SawYouAtSinai](https://en.wikipedia.org/wiki/SawYouAtSinai) ·
[ZUUG](https://zuug.app/) · [ChabadMatch FAQ](https://www.chabadmatch.com/about.php) ·
[BasheretNow](https://jewishjournal.com/community/327779/new-jewish-dating-app-basheret-allows-users-to-play-matchmaker-re-define-online-dating/) ·
[Between Carpools](https://betweencarpools.com/organize-keep-track-of-resumes/) ·
[Shidduch resume sections](https://shidduchim101.com/writing-shidduch-resumes/) ·
[Special-needs shadchanim](https://www.beineinu.org/special-needs/special-needs-shidduchim/641-shadchanim/2932-special-needs-shadchanim-israel) ·
[Hashkafa](https://en.wikipedia.org/wiki/Hashkafa)

Organizing contacts: [Google Contacts labels](https://support.google.com/contacts/answer/30970) ·
[Monica](https://github.com/monicahq/monica) · [folk data model](https://help.folk.app/en/articles/9790806-folk-data-model) ·
[HubSpot active vs static lists](https://www.hublead.io/blog/hubspot-active-vs-static-list) ·
[Recruitment tags vs fields](https://giighire.com/2026/08/10/custom-fields-vs-custom-tagging/) ·
[Faceted classification](https://www.hedden-information.com/faceted-classification-and-faceted-taxonomies/)

Usability: [NN/g — older adults](https://www.nngroup.com/articles/usability-for-senior-citizens/) ·
[NN/g — empty states](https://www.nngroup.com/articles/empty-state-interface-design/) ·
[NN/g — confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/) ·
[Reversible actions (undo)](https://blog.logrocket.com/ux-design/ux-reversible-actions-framework/) ·
[Thumb zone (Hoober)](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/) ·
[NHS patient banner](https://www.yumpu.com/en/document/view/34958203/patient-banner-for-clinical-systems-within-the-nhs-in-england)

Platform: [Chromium's shareable file types](https://github.com/chromium/chromium/blob/main/chrome/browser/webshare/share_service_impl.cc) ·
[Web Share](https://web.dev/articles/web-share) · [PWA shortcuts & share target](https://web.dev/learn/pwa/enhancements) ·
[Contact Picker](https://developer.chrome.com/docs/capabilities/web-apis/contact-picker) ·
[Persistent storage](https://web.dev/articles/persistent-storage) ·
[On-device speech](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static) ·
[Notification Triggers](https://developer.chrome.com/docs/web-platform/notification-triggers) ·
[Chrome built-in AI](https://developer.chrome.com/docs/ai/prompt-api) · [WebLLM](https://github.com/mlc-ai/web-llm) ·
[OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) ·
[WhatsApp copy includes sender](https://www.guidingtech.com/whatsapp-forward-tricks/) ·
[WhatsApp `jid` intent](https://medium.com/@mkcode0323/simplifying-image-and-text-sharing-via-whatsapp-from-your-android-app-0cc914b118c6) ·
[Capacitor builds in Actions](https://capgo.app/blog/automatic-capacitor-android-build-github-action/) ·
[NetSpark](https://www.netsparkmobile.com/en/application/)
