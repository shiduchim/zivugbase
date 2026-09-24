# Handoff — building the new PeerMatch

Written 2026-09-24, at the end of a long build session, for the next builder (for example a new
Claude Code session on Sonnet 5). It has four parts:

- what the owner had in PeerMatch
- which new features the owner chose
- which architecture proved good
- what went wrong, so it isn't repeated

The same file is kept in both repositories: `shiduchim/zivugbase` → `docs/HANDOFF.md` and
`shiduchim/match` → `docs/HANDOFF.md`.

**This repository (`zivugbase`) is public.** Never put real names, phone numbers, emails or chats
in code, tests, docs or commit messages.

---

## 0. Paste this into the new session first

> Read `docs/HANDOFF.md` in `shiduchim/zivugbase` completely before doing anything. Then:
>
> - Read `docs/REBUILD_INVENTORY.md` in `shiduchim/match`. It is the screen-by-screen spec of the
>   old app.
> - Read `docs/REBUILD_PLAN.md` in `shiduchim/zivugbase`. It lists the features the owner chose.
>
> Continue the rebuild in `shiduchim/zivugbase`:
>
> - Work in small steps.
> - After each step, deploy and ask me to check it on my phone.
> - Before styling any screen, screenshot the same screen in PeerMatch (section 7 below) and match
>   it.
> - Don't add anything I haven't asked for.
>
> First, ask me what "it doesn't work good" meant when I last tried it (section 9).

---

## 1. Where things stand

| | |
|---|---|
| **PeerMatch** (the old app) | `shiduchim/match`. Live at `shiduchim.github.io/match/`, version **v131**. **Untouched**; the owner still uses it every day. It is 75 plain-JS scripts that patch each other (see §5). |
| **ZivugBase** (the new app) | `shiduchim/zivugbase`, branch `main`. Live at `shiduchim.github.io/zivugbase/`. Deployed automatically when `main` is pushed and every check passes. |
| **Goal** | PeerMatch's layout and every field it has, **exactly**, rebuilt on ZivugBase's cleaner engine, plus the new features the owner picked (§3). Then the owner compares the two side by side on the phone and switches. |
| **Owner's words about the last build** | "It just doesn't work good." What exactly is not known yet — ask (§9). **Nothing in ZivugBase has been checked on the owner's phone.** |
| **Owner's phone** | Android, Chrome, installed as an app (PWA). A **NetSpark** filter is installed: it blocks some sites and apps, and blocked turning on the Android add-on. Kosher phones matter: some contacts only take Call or SMS. |

---

## 2. What PeerMatch has (the owner wants all of it, looking the same)

The full spec, with every field, button and flow, is `shiduchim/match` → `docs/REBUILD_INVENTORY.md`.
This is the short version.

**Screens**

- Three tabs: **Shadchanim · Guys · Girls**.
- Header:
  - "Backup" at top-left
  - ב״ה and a **Make match** button at top-right
  - a "Request an app feature" link
- Every detail and form opens as a bottom sheet.

**Lists**

- A big title with pills: **Waiting for reply N**, and for Shadchanim also **Calls N**. A pill is
  yellow when N > 0 and opens the list of those people.
- Search box, then **Add**.
- Cards:
  - a checkbox and the name
  - pills: Age, From \<contact\>, Screenshot
  - the phone number and the last history line
  - a chevron at the right
  - waiting rows tinted yellow
- **Share bar**, shown once anything is ticked:
  - "Share this profile"
  - Email · SMS · WhatsApp
  - N selected · Select all · Delete · Clear
- Shadchanim are grouped under whoever referred them: a strip reading "N referred shadchanim",
  with the referred cards indented under it.

**Guy / Girl page, in this order**

1. Sticky header: a round back button (48 px), the name, and a photo tile (or, for girls, a
   "Photo" button left of Edit). ב״ה sits above **Edit**.
