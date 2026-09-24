/* The lists, in PeerMatch's layout (docs/REBUILD_PLAN.md): big title with Waiting / Calls pills,
   search + Add, cards with a checkbox, and the "Share this profile" bar once anything is picked. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { db } from '../../db/db';
import { softDeletePerson } from '../../db/repo';
import type { Activity, ID, Person } from '../../db/types';
import { useDebounced, useLive } from '../../hooks';
import { ageLabel } from '../../lib/age';
import { dateTime, initials, startOfDay } from '../../lib/format';
import { displayPhone } from '../../lib/phone';
import { groupLetter, searchPeople, withoutChip } from '../../lib/search';
import { go, mode, route, showToast } from '../../state';
import { plural } from '../../text';
import { AppHeader, Chips, Loading, Sheet } from '../parts/common';
import { displayName } from '../describe';
import { CHANNEL_WORD, sendOne, senderOf, type Channel } from '../share';

type Show = 'shadchanim' | 'girls' | 'guys' | 'helpers' | 'everyone' | 'suggested';
type Only = 'waiting' | 'calls';

const SHOW: Record<Show, { label: string; test: (p: Person) => boolean; noun: [string, string]; add?: string }> = {
  shadchanim: { label: 'Shadchanim', test: (p) => p.roles.includes('shadchan'), noun: ['shadchan', 'shadchanim'], add: 'role=shadchan' },
  girls: { label: 'Girls', test: (p) => p.roles.includes('single') && p.gender === 'f', noun: ['girl', 'girls'], add: 'role=single&gender=f' },
  guys: { label: 'Guys', test: (p) => p.roles.includes('single') && p.gender === 'm', noun: ['guy', 'guys'], add: 'role=single&gender=m' },
  suggested: { label: 'Suggested to me', test: (p) => p.suggestedToMe === true, noun: ['girl suggested to me', 'girls suggested to me'], add: 'role=single&gender=f' },
  helpers: { label: 'Helpers', test: (p) => p.roles.includes('helper'), noun: ['helper', 'helpers'], add: 'role=helper' },
  everyone: { label: 'Everyone', test: () => true, noun: ['person', 'people'] }
};

const DAY = 86400000;
const isWaiting = (p: Person) => p.waitingSince !== undefined;
const callDue = (p: Person, endOfToday: number) => p.nextStep?.due !== undefined && p.nextStep.due < endOfToday;

function defaultShow(): Show {
  return mode.value === 'me' ? 'shadchanim' : 'everyone';
}

/* The newest History entry for each person, for the card's last line. */
function latestByPerson(acts: Activity[]): Map<ID, Activity> {
  const m = new Map<ID, Activity>();
  for (const a of acts) {
    if (a.deletedAt) continue;
    for (const k of a.linkKeys) {
      if (!k.startsWith('p:')) continue;
      const id = k.slice(2);
      const cur = m.get(id);
      if (!cur || a.at > cur.at) m.set(id, a);
    }
  }
  return m;
}

function Card({ p, last, from, selected, onPick }: { p: Person; last: Activity | undefined; from: Person | undefined; selected: boolean; onPick: () => void }) {
  const single = p.roles.includes('single');
  const age = ageLabel(p.age, p.dob);
  const phone = p.phones.find((ph) => ph.number.trim());
  const lastLine = last
    ? [(last.text || last.title || '').replace(/\s+/g, ' ').replace(/\*/g, '').slice(0, 110), dateTime(last.at)].filter(Boolean).join(' • ')
    : p.profile.text.replace(/\s+/g, ' ').replace(/\*/g, '').slice(0, 110);
  return (
    <div class={`pcard${selected ? ' sel' : isWaiting(p) ? ' wait' : ''}`}>
      <label class="pick"><input type="checkbox" checked={selected} onChange={onPick} aria-label={`Select ${displayName(p)}`} /></label>
      <button type="button" class="main" onClick={() => go('/person/' + p.id)}>
        {!single && <span class="avatar" aria-hidden="true">{initials(p.name)}</span>}
        <span class="body">
          <span class="name bidi" style="display:block">{displayName(p).replace(/\*/g, '')}</span>
          {single && (age || from || p.resumeFileIds.length > 0) && (
            <span class="pills">
              {age && <span>Age {age}</span>}
              {from && <span class="bidi">From {displayName(from)}</span>}
              {p.resumeFileIds.length > 0 && <span>Screenshot</span>}
            </span>
          )}
          {phone && <span class="line" style="display:block">{displayPhone(phone.number)}</span>}
          {lastLine && <span class="line bidi">{lastLine}</span>}
          {isWaiting(p) && !single && <span class="line" style="display:block">Waiting for reply</span>}
        </span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
    </div>
  );
}

