/* After a PeerMatch import: "Was she suggested to you?" — PeerMatch's girls are a mix of girls
   offered to the owner and girls kept to offer friends. Each Yes records an idea for "me". */
import { useEffect, useState } from 'preact/hooks';
import { ensureMe, getSetting, setSetting } from '../../db/repo';
import { applySuggestedToMe, type ReviewRow } from '../../import/peermatch';
import { go, reportError, showToast } from '../../state';
import { plural } from '../../text';
import { Loading, TopBar, YesNo } from '../parts/common';

export function ImportReview() {
  const [rows, setRows] = useState<ReviewRow[] | null>();
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting<ReviewRow[] | null>('pendingReview', null).then((r) => {
      setRows(r);
      setAnswers(Object.fromEntries((r ?? []).map((x) => [x.personId, x.preTicked])));
    });
  }, []);

  if (rows === undefined) return <><TopBar title="Suggested to you?" backTo="/home" /><main><Loading /></main></>;
  if (!rows?.length) {
    return (
      <>
        <TopBar title="Suggested to you?" backTo="/home" />
        <main><p>Nothing to answer right now.</p><button class="btn" type="button" onClick={() => go('/home')}>Home</button></main>
      </>
    );
  }

  const yesCount = rows.filter((r) => answers[r.personId]).length;
  const all = (v: boolean) => setAnswers(Object.fromEntries(rows.map((r) => [r.personId, v])));

  const save = async () => {
    setSaving(true);
    try {
      const me = await ensureMe();
      await applySuggestedToMe(me.id, rows.map((r) => ({ personId: r.personId, yes: !!answers[r.personId] })));
      await setSetting('pendingReview', null);
      go('/people?show=' + (yesCount ? 'suggested' : 'girls'), { replace: true });
      showToast(`Saved: ${plural(yesCount, 'girl')} suggested to you. Change any one on her page.`);
    } catch (e) {
      setSaving(false);
      reportError('Not saved. Your answers are still here — try again.', e);
    }
  };

  return (
    <>
      <TopBar title="Suggested to you?" backTo="/home" />
      <main>
        <p>For each girl from PeerMatch: was she suggested <b>to you</b>? “No” means you’re keeping her details for friends.</p>
        <p class="muted small">Answers already marked Yes are guesses from PeerMatch (she came from a shadchan, or was received from someone). Change any that are wrong.</p>
        <div class="btn-row" style="margin-bottom:8px">
          <button class="btn small quiet" type="button" onClick={() => all(true)}>All Yes</button>
          <button class="btn small quiet" type="button" onClick={() => all(false)}>All No</button>
        </div>
        {rows.map((r) => (
          <div key={r.personId} class="row" style="cursor:default">
            <span class="body">
              <span class="name bidi" style="display:block">{r.name}{r.age ? `, ${r.age}` : ''}</span>
              {r.reason && <span class="sub" style="display:block">{r.reason}</span>}
            </span>
            <YesNo value={answers[r.personId] ?? false} onChange={(v) => setAnswers({ ...answers, [r.personId]: !!v })} />
          </div>
        ))}
        <div class="form-actions">
          <button class="btn quiet" type="button" onClick={() => go('/home')}>Later</button>
          <button class="btn primary" type="button" disabled={saving} onClick={save}>Save ({yesCount} Yes)</button>
        </div>
      </main>
    </>
  );
}