2. "Last call status" green banner.
3. Age pill.
4. **Call · Email · WhatsApp · SMS · Waiting for reply** — five equal buttons, in that order.
5. Translate: English, Hebrew or Russian, shown **inside the app**.
6. Profile text: WhatsApp `*bold*` shown bold; phone numbers are links that open Call or WhatsApp.
7. Talked by phone / Talked in person. Each opens a "Conversation info" note.
8. Looking for, and "To what age".
9. Attachment, opened with "Open PDF".
10. **Contacts** card: Profile / Contact 1 / Contact 2, each with Call · SMS · WhatsApp.
11. Quick details:
    - checkboxes: Divorced, With kids, Kosher for Kohen, Kohen, Baal teshuvah, Watches movies,
      Prays 3x daily, Smokes
    - Speaks languages (English, Hebrew, Russian)
    - Body type (Regular / Overweight, one choice)
    - Tags, Religious level and Religious details, which save themselves
12. **Linked Shadchan** dropdown, with Open.
13. **History**: a blue band. Each entry has a red **Delete**; outgoing messages are indented like
    chat bubbles; a "To: name • phone" line.
14. "Added to PeerMatch: date".
15. A fixed **Note…** bar with a round mic button, which becomes send or stop.

**Shadchan page**

- Header and Edit.
- **Contact shadchan** row.
- Linked profiles.
- **Call today · Call tomorrow · Clear**.
- Talked by phone / in person.
- Tags, Religious level, Religious details.
- History, then the note bar.

**Forms**

- Add/Edit Guy or Girl:
  - Photo and Audio profile tiles
  - Name + Age
  - **Paste profile**, which fills in empty fields
  - Profile
  - Looking for + To what age
  - Contacts
  - **Attach only / Attach + parse text** (PDF or photo)
  - Tags and Religious fields
  - a floating **Save / Cancel** bar
- Add/Edit Shadchan:
  - Name, Phone, Email
  - Profile / notes
  - Attach
  - Tags and Religious fields
  - **Referred by**: type a name or phone, or choose an existing shadchan

**Flows**

- **WhatsApp sharing**: one message per person, never bundled. A black bottom bar reads "Send N of
  M" [Send][Cancel]. Then, if there's a photo, "Send the photo?" [Yes][No].
  - When no shadchan is ticked, it first asks "Who are you sending this to?": existing shadchan,
    or name/phone, or blank to pick the chat in WhatsApp.
  - One profile + several shadchanim: sent to each in turn.
  - If a PDF is attached, **the PDF itself is sent**, not text.
  - On Android the app opens `whatsapp://`, so leaving WhatsApp comes back to the app.
- **Share text**: Name, "Age: N", profile lines in the ticked languages, "Sent by", "Sender phone".
- **Make match**: tick 1 guy + 1 girl (and at most 1 shadchan).
  - The screen shows a "Suggested match" card, "Send to" (shadchan or either contact person) and
    the message template.
  - Language checkboxes choose what goes in; "Include profile photos" is optional.
  - Buttons: Contact · SMS · WhatsApp · Email.
- **After a call**: tapping any Call button, then coming back to the app, asks "Call ended — add a
  status update?".
  - A note, a recorded audio note, and "Was it answered?" Yes/No. That answer is only a guess from
    how long the app was in the background.
  - It can cancel a shadchan's call reminder.
- **WhatsApp chat ZIP import** (Shadchanim → Import):
  - Reads the chat, the contact cards and the attachments.
  - Finds shadchanim and possible profiles (English, Hebrew, Russian) and shows a review screen.
  - Imports the conversation into that shadchan's History, without duplicates.
- **Share into the app**: from WhatsApp or anything else, via the share sheet.
- **Backup**:
  - Save a real `.zip` (format "PeerMatchBackup" v2).
  - **Email backup**: a `.txt` holding the ZIP as Base64, because Android Chrome won't share a ZIP.
  - Restore accepts either. Every version must still restore.
- **Phones**:
  - Israeli numbers are shown local (05X-XXX-XXXX) and sent to WhatsApp international (972…).
  - Landlines (02, 03, 04, 08, 09) have no SMS.
  - A number that matches a shadchan fills in their name.