export function People() {
  const r = route.value;
  const show = (r.query.get('show') as Show | null) ?? defaultShow();
  const only = (r.query.get('only') as Only | null) ?? undefined;
  const [q, setQ] = useState(r.query.get('q') ?? '');
  const debounced = useDebounced(q, 150);
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Set<ID>>(new Set());
  const [queue, setQueue] = useState<{ channel: Channel; ids: ID[]; i: number }>();

  const all = useLive(() => db.people.toArray(), []);
  const acts = useLive(() => db.activities.toArray(), []);

  useEffect(() => { if (r.query.get('focus')) input.current?.focus(); }, []);
  useEffect(() => { setPicked(new Set()); }, [show]);

  /* keep the search in the address, so Back returns to the same results */
  useEffect(() => {
    const params = new URLSearchParams();
    if (r.query.get('show')) params.set('show', show);
    if (only) params.set('only', only);
    if (debounced) params.set('q', debounced);
    const next = '/people' + (params.toString() ? '?' + params : '');
    if ('#' + next !== location.hash) go(next, { replace: true });
  }, [debounced, show, only]);

  const live = useMemo(() => (all ?? []).filter((p) => !p.deletedAt && !p.roles.includes('me')), [all]);
  const byId = useMemo(() => new Map((all ?? []).map((p) => [p.id, p])), [all]);
  const latest = useMemo(() => latestByPerson(acts ?? []), [acts]);
  const endOfToday = startOfDay(Date.now()) + DAY;
  const hasSuggested = live.some((p) => p.suggestedToMe);
  const inShow = useMemo(() => live.filter(SHOW[show].test), [live, show]);
  const waitingN = inShow.filter(isWaiting).length;
  const callsN = inShow.filter((p) => callDue(p, endOfToday)).length;
  const filtered = useMemo(() => (only === 'waiting' ? inShow.filter(isWaiting) : only === 'calls' ? inShow.filter((p) => callDue(p, endOfToday)) : inShow), [inShow, only]);
  const { people: results, parsed } = useMemo(() => searchPeople(filtered, debounced), [filtered, debounced]);

  const setParam = (k: string, v: string | undefined) => {
    const params = new URLSearchParams(r.query);
    if (v) params.set(k, v); else params.delete(k);
    if (!params.get('show')) params.set('show', show);
    if (q) params.set('q', q);
    go('/people?' + params, { replace: true });
  };

  const options = show === 'girls' || show === 'suggested'
    ? (hasSuggested ? (['girls', 'suggested'] as Show[]).map((k) => ({ key: k, label: k === 'girls' ? 'All girls' : 'Suggested to me' })) : [])
    : [];

  const searching = debounced.trim().length > 0;
  const rest = searching ? results : [...results].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const grouped = !searching && rest.length >= 30;
  const letters = grouped ? [...new Set(rest.map((p) => groupLetter(p.name)))] : [];
  const noun = SHOW[show].noun;
  const shareWord = show === 'shadchanim' ? 'shadchan' : show === 'helpers' || show === 'everyone' ? 'contact' : 'profile';

  const toggle = (id: ID) => {
    const s = new Set(picked);
    if (s.has(id)) s.delete(id); else s.add(id);
    setPicked(s);
  };
  const pickedPeople = rest.filter((p) => picked.has(p.id));

  const share = (channel: Channel) => {
    const ids = pickedPeople.map((p) => p.id);
    if (!ids.length) return;
    if (ids.length === 1) { sendOne(byId.get(ids[0]!)!, channel, byId); return; }
    setQueue({ channel, ids, i: 0 });
  };
  const sendNext = () => {
    if (!queue) return;
    const p = byId.get(queue.ids[queue.i]!);
    const i = queue.i + 1;
    setQueue(i < queue.ids.length ? { ...queue, i } : undefined);
    if (p) sendOne(p, queue.channel, byId);
  };
  const removePicked = async () => {
    const list = pickedPeople;
    const undos = await Promise.all(list.map((p) => softDeletePerson(p.id)));
    setPicked(new Set());
    showToast(list.length === 1 ? `${displayName(list[0]!)} deleted.` : `${list.length} deleted.`, { label: 'Undo', run: async () => { for (const u of undos) await u(); } });
  };

  const queued = queue ? byId.get(queue.ids[queue.i]!) : undefined;

  return (
    <>
      <AppHeader />
      <main>
        <div class="title-row">
          <h1>{SHOW[show].label}</h1>
          <button type="button" class={`tpill${waitingN ? ' on' : ''}`} aria-pressed={only === 'waiting'} onClick={() => setParam('only', only === 'waiting' ? undefined : 'waiting')}>Waiting for reply {waitingN}</button>
          {(show === 'shadchanim' || callsN > 0) && (
            <button type="button" class={`tpill${callsN ? ' on' : ''}`} aria-pressed={only === 'calls'} onClick={() => setParam('only', only === 'calls' ? undefined : 'calls')}>Calls {callsN}</button>
          )}
        </div>
        <div class="toolbar">
          <input
            ref={input}
            type="search"
            placeholder={`Search ${SHOW[show].label.toLowerCase()}`}
            aria-label="Search people"
            value={q}
            onInput={(e) => setQ(e.currentTarget.value)}
          />
          {SHOW[show].add && <button class="btn primary" type="button" onClick={() => go('/person/new?' + SHOW[show].add)}>Add</button>}
        </div>
        {parsed.chips.length > 0 && (
          <div class="search-chips" aria-label="Filters from your search" style="margin-bottom:8px">
            {parsed.chips.map((c) => (
              <button key={c.id} type="button" class="chip on" aria-label={`${c.label} — remove this filter`} onClick={() => setQ(withoutChip(q, c))}>
                {c.label}<span class="x" aria-hidden="true"> ✕</span>
              </button>
            ))}
          </div>
        )}
        {options.length > 0 && <Chips options={options} value={show} onChange={(s) => setParam('show', s)} />}
        {only && <p class="notice slim">Showing only {only === 'waiting' ? 'those waiting for a reply' : 'calls due'} · <a href="#" onClick={(e) => { e.preventDefault(); setParam('only', undefined); }}>Show all</a></p>}

        {pickedPeople.length > 0 && (
          <section class="selbar" aria-label="Selected">
            <h2>Share this {shareWord}</h2>
            <div class="three">
              <button type="button" class="lb" onClick={() => share('email')}>Email</button>
              <button type="button" class="lb" onClick={() => share('sms')}>SMS</button>
              <button type="button" class="lb" onClick={() => share('whatsapp')}>WhatsApp</button>
            </div>
            <div class="four">
              <b>{pickedPeople.length} selected</b>
              <button type="button" class="lb sm gray" onClick={() => setPicked(new Set(rest.map((p) => p.id)))}>Select all</button>
              <button type="button" class="lb sm del" onClick={removePicked}>Delete</button>
              <button type="button" class="lb sm gray" onClick={() => setPicked(new Set())}>Clear</button>
            </div>
          </section>
        )}

        {!all ? <Loading /> : (
          <>
            {searching && <p class="muted small" style="margin:4px 0">{plural(results.length, 'match', 'matches')}</p>}

            {results.length === 0 && (
              <div class="empty">
                {searching
                  ? <p>No one matches. Try fewer words, or remove a filter above.</p>
                  : <p>No {noun[1]} {only ? 'here' : 'yet'}.</p>}
              </div>
            )}

            {rest.map((p, i) => {
              const letter = grouped ? groupLetter(p.name) : '';
              const head = grouped && (i === 0 || groupLetter(rest[i - 1]!.name) !== letter);
              return (
                <div key={p.id}>
                  {head && <div class="group-head" id={'az-' + letter}>{letter}</div>}
                  <Card p={p} last={latest.get(p.id)} from={senderOf(p, byId)} selected={picked.has(p.id)} onPick={() => toggle(p.id)} />
                </div>
              );
            })}

            {grouped && rest.length >= 100 && (
              <nav class="az" aria-label="Jump to letter">
                {letters.map((l) => (
                  <button key={l} type="button" onClick={() => document.getElementById('az-' + l)?.scrollIntoView({ block: 'start' })}>{l}</button>
                ))}
              </nav>
            )}
          </>
        )}
      </main>

      {queue && queued && (
        <Sheet title={`${CHANNEL_WORD[queue.channel]} — one at a time`} onClose={() => setQueue(undefined)}>
          <p>Send <b class="bidi">{displayName(queued)}</b> ({queue.i + 1} of {queue.ids.length})</p>
          <div class="btn-row">
            <button type="button" class="btn quiet" onClick={() => setQueue(undefined)}>Cancel</button>
            <button type="button" class="btn primary" onClick={sendNext}>Send</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
