/* Home — "what do I do now?" (PLAN §6.2): Inbox · Today · Recently added · backup line · capture bar. */
import { db } from '../../db/db';
import { addActivity, getMe, getSetting, savePerson } from '../../db/repo';
import type { Person } from '../../db/types';
import { backupStatus } from '../../backup/backup';
import { useLive } from '../../hooks';
import { go, mode, showToast } from '../../state';
import { initials, relativeDay, startOfDay } from '../../lib/format';
import { AppHeader, SettingsButton, Loading } from '../parts/common';
import { QuickActions } from '../parts/CaptureBar';
import { displayName, rowSub, waitingDays, whenText, WAIT_DAYS_DEFAULT } from '../describe';
import type { ReviewRow } from '../../import/peermatch';
import { answerIdea } from '../../inbox/fileItem';
import type { Idea } from '../../db/types';
import { ageLabel } from '../../lib/age';

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
  const ideas = useLive(async () => {
    const me = await getMe();
    if (!me) return [];
    return (await db.ideas.where('aId').equals(me.id).toArray()).filter((i) => !i.deletedAt && !i.legacyKey && (i.status === 'new' || i.status === 'looking-into')).sort((a, b) => b.createdAt - a.createdAt);
  }, []);

  const head = <AppHeader right={<SettingsButton />} />;
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
  const answer = async (idea: Idea, a: 'yes' | 'no') => {
    const undo = await answerIdea(idea.id, a);
    showToast(`${a === 'yes' ? 'Yes' : 'No'} — saved.`, { label: 'Undo', run: undo });
  };

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
            <p>Copy a message in WhatsApp and tap <b>Paste</b> — or share a PDF to ZivugBase. It waits in the Inbox until you file it.</p>
            <button class="btn" type="button" onClick={() => go('/first-run')}>Restore or import from PeerMatch</button>
          </div>
        ) : (
          <>
            <div class="stat-row">
              {single ? (
                <>
                  <Stat n={count((p) => p.roles.includes('shadchan'))} label="Shadchanim" to="/people?show=shadchanim" />
                  <Stat n={count((p) => p.roles.includes('single') && p.gender === 'f')} label="Girls" to="/people?show=girls" />
                  <Stat n={inbox?.length ?? 0} label="Inbox" to="/inbox" warn={(inbox?.length ?? 0) > 0} />
                </>
              ) : (
                <>
                  <Stat n={count((p) => p.roles.includes('single') && p.gender === 'm')} label="Guys" to="/people?show=guys" />
                  <Stat n={count((p) => p.roles.includes('single') && p.gender === 'f')} label="Girls" to="/people?show=girls" />
                  <Stat n={inbox?.length ?? 0} label="Inbox" to="/inbox" warn={(inbox?.length ?? 0) > 0} />
                </>
              )}
            </div>

            {inbox && inbox.length > 0 && (
              <Panel title="Inbox — to file" count={inbox.length} {...(inbox.length > 3 ? { more: { label: 'Open the Inbox', to: '/inbox' } } : {})}>
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

            {ideas && ideas.length > 0 && (
              <Panel title="Ideas waiting for your answer" count={ideas.length} {...(ideas.length > 5 ? { more: { label: 'See all', to: '/people?show=suggested' } } : {})}>
                {ideas.slice(0, 5).map((i) => {
                  const her = byId.get(i.bId);
                  if (!her) return null;
                  const from = i.suggestedBy[0]?.personId ? byId.get(i.suggestedBy[0].personId) : undefined;
                  return (
                    <MiniRow key={i.id} p={her} right={[ageLabel(her.age, her.dob), from?.name].filter(Boolean).join(' · ')}>
                      <button type="button" class="btn tiny primary" onClick={() => answer(i, 'yes')}>Yes</button>
                      <button type="button" class="btn tiny" onClick={() => answer(i, 'no')}>No</button>
                    </MiniRow>
                  );
                })}
              </Panel>
            )}

            <Panel title="Calls due" count={due.length}>
              {due.length ? due.map((t) => (
                <MiniRow key={t.p.id} p={t.p} right={t.why.replace(/^.* — /, '')} warn>
                  <button type="button" class="btn tiny" onClick={() => done(t)}>Done</button>
                </MiniRow>
              )) : <p class="empty small">Nothing to call today.</p>}
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

            <Panel title="Recently added" count={recent.length}>
              {recent.map((p) => <MiniRow key={p.id} p={p} right={relativeDay(p.createdAt) || rowSub(p)} />)}
            </Panel>

            {helpers > 0 && <button type="button" class="link-btn" onClick={() => go('/people?show=helpers')}>Helpers ({helpers})</button>}
            {single && <button type="button" class="link-btn" style="margin-inline-start:12px" onClick={() => go('/people?show=everyone')}>Everyone ({live.length})</button>}
          </>
        )}

        {backup && live.length > 0 && (backup.changedSince || backup.lastAt) && (
          <p class={`backup-line${backup.overdue ? ' warn' : ''}`}>
            {backup.lastAt ? `Last backup: ${relativeDay(backup.lastAt).toLowerCase()}` : 'Not backed up yet'}
            {backup.changedSince && <> · <a href="#/settings" onClick={(e) => { e.preventDefault(); go('/settings'); }}>Back up now</a></>}
          </p>
        )}
      </main>
    </>
  );
}