**The owner's fixed rules — never change these**

- **Yes / No** buttons, never ✕ or a lone checkbox for a choice.
- **Call → Email → WhatsApp → SMS** order.
- Waiting yellow when on, gray when off.
- ב״ה above Edit; the girl's Photo button left of Edit, and her photos shown only when tapped.
- Free only; no cloud; nothing leaves the phone unless the owner sends it.
- **Never invent a date.**
- Reminders were shadchan-only in PeerMatch. The owner has now asked for **Call due on anyone**.

---

## 3. New features the owner chose (from the ZivugBase experiment)

These are in `docs/REBUILD_PLAN.md`. **Only these are approved.** The owner said: "if I didn't
say it's good, remove it".

| # | Feature | Notes |
|---|---|---|
| 1 | **Folders** | Nested, any depth; one person can be in several folders; folders are labels (removing someone from a folder never deletes them). "📁" icon. **The owner liked the folder icon and the zoom.** |
| 2 | **Zoom − / +** on lists | Three levels: Folders (tree with counts) · Names (one line each) · Details (full cards). |
| 3 | **Filing several people at once** | Tick people → **Add to folder…** (ticks show "some" when only part of the selection is in a folder; Apply; Undo) · **Move to…** · **Take out of this folder**. |
| 4 | **Intake folder** | Called "Intake folder", **not "Inbox"**. Paste now, file later; the text is kept exactly as it came. |
| 5 | **Calls due on Home** | Adding anyone must be easy: **Call today / Call tomorrow / Pick date / Clear** on every person, plus "Add someone to Calls due" on Home. |
| 6 | **Memos** on Home | Notes to myself about shidduchim. |
| 7 | Home | Recently added; "Last backup: today"; **Backup now** at the bottom. In single mode, **My profile** at the top, with who it was sent to. |
| 8 | **Single mode / Shadchan mode** | Single: tabs Home · Shadchanim. Shadchan: Home · Shadchanim · Guys · Girls, with **Make match** in the header. |
| 9 | **Settings → I am** | Single guy or single girl. "Idea for me" is then filed as the other gender. |
| 10 | Header | Minimal: the name **ZivugBase** on every main tab. **Settings button on Home only.** |
| 11 | Add-on option | The Android add-on is kept in Settings. The owner is trying to get it allowed in NetSpark. |
| 12 | Storage protection | "Protect my data" (persistent storage), on phone and PC. |
| 13 | **Add to…** | Replaces "Add to favorites". |
| 14 | **How well do I know them** | Three **tiny** buttons in one row: Know personally · Recommended · Only details. |
| 15 | Landline label | No SMS on landlines. |
| 16 | **PDF backup** | A PDF with a summary page and the whole backup inside, for email. |
| 17 | **Who sent it?** | "Search anyone, or type a new name". |
| 18 | **What is it?** | When filing from the Intake folder: Idea for me · A single · A shadchan. |
| 19 | Phone rows in the form | One line each: whose + number + Remove, then "Add another phone" (**no + sign**). The first line is always open. |
| 20 | Email | Hidden behind "Add email" (**no + sign**). |
| 21 | Looking for | Only **"Up to age"**, no minimum. |
| 22 | Age | Stored with the date it was entered, and counted forward from then. |
| 23 | **Suggested to me** | Yes / No on the person page **and** in the form. Set automatically when something is filed as "Idea for me". |

**Rejected. Do not bring these back:**

