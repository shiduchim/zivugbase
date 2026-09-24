/* "Where things stand": next step (what + when), waiting for an answer, status. One sheet. */
import { useState } from 'preact/hooks';
import { db } from '../../db/db';
import { savePerson } from '../../db/repo';
import type { Person } from '../../db/types';
import { startOfDay } from '../../lib/format';
import { showToast } from '../../state';
import { Sheet, YesNo } from './common';

const DAY = 86400000;
const WHATS = ['Call', 'Send profile', 'Check in', 'Ask about the idea'];
const STATUSES = ['Looking', 'Dating someone', 'Paused', 'Engaged', 'Married', 'Not looking now'];

type When = 'today' | 'tomorrow' | 'week' | 'date' | 'none';

const toInput = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function StandsSheet({ p, onClose }: { p: Person; onClose: () => void }) {
  const today = startOfDay(Date.now());
  const [what, setWhat] = useState(p.nextStep?.what ?? '');
  const initialWhen: When = !p.nextStep ? 'today' : p.nextStep.due === undefined ? 'none' : startOfDay(p.nextStep.due) === today ? 'today' : startOfDay(p.nextStep.due) === today + DAY ? 'tomorrow' : 'date';
  const [when, setWhen] = useState<When>(initialWhen);
  const [date, setDate] = useState(p.nextStep?.due ? toInput(p.nextStep.due) : toInput(today + 2 * DAY));
  const [waiting, setWaiting] = useState<boolean>(p.waitingSince !== undefined);
  const [status, setStatus] = useState(p.status);
  const isSingle = p.roles.includes('single');

  const save = async () => {
    const before = structuredClone(p);
    const q = structuredClone(p);
    if (what.trim()) {
      const due = when === 'today' ? today + 12 * 3600000 : when === 'tomorrow' ? today + DAY + 12 * 3600000 : when === 'week' ? today + 7 * DAY + 12 * 3600000 : when === 'date' ? Date.parse(date + 'T12:00') : undefined;
      q.nextStep = { what: what.trim(), ...(due !== undefined && Number.isFinite(due) ? { due } : {}) };
      delete q.snoozeUntil;
    } else delete q.nextStep;
    if (waiting && q.waitingSince === undefined) q.waitingSince = Date.now();
    if (!waiting) delete q.waitingSince;
    q.status = status.trim();
    await savePerson(q);
    onClose();
    showToast('Saved.', { label: 'Undo', run: async () => { await db.people.put(before); } });
  };

  return (
    <Sheet title="Where things stand" onClose={onClose}>
      <label class="field">
        <span>Next step</span>
        <input type="text" value={what} placeholder="e.g. Call" onInput={(e) => setWhat(e.currentTarget.value)} />
      </label>
      <div class="chips wrap">
        {WHATS.map((w) => <button key={w} type="button" class={`chip${what === w ? ' on' : ''}`} onClick={() => setWhat(w)}>{w}</button>)}
      </div>
      {what.trim() && (
        <>
          <div class="section-title" style="margin-top:8px">When</div>
          <div class="chips wrap">
            {([['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Next week'], ['date', 'Pick a date'], ['none', 'No date']] as [When, string][]).map(([k, l]) => (
              <button key={k} type="button" class={`chip${when === k ? ' on' : ''}`} onClick={() => setWhen(k)}>{l}</button>
            ))}
          </div>
          {when === 'date' && <input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} />}
        </>
      )}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:16px 0">
        <span><b>Waiting for an answer?</b></span>
        <YesNo value={waiting} onChange={(v) => setWaiting(!!v)} />
      </div>
      <label class="field">
        <span>Status</span>
        <input type="text" value={status} placeholder={isSingle ? 'e.g. Dating someone' : 'e.g. Retired'} onInput={(e) => setStatus(e.currentTarget.value)} />
      </label>
      {isSingle && (
        <div class="chips wrap">
          {STATUSES.map((s) => <button key={s} type="button" class={`chip${status === s ? ' on' : ''}`} onClick={() => setStatus(status === s ? '' : s)}>{s}</button>)}
        </div>
      )}
      <div class="btn-row" style="margin-top:12px">
        <button class="btn quiet" type="button" onClick={onClose}>Cancel</button>
        <button class="btn primary" type="button" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}
