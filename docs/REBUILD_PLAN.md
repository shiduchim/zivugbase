# The new PeerMatch — rebuild plan

Decided 2026-09-24 with the owner.

## What we are building

**PeerMatch's look and everything you can enter about people**, on **ZivugBase's engine**.

- The layout, cards, button sizes, contact rows, detail order and History come from PeerMatch.
  The full spec is `docs/REBUILD_INVENTORY.md` in `shiduchim/match`.
- Underneath is the ZivugBase engine:
  - one record per person
  - links between people, ideas and history
  - tested backup
  - Recently deleted
  - storage protection
  - one owner in the code for each thing
- PeerMatch backups are imported, and the import can be repeated safely.
- The old PeerMatch keeps working, untouched, until the new one has been compared on the phone
  and the owner switches.

## What the owner picked from ZivugBase

| # | Feature | How it works in the new app |
|---|---|---|
| 1 | **Folders** | See the "Folders" section below. |
| 2 | **Intake folder** (not "Inbox") | Paste now, file later. Pasted text is kept exactly as it came. |
| 3 | **Calls due** on Home | Every person, not only shadchanim, gets **Call due ▸** with Today · Tomorrow · pick a date. One tap adds them. |
| 4 | **Memos** | A place on Home for notes to myself about shidduchim. A memo can be linked to people, or not. |
| 5 | Home | Recently added. "Last backup: today". **Backup now** at the bottom. |
| 6 | Modes | Single mode and Shadchan mode. |
| 7 | "I am" | Settings: **single guy / single girl**. "Idea for me" is then filed as the other gender by itself. |
| 8 | Android add-on | Kept. The owner is asking for it to be allowed in NetSpark. |
| 9 | Storage protection | Kept, on the phone and on a PC. |
| 10 | **Add to…** | Replaces "Add to favorites". It opens the folder picker. |
| 11 | How well do I know them | Kept. |
| 12 | Landline label | Kept (no SMS on landlines). |
| 13 | Backup | PDF backup with the summary page, and ZIP to the phone. |
| 14 | Who sent it? | "Search anyone, or type a new name". |
| 15 | What is it? | Idea for me · A single · A shadchan. This is the first sorting step. |
| 16 | Phones | One line each: name + number + Remove. Then "+ Add another phone". The first phone line is always open. |
| 17 | Email | Hidden behind "+ Add email", because email is rare. |
| 18 | Looking for | The cleaner layout, with **only "up to age"** (no minimum). |
| 19 | Age | Kept as entered, and counted forward from the date it was entered. |
| 20 | Suggested to me | Yes / No, on the person page **and** in the Add/Edit form for singles. It is set automatically when something is filed as "Idea for me". |

## Folders

The owner's words: "like Windows, zoom in and out, each person has their own folder, and
everything links together."

- **Built-in top folders**, which depend on the mode:
  - Single mode: **Ideas for me · Shadchanim · Other people**.
  - Shadchan mode: **Guys · Girls · Shadchanim**, plus Ideas for me.
- **Sub-folders.** Any number, any depth, made by the owner. For example: Shadchanim › Chabad ›
  Tzfat, or Girls › Jerusalem.
- **Putting someone in a folder.** A person can be in more than one folder. You use **Add to…**,
  choose a folder, and can make a new one there.
  - This is a label, not a move: removing a person from a folder never deletes them.
  - Nothing is lost if a folder is deleted. Its people stay in the parent folder.
- **Zoom.** There are three levels, with a − / + control at the top of each list. On a phone,
  pinching also works.
  1. **Folders:** the folder tree with counts. Nothing else.
  2. **Names:** compact rows, one line per person.
  3. **Details:** PeerMatch's full cards (pills, contact phone, last activity).
- **Each person is their own folder.** Opening a person shows PeerMatch's detail page, in this order:
  1. Profile
  2. Files (photos, PDF, audio)
  3. Contacts
  4. Quick details
  5. **Links**
  6. History
- **Links** are everything this person is connected to:
  - who sent them
  - the shadchanim who have their profile
  - match ideas they're part of
  - their contact people
  - the folders they're in

  Each link opens the other record. One action (a share, a call note, a match offer) appears in
  the History of every record it links to.

## Order of work

1. **The look.** PeerMatch's tokens, header, bottom tabs, list cards, share bar, detail page,
   History with Delete, and the Note/mic composer. All of it goes on the existing engine.
2. **Everything you can enter**, using PeerMatch's fields:
   - contacts, quick-details flags, languages, body type, religious level/details
   - talked by phone / in person
   - Looking for (up to age)
   - attachments (Attach only / Attach + parse)
   - the compact phone and email rows
3. **Folders + Links + zoom.**
4. **Home:** Calls due (for anyone), Memos, Recently added, the backup line. Also the Intake
   folder and the mode + "I am" settings.
5. **Sending**, through one owner:
   - the share bar (Email · SMS · WhatsApp)
   - PDF-first sharing
   - one WhatsApp queue with a photo Yes/No
   - Make match
   - call follow-up
   - WhatsApp ZIP import
   - Translate
6. **Compare.** Restore a real PeerMatch backup into the new app and go through it screen by
   screen on the phone. Fix the differences. Then switch, and keep the old app reachable for a while.

A step counts as done only after the owner has checked it on the phone.
