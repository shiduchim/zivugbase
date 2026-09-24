/* Home — "what do I do now?" (PLAN §6.2): Inbox · Today · Recently added · backup line · capture bar. */
import { db } from '../../db/db';
import { getSetting, savePerson, addActivity } from '../../db/repo';
import type { Person } from '../../db/types';
import { backupStatus } from '../../backup/backup';
import { useLive } from '../../hooks';
import { go, showToast } from '../../state';
import { relativeDay, startOfDay } from '../../lib/format';
import { plural } from '../../text';
import { PersonRow, SettingsButton, TopBar, Loading } from '../parts/common';
import { CaptureBar } from '../parts/CaptureBar';
import { rowSub, waitingDays, whenText, WAIT_DAYS_DEFAULT } from '../describe';
import { call, canWhatsApp, whatsapp } from '../contact';
import type { ReviewRow } from '../../import/peermatch';

const DAY = 86400000;

interface TodayItem { p: Person; why: string; kind: 'step' | 'wait'; sort: number }

export function todayList(people: Person[], waitDays: number, at = Date.now()): TodayItem[] {
  const endOfToday = startOfDay(at) + DAY;
  const out: TodayItem[] = [];
  for (const p of people) {
    if (p.deletedAt || p.roles.includes('me')) continue;
    if (p.snoozeUntil && p.snoozeUntil > at) continue;
    if (p.nextStep?.due !== undefined && p.nextStep.due < endOfToday) {
      const w = whenText(p.nextStep.due, at);
      out.push({ p, kind: 'step', why: `${p.nextStep.what} — ${w === 'today' ? 'planned for today' : w}`, sort: p.nextStep.due });
      continue;
    }
    const d = waitingDays(p, at);
    if (d !== undefined && (d < 0 || d >= waitDays)) {
      out.push({ p, kind: 'wait', why: d < 0 ? 'Waiting for an answer (since an unknown date)' : `No answer in ${d} days`, sort: p.waitingSince || 0 });
    }
  }
  return out.sort((a, b) => a.sort - b.sort);
}

function TodayRow({ item, waitDays }: { item: TodayItem; waitDays: number }) {
  const { p } = item;
  const phone = p.phones[0];
  const done = async () => {
    const before = structuredClone(p);
    const q = structuredClone(p);
    if (item.kind === 'step') {
      const what = q.nextStep?.what ?? '';
      delete q.nextStep;
      await savePerson(q);
      const act = await addActivity('action', '', [p.id], { title: `Done: ${what}` });
      showToast(`Done: ${what}`, { label: 'Undo', run: async () => { await db.people.put(before); await db.activities.delete(act.id); } });
    } else {
      delete q.waitingSince;
      await savePerson(q);
      showToast('No longer waiting.', { label: 'Undo', run: async () => { await db.people.put(before); } });
    }
  };
  const snooze = async () => {
    const before = structuredClone(p);
    await savePerson({ ...structuredClone(p), snoozeUntil: startOfDay(Date.now()) + DAY });
    showToast('Moved to tomorrow.', { label: 'Undo', run: async () => { await db.people.put(before); } });
  };
  return (
    <div class="card" style="padding:10px">
      <PersonRow p={p} waitDays={waitDays} sub={item.why} noSide />
      <div class="btn-row">
        <button class="btn small" type="button" onClick={done}>{item.kind === 'step' ? 'Done' : 'Got an answer'}</button>
        <button class="btn small quiet" type="button" onClick={snooze}>Snooze</button>
        {phone && <button class="btn small" type="button" onClick={() => call(p, phone)}>Call</button>}
        {phone && canWhatsApp(p, phone) && <button class="btn small" type="button" onClick={() => whatsapp(p, phone)}>WhatsApp</button>}
      </div>
    </div>
  );
}

export function Home() {
  const people = useLive(() => db.people.toArray(), []);
  const waitDays = useLive(() => getSetting('waitDays', WAIT_DAYS_DEFAULT), []) ?? WAIT_DAYS_DEFAULT;
  const inboxNew = useLive(() => db.inbox.where('level').anyOf('received', 'understood').count(), []) ?? 0;
  const backup = useLive(() => backupStatus(), []);
  const review = useLive(() => getSetting<ReviewRow[] | null>('pendingReview', null), []);
  const draft = useLive(() => db.drafts.get('person:new'), []);

  if (!people) return <><TopBar title="ZivugBase" right={<SettingsButton />} /><main><Loading /></main><CaptureBar /></>;

  const live = people.filter((p) => !p.deletedAt && !p.roles.includes('me'));
  const today = todayList(live, waitDays);
  const recent = [...live].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const draftName = (draft?.value as { name?: string } | undefined)?.name?.trim();

  return (
    <>
      <TopBar title="ZivugBase" right={<SettingsButton />} />
      <main>
        <div class="search">
          <input type="search" placeholder="Search people" aria-label="Search people" onFocus={() => go('/people?focus=1')} readOnly />
        </div>

        {inboxNew > 0 && (
          <button type="button" class="card wait" style="display:block;width:100%;text-align:start;cursor:pointer" onClick={() => go('/inbox')}>
            <b>Inbox: {plural(inboxNew, 'new item')}</b> — file {inboxNew === 1 ? 'it' : 'them'}
          </button>
        )}
        {review && review.length > 0 && (
          <button type="button" class="notice" style="display:block;width:100%;text-align:start;border:0;cursor:pointer" onClick={() => go('/import/review')}>
            Finish the PeerMatch import: which girls were suggested to you? <b>Answer now</b>
          </button>
        )}
        {draft && (
          <button type="button" class="notice" style="display:block;width:100%;text-align:start;border:0;cursor:pointer" onClick={() => go('/person/new')}>
            Continue adding {draftName || 'the new person'}? <b>Continue</b>
          </button>
        )}

        {live.length === 0 ? (
          <div class="empty">
            <p><b>No one here yet.</b></p>
            <p>Share a WhatsApp message or PDF to ZivugBase, tap <b>Paste</b> below, or add someone.</p>
            <div class="btn-row">
              <button class="btn primary" type="button" onClick={() => go('/person/new')}>Add a person</button>
              <button class="btn" type="button" onClick={() => go('/first-run')}>Restore or import</button>
            </div>
          </div>
        ) : (
          <>
            <h2 class="section-title" style="margin-top:18px">Today</h2>
            {today.length === 0
              ? <p class="muted">Nothing needs you today. Next steps and unanswered messages show up here.</p>
              : today.map((t) => <TodayRow key={t.p.id + t.kind} item={t} waitDays={waitDays} />)}

            <h2 class="section-title" style="margin-top:18px">Recently added</h2>
            {recent.map((p) => <PersonRow key={p.id} p={p} waitDays={waitDays} sub={[relativeDay(p.createdAt), rowSub(p)].filter(Boolean).join(' · ')} />)}
          </>
        )}

        {backup && live.length > 0 && (backup.changedSince || backup.lastAt) && (
          <p class={`notice${backup.overdue ? ' warn' : ''}`}>
            {backup.lastAt ? `Last backup: ${relativeDay(backup.lastAt).toLowerCase()}` : 'Not backed up yet'}
            {backup.changedSince ? ' · ' : ''}
            {backup.changedSince && <a href="#/settings" onClick={(e) => { e.preventDefault(); go('/settings'); }}>Back up now</a>}
          </p>
        )}
      </main>
      <CaptureBar />
    </>
  );
}