- Ideas section
- Details & categories
- Where they came from
- Profile shared section
- Favorites star
- Delete button on the person page (delete from the list's share bar)
- Big ZivugBase buttons, and uppercase section labels
- The "Where things stand" sheet

---

## 4. Architecture that proved good — keep it

The ZivugBase engine is solid and tested; build on it.

**Stack.** TypeScript · Preact + signals · Vite · **Dexie** (IndexedDB) · MiniSearch · fflate ·
Vitest · Playwright. It deploys to GitHub Pages through `.github/workflows/deploy.yml`, which runs
typecheck, unit tests, **e2e tests** and the **privacy check**, and deploys only if all four pass.

**Data model** (`src/db/types.ts`, `src/db/db.ts`):

- **One `Person` per human, with roles** (`single`, `shadchan`, `contact`, `me`, …). No separate
  guy, girl and shadchan tables, and no duplicates.
  - `gender`
  - `phones[]` with a `phoneKeys` index, used for matching and duplicate checks
  - `age: {value, asOf}`
  - `facts{}` for the PeerMatch checkboxes and fields
  - `contactPeople[]`, `cameFrom` (who sent them), `nextStep` (Call due) and `waitingSince`
- **`activities` table.** Each entry has `linkKeys` (`p:<id>`), so **one entry shows in every
  linked person's History**: a share, a call or a match. This replaces PeerMatch's two copies plus
  reconciliation plus tombstones.
- **`files` table** for photos, PDFs and audio, stored separately from the records. That keeps
  saving fast: PeerMatch re-wrote the whole database, photos included, on every change.
- **`lists` table** for folders: `kind: 'folder'`, `parentId` pointing to a folder or `root:guys`
  (and the other top folders), and `memberIds`.
- `inbox` (the Intake folder), `settings` and `drafts` tables. Unsaved forms survive the app
  closing.
- **Soft delete** (`deletedAt`) + **Undo** toasts + Recently deleted (30 days).

**One owner per behaviour.** Change the owner; never add a second way to do the same thing.

| Owner | Does |
|---|---|
| `src/ui/contact.ts` | Call / Email / WhatsApp / SMS. Writes History *before* opening the app; `whatsapp://` on Android. |
| `src/ui/share.ts` | Sending profiles and cards from the share bar. |
| `src/db/folders.ts` | Folders: create, delete (sub-folders move up), `applyFolderChanges` with Undo, tree. |
| `src/ui/fields.ts` | The checkbox list. **A new checkbox is one line here.** |
| `src/lib/phone.ts` | Israeli / international numbers, landline detection, WhatsApp number, matching key. |
| `src/lib/readText.ts` | Reads text out of PDFs (PDF.js is **bundled**, so it works offline and under NetSpark) and photos (OCR). |
| `src/ui/translate.ts` | Translation: Chrome's on-phone translator first, then Google's web service. |
| `src/backup/*` | ZIP backup, PDF backup, restore with Undo. |
| `src/import/peermatch.ts` | PeerMatch import. Can be run again safely; keeps each original record untouched in `legacy`. |
| `src/ui/screens/Person.tsx` | The person page. `patch(id, fn)` **re-reads the stored record before every change**, so a quick edit never saves over newer data. |

**Navigation.** Hash routes with a history depth counter. Every sheet adds its own history entry,
so the **phone's Back button closes the sheet, not the screen**. Person pages and forms hide the
tabs, as PeerMatch's sheets did.

**Service worker.** Network-first with offline precache. The **share-target** writes each share
into its own queue database, so two shares never overwrite each other. PeerMatch kept a single
`'pending'` slot, and a second share replaced the first.

**Tests.**

- `tests/unit/`: repo, backup round-trip, PeerMatch import, folders, phones and ages, filing.
- `tests/e2e/app.spec.ts`: the full flows at phone size, using **SYNTHETIC** data only.
- `npm run check` runs typecheck, unit tests and the privacy check. `npm run e2e` runs the browser
  tests.

---

## 5. Why PeerMatch had to be rebuilt (don't repeat these)

In v131, 75 scripts patch each other:

- 33 re-wrap the render functions.
- There are 56 MutationObservers, plus capture-phase listeners and a `setInterval` loop.
- 22 files can send a message.
- There are four WhatsApp send queues, held apart by a hook on `localStorage.setItem`.
- History was stored twice and then reconciled.
- The whole database lives in one row.
- Persistent storage was never requested.
- Some fixes never ran.

Every new feature there means hunting for which script really controls it. **Rule for the rebuild:
no global function overrides, no MutationObservers to "fix" another component, no capture
listeners.**

---

## 6. Mistakes from this build session — avoid them

1. **Too much built at once, before the owner saw it.** Build one screen, deploy it, have the owner
   check it on the phone, then continue.
2. **Adding things the owner never asked for** (Ideas, categories, big buttons). Copy PeerMatch;
   add only what §3 lists; ask before anything else.
3. **Styling by guesswork.** It only got close to PeerMatch after screenshotting the real PeerMatch
   and matching its sizes (§7). Do that **first**, for every screen.
4. **A button inside a `<label>`.** Tapping the label's text pressed the button: tapping "Profile"
   triggered Paste. Keep buttons outside labels.
5. **CSS specificity.** A general `main input {...}` rule beat the smaller quick-details inputs.
   Scope rules to the component; check both screens after any shared style change.
6. **A class name clash.** The quick-details box used class `quick`, which Home already used as a
   4-column grid, and the checkboxes came out in columns. Keep class names unique per component.
7. **The zoom setting read `Number(null) === 0`** and opened every list in Folders view. Read
   stored settings as strings.
8. **A scratch screenshot test was committed** and failed CI, which blocked a deploy. Keep scratch
   files out of `tests/e2e`.
9. **The privacy check read `rgb(246 245 242)` as a phone number.** Use hex colors.
10. **Two open policy questions to settle with the owner:**
    - The repo's own `CLAUDE.md` says "no CDNs at runtime". The OCR tool (Tesseract) is loaded from
      jsDelivr, and the translate fallback calls Google. Both copy PeerMatch, and the owner asked
      for in-app translate. Either self-host Tesseract, as `docs/PLAN.md` §23 intended, or record
      this as an exception.
    - `android/zivugbase-addon.jks` (the add-on's **signing key**) is committed to this **public**
      repo. Anyone could sign a fake update with it. Move it to a GitHub secret before shipping the
      add-on widely.
11. **The Android add-on.** The full version (a floating bubble using Accessibility) was blocked by
    Play Protect. With Play Protect off, NetSpark blocked turning it on. The light version adds
    "ZivugBase" to the text-selection menu, but it didn't appear for the owner. Paste and
    share-to-app are the capture paths that work.

---

## 7. Match PeerMatch exactly: measure it

PeerMatch runs locally with made-up data, and Playwright screenshots the same screens in both apps
at **412 px wide, 2×**:

1. Serve the old app: `cd match && python3 -m http.server 8765`.
2. In a temporary Playwright spec (not inside `tests/e2e/`, or CI runs it):
   - Block `sw.js`.
   - Write made-up data into IndexedDB `PeerMatchDB` v2 (store `kv`, key `state` =
     `{shadchanim, guys, girls}`).
   - Load `index.html`.
   - Add every script in `sw.js` → `SCRIPTS`, in order, with `page.addScriptTag`, then call
     `render()`.
3. Open a guy, the Edit form, a shadchan and its Edit, scroll through each, and screenshot them.
4. Create the same people in ZivugBase and screenshot the same screens. Compare them side by side.

**Measured PeerMatch sizes**, at 412 px wide, in CSS px:

| Part | Size |
|---|---|
| Base text | 16 |
| Title | 27, weight 800 |
| Page header name | 24, weight 800 |
| Round back button | 48 |
| Edit button | 58 × 36, radius 9, 11 px, bg `#eef3f6` |
| Five contact buttons | about 38 tall, gap 5, radius 10, 10 px bold, bg `#dfeef9`; Waiting button 9.5 px |
| Call today row | 9.7 px, radius 9, bg `#e8f1f7`; active `#fff1cf` / `#76551c` |
| Translate button | 10.5 px, padding 6 × 9, bg `#e8f1f7` |
| Profile card | radius 18, padding 14, 16 px text, line height 1.45 |
| Quick details | checkbox labels 11 px bold `#536b7a`; boxes 16 px; label column 92 px; inputs 36 tall |
| Contacts card | title 14 px 900; labels 11; names 13 bold; phone 12 bold `#315b78`; buttons 10 px |
| History band | bg `#eaf1f6`, border `#d3e0e8`, radius 12, 14 px 900 |
| History entries | bg `#f7fafc`, border `#d9e4ea`, radius 14; Delete `#9b3b36`, 11.5 px |
| Note bar | input 46 tall, radius 24; round button 46 px, `#315b78` |
| Form | labels 13 px muted, normal weight; inputs radius 14, padding 11 × 14, 15 px; Paste profile button 10.5 px |
| Save bar | white floating card, radius 14; Save 1.25fr + Cancel 0.75fr, 38 tall |
| Colors | bg `#f6f5f2`, text `#19324a`, muted `#73818b`, line `#e0dfdc`, accent `#315b78` |

The icons (mic, send, stop, back) are copied from PeerMatch's `history-composer-v36.js`, in
`src/ui/parts/Icons.tsx`.

---

## 8. Status of the ZivugBase code

**Built, with tests passing, but not phone-checked:**

- Lists:
  - PeerMatch cards and pills
  - share bar (Email, SMS, WhatsApp; one person at a time)
  - Delete with Undo
  - folders, zoom and bulk filing
- Person page:
  - Guy/Girl and Shadchan layouts, in PeerMatch order
  - Translate in-app
  - clickable phones and bold text
  - Contacts card
  - quick details that save themselves
  - Linked Shadchan
  - Folders, How well, Suggested to me
  - Call due row
  - History with Delete
  - note bar with mic
- Form: PeerMatch order, phone rows, "Add email", Who sent it, Paste profile, Attach only / Attach
  + parse text, Up to age.
- Make match: in shadchan mode; the ticks are kept across tabs.
- Home:
  - My profile (single mode)
  - Calls due, plus "Add someone"
  - Waiting
  - Memos
  - Recently added
  - Backup now
- Intake folder: share-in, Paste, Speak, Photo, "What is it?", Who sent it.
- Settings:
  - Mode, I am
  - Backup ZIP and PDF, Restore / import PeerMatch
  - Wait days
  - Add-on downloads
  - Protect my data
  - Recently deleted
- PeerMatch import, with the "suggested to me?" review.

**Not built yet** — PeerMatch has these and the owner wants them:

1. One send queue with PeerMatch's black bar: the "Who are you sending this to?" picker, **PDF-first
   sharing**, **photo Yes/No**, one profile to several shadchanim, and the language choice for
   SMS and Email.
2. The **"Call ended — add a status update?"** popup. Call notes imported from PeerMatch already
   show.
3. **WhatsApp chat ZIP import.**
4. Shadchanim grouped under whoever referred them, in the list.
5. The Waiting and Calls pills filter the list. PeerMatch opened a separate list sheet instead;
   ask which the owner prefers.
6. The Make match "Contact" call should trigger the after-call popup.

---

## 9. Questions to ask the owner first

1. **"It doesn't work good": what exactly?** Something broken, slow, confusing, or looking wrong?
   Ask for a phone screenshot.
2. PeerMatch's green "A shared profile is ready to import" banner stays up after the item is dealt
   with. Should the new app clear it?
3. The Shadchanim list shows raw `*asterisks*` from WhatsApp bold. Strip them?
4. "WhatsApp • Waiting" in the Shadchanim list comes from the last message, not the Waiting button.
   Which meaning should stay?
5. The Contacts-card buttons are Call | SMS | WhatsApp, which differs from the main row's order.
   Change them?
6. The OCR tool and Google translate fallback go against "no CDNs": allow them, or self-host
   Tesseract?

---

## 10. How to work with this owner

- The owner is the only user and owns both repos. For ordinary app changes, **finish, push,
  deploy**, and tell them to fully close and reopen the app.
- Ask before anything destructive, any data migration, or anything that goes against a documented
  rule.
- Keep messages short and plain. The owner reads on a phone.
- Don't call anything "device-verified" until the owner has tested it.
- The owner is precise about looks. Copy PeerMatch, measure, and show screenshots.
