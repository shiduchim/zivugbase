# ZivugBase — Claude Code project brief

Read **`docs/PLAN.md`** first. It is the product design and the handoff between build stages.
Every change must follow its **ten design principles (§2)**.

ZivugBase is a free, private, capture-first shidduch organizer: a web app (PWA) that keeps all
data on the user's own device. Its predecessor is PeerMatch (`shiduchim/match`), which stays
untouched; ZivugBase imports PeerMatch backups.

## Non-negotiable

- **This repository is public. Real messages, names and phone numbers never enter it** — not in
  code, tests, docs or commit messages. Test data is made up or fully anonymized. `npm run privacy`
  runs in CI and must pass. It catches phone numbers, email addresses and fixture files not marked
  SYNTHETIC — it cannot catch names, so check names yourself before committing.
- **Free only**, no cloud, no accounts, no analytics, no third-party scripts or CDNs at runtime.
  Everything the app loads is served from this site.
- **Nothing extracted is saved without the user's tap** (Received → Understood → Filed, §8.6).
- **The original is the record**: never replace received text/files with extracted versions.
- **Never invent history or dates**; keep an untouched `legacy` copy of imported PeerMatch records.
- **One owner per behaviour**: one share flow, one timeline, one search, one inbox. Do not add a
  second way to do something that already exists — change the owner.
- **Undo, not "Are you sure?"** for anything recoverable; deleted items go to Recently deleted.

## Stack

TypeScript · Preact + signals · Vite · Dexie (IndexedDB) · MiniSearch · fflate · Vitest ·
Playwright. Deployed to GitHub Pages by `.github/workflows/deploy.yml`, which runs typecheck,
unit tests, e2e tests and the privacy check before deploying.

## Working rules

- `npm run check` (typecheck + unit + privacy) before every commit; `npm run e2e` for UI changes.
- Keep app text in `src/text.ts` (English now; Hebrew/Russian later).
- Plain words in the UI (§4 of the plan). Buttons have words, targets ≥ 48 px, main actions at the
  bottom.
- Don't call anything device-verified until the owner has tested it on the phone.
