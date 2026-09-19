/* ZivugBase - writing activities.

   Every activity written here carries BOTH the legacy locale-string `ts` that
   PeerMatch renders, and a numeric `tsMs`. The numeric field is what makes
   "sort by last contact" and "stale for 30 days" possible at all. */

import { save } from '../core/store.js';
import { stamp } from '../core/format.js';
import { invalidateSearch } from '../core/model.js';
import { bus } from '../core/bus.js';

export async function addActivity(record, activity) {
  const now = Date.now();
  record.activities = record.activities || [];
  record.activities.push({
    id: now,
    tsMs: now,
    ts: stamp(now),
    ...activity
  });
  invalidateSearch(record);
  await save();
  bus.emit('activity:added', { record, activity });
  return record;
}

export async function deleteActivity(record, activityId) {
  const before = record.activities.length;
  record.activities = record.activities.filter(a => String(a.id) !== String(activityId));
  if (record.activities.length === before) return false;
  invalidateSearch(record);
  await save();
  bus.emit('activity:deleted', { record });
  return true;
}

export async function setField(record, field, value) {
  record[field] = value;
  invalidateSearch(record);
  await save();
  bus.emit('record:changed', { record });
}
