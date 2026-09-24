/* Short plain-language lines about a person, used by rows, the banner and Today. */
import type { Person } from '../db/types';
import { ageLabel } from '../lib/age';
import { startOfDay } from '../lib/format';
import { ROLE_LABEL } from '../text';

const DAY = 86400000;
export const WAIT_DAYS_DEFAULT = 5;

export function whenText(due: number | undefined, at = Date.now()): string {
  if (due === undefined) return 'no date';
  const days = Math.round((startOfDay(due) - startOfDay(at)) / DAY);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return '1 day late';
  if (days < 0) return `${-days} days late`;
  if (days < 7) return `in ${days} days`;
  return new Date(due).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function waitingDays(p: Person, at = Date.now()): number | undefined {
  if (p.waitingSince === undefined) return undefined;
  if (!p.waitingSince) return -1; /* waiting, date unknown (e.g. from PeerMatch) */
  return Math.max(0, Math.floor((startOfDay(at) - startOfDay(p.waitingSince)) / DAY));
}

export function waitingText(p: Person, at = Date.now()): string {
  const d = waitingDays(p, at);
  if (d === undefined) return '';
  if (d < 0) return 'Waiting for an answer';
  if (d === 0) return 'Waiting for an answer since today';
  return `Waiting for an answer · ${d} day${d === 1 ? '' : 's'}`;
}

export const displayName = (p: Pick<Person, 'name'>): string => p.name.trim() || 'No name yet';

export function roleWords(p: Person): string {
  return p.roles.filter((r) => r !== 'me').map((r) => (r === 'single' ? (p.gender === 'f' ? 'Girl' : p.gender === 'm' ? 'Guy' : 'Single') : r === 'helper' && p.helperType ? p.helperType : ROLE_LABEL[r])).join(' · ');
}

/* The second line of a list row. */
export function rowSub(p: Person, at = Date.now()): string {
  const age = ageLabel(p.age, p.dob, at);
  if (p.roles.includes('single')) return [age, p.city, p.roles.length > 1 ? roleWords(p) : ''].filter(Boolean).join(' · ');
  if (p.roles.includes('shadchan')) return [p.city, p.tags.slice(0, 3).join(', ')].filter(Boolean).join(' · ') || roleWords(p);
  return [roleWords(p), p.city].filter(Boolean).join(' · ');
}

/* The right side of a row: what needs attention, if anything. */
export function rowSide(p: Person, waitDays = WAIT_DAYS_DEFAULT, at = Date.now()): { text: string; wait: boolean } | undefined {
  if (p.nextStep) {
    const w = whenText(p.nextStep.due, at);
    const late = p.nextStep.due !== undefined && startOfDay(p.nextStep.due) <= startOfDay(at);
    return { text: `${p.nextStep.what} ${w}`, wait: late };
  }
  const d = waitingDays(p, at);
  if (d !== undefined) return { text: d < 0 ? 'Waiting' : `Waiting ${d}d`, wait: d < 0 || d >= waitDays };
  return undefined;
}
