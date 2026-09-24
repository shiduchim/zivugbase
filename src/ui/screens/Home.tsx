/* Home — "what do I do now?" (PLAN §6.2): Inbox · Today · Recently added · backup line · capture bar. */
import { db } from '../../db/db';
import { addActivity, getMe, getSetting, savePerson } from '../../db/repo';
import type { Person } from '../../db/types';
import { backupStatus } from '../../backup/backup';
import { useLive } from '../../hooks';
import { go, mode, showToast } from '../../state';
import { initials, relativeDay, startOfDay } from '../../lib/format';
import { AppHeader, SettingsButton, Loading, Sheet } from '../parts/common';
import { MatchButton } from './MakeMatch';
import { useState } from 'preact/hooks';
import { searchPeople } from '../../lib/search';
import { QuickActions } from '../parts/CaptureBar';
import { displayName, rowSub, waitingDays, whenText, WAIT_DAYS_DEFAULT } from '../describe';
import type { ReviewRow } from '../../import/peermatch';
import type { Activity } from '../../db/types';

const DAY = 86400000;
const SOURCE_ICON: Record<string, string> = { share: '⇪', paste: '¶', speak: '🎙', photo: '▣', import: '↓' };

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

function MiniRow({ p, right, warn, onClick, children }: { p: Person; right?: string; warn?: boolean; onClick?: () => void; children?: preact.ComponentChildren }) {
  return (
    <div class={`mini-row${warn ? ' is-warn' : ''}`}>
      <button type="button" class="mini-main" onClick={onClick ?? (() => go('/person/' + p.id))}>
        <span class="mini-avatar" aria-hidden="true">{initials(p.name)}</span>
        <b class="bidi">{displayName(p)}</b>
        {right && <span class="mini-right">{right}</span>}
      </button>
      {children}
    </div>
  );
}

function Panel({ title, count, children, more }: { title: string; count?: number; children: preact.ComponentChildren; more?: { label: string; to: string } }) {
  return (
    <section class="panel">
      <h2 class="panel-head"><span>{title}</span>{count !== undefined && <i>{count}</i>}</h2>
      {children}
      {more && <button type="button" class="link-btn" onClick={() => go(more.to)}>{more.label}</button>}
    </section>
  );
}

function Stat({ n, label, to, warn }: { n: number; label: string; to: string; warn?: boolean }) {
  return <button type="button" class={`stat${warn ? ' is-warn' : ''}`} onClick={() => go(to)}><b>{n}</b><span>{label}</span></button>;
}

