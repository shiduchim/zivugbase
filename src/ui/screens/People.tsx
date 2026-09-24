/* People — one tab, chips across the top (PLAN §6.1), one search (§6.6), A–Z for long lists (§15). */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { db } from '../../db/db';
import { getSetting } from '../../db/repo';
import type { Person } from '../../db/types';
import { useDebounced, useLive } from '../../hooks';
import { groupLetter, searchPeople, withoutChip } from '../../lib/search';
import { go, mode, route } from '../../state';
import { plural } from '../../text';
import { Chips, Loading, PersonRow, SettingsButton, TopBar } from '../parts/common';
import { WAIT_DAYS_DEFAULT } from '../describe';
import { CaptureBar } from '../parts/CaptureBar';

type Show = 'shadchanim' | 'girls' | 'guys' | 'helpers' | 'everyone' | 'suggested';

const SHOW: Record<Show, { label: string; test: (p: Person) => boolean; noun: [string, string]; add?: string }> = {
  shadchanim: { label: 'Shadchanim', test: (p) => p.roles.includes('shadchan'), noun: ['shadchan', 'shadchanim'], add: 'role=shadchan' },
  girls: { label: 'Girls', test: (p) => p.roles.includes('single') && p.gender === 'f', noun: ['girl', 'girls'], add: 'role=single&gender=f' },
  guys: { label: 'Guys', test: (p) => p.roles.includes('single') && p.gender === 'm', noun: ['guy', 'guys'], add: 'role=single&gender=m' },
  suggested: { label: 'Suggested to me', test: (p) => p.suggestedToMe === true, noun: ['girl suggested to me', 'girls suggested to me'], add: 'role=single&gender=f' },
  helpers: { label: 'Helpers', test: (p) => p.roles.includes('helper'), noun: ['helper', 'helpers'], add: 'role=helper' },
  everyone: { label: 'Everyone', test: () => true, noun: ['person', 'people'] }
};

function defaultShow(): Show {
  return mode.value === 'me' ? 'shadchanim' : 'everyone';
}

export function People() {
  const r = route.value;
  const show = (r.query.get('show') as Show | null) ?? defaultShow();
  const [q, setQ] = useState(r.query.get('q') ?? '');
  const debounced = useDebounced(q, 150);
  const input = useRef<HTMLInputElement>(null);

  const all = useLive(() => db.people.toArray(), []);
  const waitDays = useLive(() => getSetting('waitDays', WAIT_DAYS_DEFAULT), []) ?? WAIT_DAYS_DEFAULT;

  useEffect(() => { if (r.query.get('focus')) input.current?.focus(); }, []);

  /* keep the search in the address, so Back returns to the same results */
  useEffect(() => {
    const params = new URLSearchParams();
    if (r.query.get('show')) params.set('show', show);
    if (debounced) params.set('q', debounced);
    const next = '/people' + (params.toString() ? '?' + params : '');
    if ('#' + next !== location.hash) go(next, { replace: true });
  }, [debounced, show]);

  const live = useMemo(() => (all ?? []).filter((p) => !p.deletedAt && !p.roles.includes('me')), [all]);
  const hasSuggested = live.some((p) => p.suggestedToMe);
  const inShow = useMemo(() => live.filter(SHOW[show].test), [live, show]);
  const { people: results, parsed } = useMemo(() => searchPeople(inShow, debounced), [inShow, debounced]);

  const setShow = (s: Show) => {
    const params = new URLSearchParams({ show: s });
    if (q) params.set('q', q);
    go('/people?' + params, { replace: true });
  };

  const options = (['shadchanim', 'girls', 'guys', ...(hasSuggested && mode.value !== 'helping' ? ['suggested' as const] : []), 'helpers', 'everyone'] as Show[])
    .map((k) => ({ key: k, label: SHOW[k].label }));

  const searching = debounced.trim().length > 0;
  const favorites = searching ? [] : results.filter((p) => p.favorite);
  const rest = searching ? results : [...results].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const grouped = !searching && rest.length >= 30;
  const letters = grouped ? [...new Set(rest.map((p) => groupLetter(p.name)))] : [];
  const noun = SHOW[show].noun;

  return (
    <>
      <TopBar title="People" right={<SettingsButton />} />
      <main>
        <div class="search">
          <input
            ref={input}
            type="search"
            placeholder="Name, city, age, phone…"
            aria-label="Search people"
            value={q}
            onInput={(e) => setQ(e.currentTarget.value)}
          />
        </div>
        {parsed.chips.length > 0 && (
          <div class="search-chips" aria-label="Filters from your search">
            {parsed.chips.map((c) => (
              <button key={c.id} type="button" class="chip on" aria-label={`${c.label} — remove this filter`} onClick={() => setQ(withoutChip(q, c))}>
                {c.label}<span class="x" aria-hidden="true"> ✕</span>
              </button>
            ))}
          </div>
        )}
        <div style="margin-top:10px"><Chips options={options} value={show} onChange={setShow} /></div>

        {!all ? <Loading /> : (
          <>
            <p class="muted small" style="margin:4px 0">
              {searching ? `${plural(results.length, 'match', 'matches')}` : plural(inShow.length, noun[0], noun[1])}
            </p>

            {results.length === 0 && (
              <div class="empty">
                {searching
                  ? <p>No one matches. Try fewer words, or remove a filter above.</p>
                  : <p>No {noun[1]} yet.</p>}
                {SHOW[show].add && <button class="btn primary" type="button" onClick={() => go('/person/new?' + SHOW[show].add)}>Add a{/^[aeiou]/i.test(noun[0]) ? 'n' : ''} {noun[0]}</button>}
              </div>
            )}

            {favorites.length > 0 && (
              <>
                <div class="group-head">Favorites</div>
                {favorites.map((p) => <PersonRow key={'f' + p.id} p={p} waitDays={waitDays} />)}
              </>
            )}

            {rest.map((p, i) => {
              const letter = grouped ? groupLetter(p.name) : '';
              const head = grouped && (i === 0 || groupLetter(rest[i - 1]!.name) !== letter);
              return (
                <div key={p.id}>
                  {head && <div class="group-head" id={'az-' + letter}>{letter}</div>}
                  <PersonRow p={p} waitDays={waitDays} />
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

            {SHOW[show].add && results.length > 0 && (
              <div style="margin-top:16px">
                <button class="btn full" type="button" onClick={() => go('/person/new?' + SHOW[show].add)}>Add a{/^[aeiou]/i.test(noun[0]) ? 'n' : ''} {noun[0]}</button>
              </div>
            )}
          </>
        )}
      </main>
      <CaptureBar />
    </>
  );
}
