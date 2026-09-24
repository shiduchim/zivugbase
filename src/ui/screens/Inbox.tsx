/* The Inbox list: new items first (oldest at the bottom), filed and dismissed ones below. */
import { useEffect } from 'preact/hooks';
import { db } from '../../db/db';
import type { InboxItem } from '../../db/types';
import { drainIncoming, SOURCE_LABEL } from '../../inbox/inbox';
import { useLive } from '../../hooks';
import { dateTime, relativeDay } from '../../lib/format';
import { go, route } from '../../state';
import { Loading, SettingsButton, TopBar } from '../parts/common';
import { CaptureBar } from '../parts/CaptureBar';

export function itemSummary(i: InboxItem, fileNames: Map<string, string>): string {
  const text = [i.title, i.text].filter(Boolean).join(' — ').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 140);
  const names = i.fileIds.map((f) => fileNames.get(f) ?? 'file');
  return names.length ? names.join(', ') : '(empty)';
}

/* Leaving right after a share returns to the app you shared from (Android keeps it underneath). */
export function leaveToPreviousApp(): void {
  try { window.close(); } catch { /* not allowed here */ }
  setTimeout(() => go('/home', { replace: true }), 150);
}

function Row({ i, names }: { i: InboxItem; names: Map<string, string> }) {
  const done = i.level === 'filed' || i.level === 'dismissed';
  return (
    <button type="button" class="row" style={done ? 'opacity:0.75' : ''} onClick={() => go('/inbox/' + i.id)}>
      <span class="body">
        <span class="name bidi" style="display:block;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" dir="auto">{itemSummary(i, names)}</span>
        <span class="sub" style="display:block">{SOURCE_LABEL[i.source]} · {relativeDay(i.receivedAt)} · {dateTime(i.receivedAt).split(', ').pop()}{i.fileIds.length ? ` · ${i.fileIds.length} file${i.fileIds.length > 1 ? 's' : ''}` : ''}</span>
      </span>
      {done && <span class="pill">{i.level === 'filed' ? 'Filed' : 'Dismissed'}</span>}
    </button>
  );
}

export function Inbox() {
  const shared = route.value.query.get('shared');
  const items = useLive(() => db.inbox.orderBy('receivedAt').reverse().toArray(), []);
  const fileIds = (items ?? []).flatMap((i) => i.fileIds);
  const names = useLive(async () => new Map((await db.files.bulkGet(fileIds)).filter((f) => !!f).map((f) => [f!.id, f!.name])), [fileIds.join(',')]);

  /* After Share → ZivugBase, go straight to the newest shared item's filing form. */
  useEffect(() => {
    drainIncoming()
      .then(async () => {
        if (shared !== '1') return;
        const newest = (await db.inbox.orderBy('receivedAt').reverse().toArray()).find((i) => i.source === 'share' && i.level === 'received');
        if (newest) go('/inbox/' + newest.id + '?shared=1', { replace: true });
      })
      .catch((e) => console.error(e));
  }, [shared]);

  const fresh = (items ?? []).filter((i) => i.level === 'received' || i.level === 'understood');
  const done = (items ?? []).filter((i) => i.level === 'filed' || i.level === 'dismissed').slice(0, 50);

  return (
    <>
      <TopBar title="Inbox" backTo="/home" right={<SettingsButton />} />
      <main>
        {shared === '1' && (
          <div class="notice">
            <p style="margin-top:0"><b>Saved to Inbox ✓</b></p>
            <div class="btn-row">
              <button class="btn primary" type="button" disabled={!fresh.length} onClick={() => fresh[0] && go('/inbox/' + fresh[0].id, { replace: true })}>File it now</button>
              <button class="btn" type="button" onClick={leaveToPreviousApp}>Later</button>
            </div>
          </div>
        )}
        {shared === 'failed' && (
          <p class="notice bad">What you shared could not be saved. Nothing else changed. Share it again — or copy it and tap Paste.</p>
        )}
        {!items ? <Loading /> : (
          <>
            {fresh.length === 0 && (
              <div class="empty">
                <p><b>Nothing waiting.</b></p>
                <p>Share a message, PDF, photo or contact to ZivugBase from WhatsApp or email — or tap Paste, Speak or Photo below. It waits here until you file it.</p>
              </div>
            )}
            {fresh.map((i) => names && <Row key={i.id} i={i} names={names} />)}
            {done.length > 0 && (
              <details class="section">
                <summary>Filed and dismissed<span class="count">({done.length})</span></summary>
                <div class="body">{done.map((i) => names && <Row key={i.id} i={i} names={names} />)}</div>
              </details>
            )}
          </>
        )}
      </main>
      <CaptureBar />
    </>
  );
}