export function Home() {
  const people = useLive(() => db.people.toArray(), []);
  const waitDays = useLive(() => getSetting('waitDays', WAIT_DAYS_DEFAULT), []) ?? WAIT_DAYS_DEFAULT;
  const inbox = useLive(() => db.inbox.where('level').anyOf('received', 'understood').reverse().sortBy('receivedAt'), []);
  const backup = useLive(() => backupStatus(), []);
  const review = useLive(() => getSetting<ReviewRow[] | null>('pendingReview', null), []);
  const draft = useLive(() => db.drafts.get('person:new'), []);
  const memos = useLive(async () => (await db.activities.where('linkKeys').equals('m:memo').toArray()).filter((a) => !a.deletedAt).sort((a, b) => b.at - a.at), []);
  const me = useLive(async () => (await getMe()) ?? null, []);
  const mySends = useLive(async () => {
    const m = await getMe();
    if (!m) return [] as Activity[];
    return (await db.activities.where('linkKeys').equals('p:' + m.id).toArray()).filter((a) => !a.deletedAt && (a.kind === 'profile-sent' || a.kind === 'message-out')).sort((a, b) => b.at - a.at);
  }, []);
  const [memo, setMemo] = useState('');
  const [addDue, setAddDue] = useState(false);
  const [dueFind, setDueFind] = useState('');

  const head = <AppHeader right={<><MatchButton /><SettingsButton /></>} />;
  if (!people) return <>{head}<main><Loading /></main></>;

  const live = people.filter((p) => !p.deletedAt && !p.roles.includes('me'));
  const byId = new Map(live.map((p) => [p.id, p]));
  const today = todayList(live, waitDays);
  const due = today.filter((t) => t.kind === 'step');
  const waiting = today.filter((t) => t.kind === 'wait');
  const recent = [...live].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const draftName = (draft?.value as { person?: { name?: string } } | undefined)?.person?.name?.trim();
  const count = (f: (p: Person) => boolean) => live.filter(f).length;
  const single = mode.value === 'me';
  const helpers = count((p) => p.roles.includes('helper'));

  const done = async (t: TodayItem) => {
    const before = structuredClone(t.p);
    const q = structuredClone(t.p);
    if (t.kind === 'step') {
      const what = q.nextStep?.what ?? '';
      delete q.nextStep;
      await savePerson(q);
      const act = await addActivity('action', '', [q.id], { title: `Done: ${what}` });
      showToast(`Done: ${what}`, { label: 'Undo', run: async () => { await db.people.put(before); await db.activities.delete(act.id); } });
    } else {
      delete q.waitingSince;
      await savePerson(q);
      showToast('No longer waiting.', { label: 'Undo', run: async () => { await db.people.put(before); } });
    }
  };
  const saveMemo = async () => {
    const t = memo.trim();
    if (!t) return;
    await addActivity('note', t, ['m:memo'], { title: 'Memo' });
    setMemo('');
  };
  const removeMemo = async (a: Activity) => {
    await db.activities.update(a.id, { deletedAt: Date.now() });
    showToast('Memo deleted.', { label: 'Undo', run: async () => { await db.activities.update(a.id, { deletedAt: undefined }); } });
  };
  const putOnCalls = async (p: Person, days: number) => {
    const q = structuredClone(p);
    q.nextStep = { what: 'Call', due: startOfDay(Date.now()) + days * DAY + 12 * 3600000 };
    delete q.snoozeUntil;
    await savePerson(q);
    await addActivity('status', '', [p.id], { title: `Call reminder set — ${days ? 'tomorrow' : 'today'}` });
    setAddDue(false);
    setDueFind('');
    showToast(`${displayName(p)} added to Calls due.`);
  };
  const dueFound = dueFind.trim() ? searchPeople(live, dueFind).people.slice(0, 8) : [];

  return (
    <>
      {head}
      <main>
        <div class="search">
          <input type="search" placeholder="Search everyone" aria-label="Search everyone" onFocus={() => go('/people?show=everyone&focus=1')} readOnly />
        </div>
        <QuickActions />

        {review && review.length > 0 && (
          <button type="button" class="notice slim" onClick={() => go('/import/review')}>Finish the PeerMatch import: which girls were suggested to you? <b>Answer</b></button>
        )}
        {draft && (
          <button type="button" class="notice slim" onClick={() => go('/person/new')}>Continue adding {draftName || 'the new person'}? <b>Continue</b></button>
        )}

        {live.length === 0 && !inbox?.length ? (
          <div class="empty">
            <p><b>No one here yet.</b></p>
            <p>Copy a message in WhatsApp and tap <b>Paste</b> — or share a PDF to ZivugBase. It waits in the Intake folder until you file it.</p>
            <button class="btn" type="button" onClick={() => go('/first-run')}>Restore or import from PeerMatch</button>
          </div>
        ) : (
          <>
            {single && me && (
              <section class="panel">
                <h2 class="panel-head"><span>My profile</span><i>sent {mySends?.length ?? 0}</i></h2>
                <button type="button" class="myprof" onClick={() => go('/person/' + me.id)}>
                  <b class="bidi">{me.profile.text.trim() ? me.profile.text.trim().split('\n')[0]!.replace(/\*/g, '').slice(0, 80) : 'Add your profile — the one you send to shadchanim'}</b>
                </button>
                {(mySends ?? []).slice(0, 4).map((a) => {
                  const to = a.linkKeys.filter((k) => k.startsWith('p:') && k !== 'p:' + me.id).map((k) => byId.get(k.slice(2))).filter((x): x is Person => !!x);
                  return <div key={a.id} class="small muted">{relativeDay(a.at)} · to {to.length ? to.map(displayName).join(', ') : 'someone'}</div>;
                })}
                <div class="btn-row" style="margin-top:6px">
                  <button type="button" class="btn small" onClick={() => go('/person/' + me.id)}>Open</button>
                  <button type="button" class="btn small" onClick={() => go(`/person/${me.id}/edit`)}>Edit my profile</button>
                </div>
              </section>
            )}

            <div class="stat-row">
              {single ? (
                <>
                  <Stat n={count((p) => p.roles.includes('shadchan'))} label="Shadchanim" to="/people?show=shadchanim" />
                  <Stat n={count((p) => p.roles.includes('single') && p.gender === 'f')} label="Girls" to="/people?show=girls" />
                  <Stat n={inbox?.length ?? 0} label="Intake" to="/inbox" warn={(inbox?.length ?? 0) > 0} />
                </>
              ) : (
                <>
                  <Stat n={count((p) => p.roles.includes('single') && p.gender === 'm')} label="Guys" to="/people?show=guys" />
                  <Stat n={count((p) => p.roles.includes('single') && p.gender === 'f')} label="Girls" to="/people?show=girls" />
                  <Stat n={inbox?.length ?? 0} label="Intake" to="/inbox" warn={(inbox?.length ?? 0) > 0} />
                </>
              )}
            </div>

            {inbox && inbox.length > 0 && (
              <Panel title="Intake folder — to file" count={inbox.length} {...(inbox.length > 3 ? { more: { label: 'Open the Intake folder', to: '/inbox' } } : {})}>
                {inbox.slice(0, 3).map((i) => (
                  <div key={i.id} class="mini-row">
                    <button type="button" class="mini-main" onClick={() => go('/inbox/' + i.id)}>
                      <span class="mini-avatar" aria-hidden="true">{SOURCE_ICON[i.source]}</span>
                      <b class="bidi">{(i.title || i.text || 'File').replace(/\s+/g, ' ').slice(0, 80)}</b>
                      <span class="mini-right">{relativeDay(i.receivedAt)}</span>
                    </button>
                  </div>
                ))}
              </Panel>
            )}

            <Panel title="Calls due" count={due.length}>
              {due.length ? due.map((t) => (
                <MiniRow key={t.p.id} p={t.p} right={t.why.replace(/^.* — /, '')} warn>
                  <button type="button" class="btn tiny" onClick={() => done(t)}>Done</button>
                </MiniRow>
              )) : <p class="empty small">Nothing to call today.</p>}
              <button type="button" class="link-btn" onClick={() => setAddDue(true)}>+ Add someone to Calls due</button>
            </Panel>

            {waiting.length > 0 && (
              <Panel title="Waiting on a reply" count={waiting.length}>
                {waiting.slice(0, 8).map((t) => (
                  <MiniRow key={t.p.id} p={t.p} right={t.why.replace('No answer in ', '').replace('Waiting for an answer (since an unknown date)', 'date unknown')} warn>
                    <button type="button" class="btn tiny" onClick={() => done(t)}>Got it</button>
                  </MiniRow>
                ))}
              </Panel>
            )}

            <Panel title="Memos" count={memos?.length ?? 0}>
              <div style="display:flex;gap:6px;margin-bottom:4px">
                <input type="text" dir="auto" placeholder="A note to myself about shidduchim…" aria-label="New memo" value={memo} onInput={(e) => setMemo(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveMemo(); }} />
                <button type="button" class="btn small primary" disabled={!memo.trim()} onClick={saveMemo}>Save</button>
              </div>
              {(memos ?? []).slice(0, 6).map((a) => (
                <div key={a.id} class="memo">
                  <div class="pre bidi" dir="auto">{a.text}</div>
                  <div class="memo-foot"><span>{relativeDay(a.at)}</span><button type="button" class="x" onClick={() => removeMemo(a)}>Delete</button></div>
                </div>
              ))}
            </Panel>

            <Panel title="Recently added" count={recent.length}>
              {recent.map((p) => <MiniRow key={p.id} p={p} right={relativeDay(p.createdAt) || rowSub(p)} />)}
            </Panel>

            {helpers > 0 && <button type="button" class="link-btn" onClick={() => go('/people?show=helpers')}>Helpers ({helpers})</button>}
            {single && <button type="button" class="link-btn" style="margin-inline-start:12px" onClick={() => go('/people?show=everyone')}>Everyone ({live.length})</button>}
          </>
        )}

        {backup && live.length > 0 && (
          <div class="backup-foot">
            <p class={`backup-line${backup.overdue ? ' warn' : ''}`}>
              {backup.lastAt ? `Last backup: ${relativeDay(backup.lastAt).toLowerCase()}` : 'Not backed up yet'}{backup.changedSince && backup.lastAt ? ' · changes since then' : ''}
            </p>
            <button type="button" class="btn full" onClick={() => go('/settings')}>Backup now</button>
          </div>
        )}
      </main>
      {addDue && (
        <Sheet title="Add to Calls due" onClose={() => setAddDue(false)}>
          <input type="search" placeholder="Search anyone" aria-label="Search anyone" value={dueFind} onInput={(e) => setDueFind(e.currentTarget.value)} />
          {dueFound.map((p) => (
            <div key={p.id} class="mini-row">
              <span class="mini-main" style="cursor:default"><b class="bidi">{displayName(p)}</b></span>
              <button type="button" class="btn tiny" onClick={() => putOnCalls(p, 0)}>Today</button>
              <button type="button" class="btn tiny" onClick={() => putOnCalls(p, 1)}>Tomorrow</button>
            </div>
          ))}
          <p class="muted small">Or open anyone’s page and tap Call today / Call tomorrow / Pick a date.</p>
        </Sheet>
      )}
    </>
  );
}
