/* ZivugBase - saved views.

   PeerMatch already had two of these, but only as yellow badges that opened a
   modal popup: the "waiting for reply" count and the "calls due" count. Here
   they are first-class views over the same list, which is how HubSpot, Attio
   and Pipedrive make a few hundred records workable. Adding a view is adding
   one object to this array. */

import { isWaiting, callDueState, staleDays, stageOf, lastActivityMs } from '../core/model.js';

export const SORTS = {
  recent:  { label: 'Last contact', fn: (a, b) => lastActivityMs(b) - lastActivityMs(a) },
  stale:   { label: 'Most neglected', fn: (a, b) => lastActivityMs(a) - lastActivityMs(b) },
  name:    { label: 'Name A-Z', fn: (a, b) => String(a.name || '').localeCompare(String(b.name || '')) },
  added:   { label: 'Recently added', fn: (a, b) => Number(b.id) - Number(a.id) }
};

const profileViews = [
  {
    id: 'all', label: 'All', sort: 'recent',
    filter: () => true
  },
  {
    id: 'waiting', label: 'Waiting', sort: 'stale', tone: 'warn',
    filter: isWaiting,
    empty: 'Nothing is waiting on a reply.'
  },
  {
    id: 'active', label: 'In play', sort: 'recent',
    filter: x => ['sent', 'pending', 'dating'].includes(stageOf(x)),
    empty: 'No profiles are currently out with a shadchan.'
  },
  {
    id: 'stale', label: 'Stale 30d', sort: 'stale', tone: 'warn',
    filter: x => stageOf(x) !== 'closed' && staleDays(x) >= 30,
    empty: 'Everything active has been touched in the last month.'
  },
  {
    id: 'new', label: 'Needs work', sort: 'added',
    filter: x => ['new', 'collected'].includes(stageOf(x)),
    empty: 'No profiles are sitting unsent.'
  }
];

const shadchanViews = [
  {
    id: 'all', label: 'All', sort: 'recent',
    filter: () => true
  },
  {
    id: 'calls', label: 'Calls due', sort: 'recent', tone: 'warn',
    filter: s => { const d = callDueState(s); return !!d && d.days <= 0; },
    empty: 'No calls are due today.'
  },
  {
    id: 'waiting', label: 'Waiting', sort: 'stale', tone: 'warn',
    filter: isWaiting,
    empty: 'Nothing is waiting on a reply.'
  },
  {
    id: 'active', label: 'Active', sort: 'recent',
    filter: s => staleDays(s) <= 30,
    empty: 'No shadchan has been contacted in the last month.'
  },
  {
    id: 'dormant', label: 'Dormant', sort: 'stale',
    filter: s => staleDays(s) > 90,
    empty: 'Nobody has gone quiet for more than three months.'
  }
];

export const viewsFor = kind => (kind === 'shadchanim' ? shadchanViews : profileViews);
export const viewById = (kind, id) => viewsFor(kind).find(v => v.id === id) || viewsFor(kind)[0];
