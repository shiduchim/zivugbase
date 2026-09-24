/* The person screen (PLAN §6.3): banner · where things stand · Call → Email → WhatsApp → SMS ·
   profile · looking for · resume & photos · collapsed sections with counts · added date. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { db } from '../../db/db';
import { addActivity, ensureMe, ideasFor, saveFile, savePerson, softDeletePerson, timeline } from '../../db/repo';
import { applySuggestedToMe } from '../../import/peermatch';
import type { Activity, ID, Person, Phone } from '../../db/types';
import { useLive } from '../../hooks';
import { ageLabel } from '../../lib/age';
import { dateTime, relativeDay, shortDate } from '../../lib/format';
import { displayPhone } from '../../lib/phone';
import { back, go, reportError, showToast } from '../../state';
import { CAME_FROM_LABEL, CHANNEL_LABEL, FACT_LABEL, HOW_WELL_LABEL, IDEA_STATUS, KIND_LABEL, OK_TO_SHARE_LABEL, ROLE_LABEL } from '../../text';
import { Loading, Sheet, TopBar, Viewer, YesNo } from '../parts/common';
import { FileList } from '../parts/Files';
import { StandsSheet } from '../parts/StandsSheet';
import { canRecord, pickType } from '../parts/Recorder';
import { call, canSms, canWhatsApp, email, phoneLabel, sms, whatsapp } from '../contact';
import { displayName, waitingText, whenText } from '../describe';
import { useFileUrl } from '../../hooks';

type SheetKind = 'stands' | 'call' | 'whatsapp' | 'sms' | 'email' | null;

function Section({ title, count, children, open }: { title: string; count?: number; children: ComponentChildren; open?: boolean }) {
  return (
    <details class="section" open={open}>
      <summary>{title}{count !== undefined && <span class="count">({count})</span>}</summary>
      <div class="body">{children}</div>
    </details>
  );
}

function NameLink({ id, people, fallback = 'someone' }: { id: ID; people: Map<ID, Person> | undefined; fallback?: string }) {
  const p = people?.get(id);
  if (!p) return <span class="muted">{fallback}</span>;
  return <a href={'#/person/' + id} onClick={(e) => { e.preventDefault(); go('/person/' + id); }}>{displayName(p)}</a>;
}

/* PeerMatch's detail header: round back · name · photo · ב״ה over Edit. Stays at the top. */
function DetailHead({ p }: { p: Person }) {
  const [view, setView] = useState(false);
  const isGirl = p.gender === 'f';
  const hasPhoto = p.photoFileIds.length > 0;
  const tile = useFileUrl(!isGirl && hasPhoto ? p.photoFileIds[0] : undefined, true);
  const full = useFileUrl(view ? p.photoFileIds[0] : undefined);
  return (
    <header class="dhead">
      <button class="roundback" type="button" aria-label="Back" onClick={() => back('/people')}>‹</button>
      <h1 class="bidi" dir="auto">{displayName(p)}</h1>
      {tile.url && <button class="tile" type="button" aria-label="Open the photo" onClick={() => setView(true)}><img src={tile.url} alt="" /></button>}
      {isGirl && hasPhoto && <button class="lb sm" type="button" style="padding:4px 10px" onClick={() => setView(true)}>Photo</button>}
      <div class="edit">
        <span class="bh">ב״ה</span>
        <button class="lb" type="button" onClick={() => go(`/person/${p.id}/edit`)}>Edit</button>
      </div>
      {view && full.url && <Viewer url={full.url} onClose={() => setView(false)} />}
    </header>
  );
}

function StandsLine({ p, last, onOpen }: { p: Person; last?: number; onOpen: () => void }) {
  const parts: string[] = [];
  if (p.status) parts.push(p.status);
  const w = waitingText(p);
  if (w) parts.push(w);
  if (p.nextStep) parts.push(`Next: ${p.nextStep.what} ${whenText(p.nextStep.due)}`);
  if (last) parts.push(`Last contact: ${relativeDay(last).toLowerCase()}`);
  const late = !!p.nextStep?.due && p.nextStep.due < Date.now();
  return (
    <button type="button" class={`stands${w || late ? ' wait' : ''}`} onClick={onOpen}>
      {parts.length ? parts.map((t, i) => <span key={i}>{i > 0 && <span aria-hidden="true">· </span>}{t}</span>) : <span class="muted">Nothing planned — tap to add a next step</span>}
    </button>
  );
}

const OUTGOING = new Set(['message-out', 'profile-sent']);

function HCard({ a, selfId, people }: { a: Activity; selfId: ID; people: Map<ID, Person> | undefined }) {
  const others = a.linkKeys.filter((k) => k.startsWith('p:') && k !== 'p:' + selfId).map((k) => k.slice(2));
  const channel = a.channel ? CHANNEL_LABEL[a.channel] ?? a.channel : '';
  const base = a.title || KIND_LABEL[a.kind];
  const title = channel && !base.toLowerCase().includes(channel.toLowerCase()) ? `${base} · ${channel}` : base;
  const remove = async () => {
    await db.activities.update(a.id, { deletedAt: Date.now() });
    showToast('Entry deleted.', { label: 'Undo', run: async () => { await db.activities.update(a.id, { deletedAt: undefined }); } });
  };
  const answered = a.meta?.answered;
  return (
    <div class={`hcard${OUTGOING.has(a.kind) ? ' out' : ''}`}>
      <div class="top">
        <span class="what">{title}</span>
        <span>{a.at ? dateTime(a.at) : 'Date unknown'}</span>
        <button type="button" class="x" onClick={remove} aria-label={`Delete this entry: ${title}`}>Delete</button>
      </div>
      {others.length > 0 && <div class="to">{OUTGOING.has(a.kind) ? 'To: ' : 'With: '}{others.map((id, i) => <span key={id}>{i > 0 && ', '}<NameLink id={id} people={people} /></span>)}</div>}
      {typeof answered === 'boolean' && <div class="small">Answered: {answered ? 'Yes' : 'No'}</div>}
      {a.text && <div class="pre bidi" dir="auto">{a.text}</div>}
      {typeof a.meta?.transcript === 'string' && a.meta.transcript && <div class="pre bidi muted" dir="auto">{a.meta.transcript}</div>}
      {a.audioFileId && <FileList ids={[a.audioFileId]} />}
      {a.fileIds && a.fileIds.length > 0 && <FileList ids={a.fileIds} />}
    </div>
  );
}

/* The note bar at the bottom, like WhatsApp: type and send, or tap the mic to record. */
function Composer({ onNote, onAudio }: { onNote: (text: string) => Promise<void>; onAudio: (blob: Blob, seconds: number) => Promise<void> }) {
  const [text, setText] = useState('');
  const [rec, setRec] = useState<{ r: MediaRecorder; stream: MediaStream; t0: number }>();
  const [secs, setSecs] = useState(0);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs(Math.round((Date.now() - rec.t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [rec]);
  useEffect(() => () => { rec?.stream.getTracks().forEach((t) => t.stop()); }, [rec]);

  const start = async () => {
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {
      showToast('The microphone isn’t allowed. Allow it in Chrome’s site settings.');
      return;
    }
    const type = pickType();
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.start(1000);
    setSecs(0);
    setRec({ r, stream, t0: Date.now() });
  };
  const stop = () => {
    if (!rec) return;
    const { r, stream, t0 } = rec;
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
      if (blob.size) void onAudio(blob, Math.round((Date.now() - t0) / 1000));
    };
    r.stop();
    setRec(undefined);
  };
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    await onNote(t);
    setText('');
  };

  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div class="composer">
      {rec
        ? <span class="recnote" aria-live="polite">Recording… {mmss} — tap ■ to save</span>
        : <input type="text" dir="auto" placeholder="Note…" aria-label="Note" value={text} onInput={(e) => setText(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} />}
      {rec
        ? <button type="button" class="go rec" aria-label="Stop and save the voice note" onClick={stop}>■</button>
        : text.trim()
          ? <button type="button" class="go" aria-label="Save note" onClick={send}>➤</button>
          : canRecord() && <button type="button" class="go" aria-label="Record a voice note" onClick={start}>🎙</button>}
    </div>
  );
}

export function PersonScreen({ id }: { id: ID }) {
  const p = useLive(async () => (await db.people.get(id)) ?? null, [id]);
  const acts = useLive(() => timeline(id), [id]);
  const ideas = useLive(() => ideasFor(id), [id]);
  const contactOf = useLive(() => db.people.filter((x) => !x.deletedAt && x.contactPeople.some((c) => c.personId === id)).toArray(), [id]);
  const [sheet, setSheet] = useState<SheetKind>(null);

  const refIds = useMemo(() => {
    const s = new Set<ID>();
    p?.contactPeople.forEach((c) => s.add(c.personId));
    if (p?.cameFrom?.personId) s.add(p.cameFrom.personId);
    if (p?.voucher?.personId) s.add(p.voucher.personId);
    ideas?.forEach((i) => { s.add(i.aId); s.add(i.bId); i.suggestedBy.forEach((x) => x.personId && s.add(x.personId)); });
    acts?.forEach((a) => a.linkKeys.forEach((k) => k.startsWith('p:') && s.add(k.slice(2))));
    s.delete(id);
    return [...s].sort();
  }, [p, ideas, acts, id]);
  const people = useLive(async () => {
    const rows = await db.people.bulkGet(refIds);
    return new Map(rows.filter((r): r is Person => !!r && !r.deletedAt).map((r) => [r.id, r]));
  }, [refIds.join(',')]);

  if (p === undefined) return <><TopBar title="" backTo="/people" /><main><Loading /></main></>;
  if (p === null || p.deletedAt) {
    return (
      <>
        <TopBar title="Not found" backTo="/people" />
        <main>
          <p>This person was deleted or isn’t here.</p>
          <button class="btn" type="button" onClick={() => go('/settings?open=deleted')}>Recently deleted</button>
        </main>
      </>
    );
  }

  const phones = p.phones.filter((ph) => ph.number.trim());
  const waPhones = phones.filter((ph) => canWhatsApp(p, ph));
  const smsPhones = phones.filter(canSms);
  const lastContact = acts?.find((a) => a.at && a.kind !== 'note' && a.kind !== 'status')?.at;
  const isSingle = p.roles.includes('single');
  const isGirl = p.gender === 'f';
  const age = ageLabel(p.age, p.dob);

  const act = (kind: 'call' | 'whatsapp' | 'sms', list: Phone[]) => {
    if (list.length === 1) {
      const ph = list[0]!;
      if (kind === 'call') call(p, ph); else if (kind === 'whatsapp') whatsapp(p, ph); else sms(p, ph);
    } else setSheet(kind);
  };

  const waiting = p.waitingSince !== undefined;
  const need = (what: string) => showToast(`Add ${what} first — tap Edit.`);
  const toggleWaiting = async () => {
    const q = structuredClone(p);
    if (waiting) delete q.waitingSince; else q.waitingSince = Date.now();
    await savePerson(q);
    await addActivity('status', '', [p.id], { title: waiting ? 'Reply received' : 'Waiting for reply' });
  };

  const remove = async () => {
    const undo = await softDeletePerson(p.id);
    back('/people');
    showToast(`${displayName(p)} deleted.`, { label: 'Undo', run: undo });
  };

  const saveNote = async (text: string) => {
    await addActivity('note', text, [p.id]);
    showToast('Note added.');
  };

  const saveRecording = async (blob: Blob, seconds: number) => {
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const fileId = await saveFile(blob, `Voice note ${new Date().toISOString().slice(0, 10)}.${ext}`);
      await addActivity('audio', '', [p.id], { audioFileId: fileId, meta: { seconds } });
      setSheet(null);
      showToast('Voice note saved.');
    } catch (e) {
      reportError('The voice note was not saved.', e);
    }
  };

  /* who has their profile / which profiles were sent to them */
  const shares = (acts ?? []).filter((a) => a.kind === 'profile-sent' || a.kind === 'profile-received');
  const factEntries = Object.entries(p.facts).filter(([, v]) => v !== '' && v !== undefined);
  const contactCount = p.contactPeople.length + (contactOf?.length ?? 0);

  return (
    <>
      <DetailHead p={p} />
      <main>
        <div class="metapills">
          {age && <span>Age {age}</span>}
          {p.city && <span class="bidi">{p.city}</span>}
          {p.roles.filter((r) => r !== 'me').map((r) => <span key={r}>{r === 'single' ? (isGirl ? 'Girl' : p.gender === 'm' ? 'Guy' : 'Single') : r === 'helper' && p.helperType ? p.helperType : ROLE_LABEL[r]}</span>)}
          {p.kohen === true && <span>Kohen</span>}
          {phones.some((ph) => ph.type === 'landline') && <span>Landline</span>}
          {p.favorite && <span>★ Favorite</span>}
        </div>

        <div class="crow">
          <button class="lb" type="button" onClick={() => (phones.length ? act('call', phones) : need('a phone number'))}>Call</button>
          <button class="lb" type="button" onClick={() => (p.emails.length === 1 ? email(p, p.emails[0]!) : p.emails.length ? setSheet('email') : need('an email'))}>Email</button>
          <button class="lb" type="button" onClick={() => (waPhones.length ? act('whatsapp', waPhones) : need('a WhatsApp number'))}>WhatsApp</button>
          <button class="lb" type="button" onClick={() => (smsPhones.length ? act('sms', smsPhones) : need(phones.length ? 'a mobile number (landlines can’t get SMS)' : 'a phone number'))}>SMS</button>
          <button class={`lb ${waiting ? 'wait-on' : 'outline'}`} type="button" aria-pressed={waiting} onClick={toggleWaiting}>Waiting for reply</button>
        </div>
        {phones.length === 0 && p.emails.length === 0 && p.contactPeople.length > 0 && (
          <p class="muted small">No number of their own — see Contact people below.</p>
        )}

        <StandsLine p={p} last={lastContact} onOpen={() => setSheet('stands')} />
        {isSingle && isGirl && (
          <div class="row" style="cursor:default;min-height:56px">
            <span class="body">Suggested to me?</span>
            <YesNo value={p.suggestedToMe ?? null} onChange={async (v) => {
              const me = await ensureMe();
              await applySuggestedToMe(me.id, [{ personId: p.id, yes: !!v }]);
            }} />
          </div>
        )}

        {p.profile.text && (
          <div class="pcardx">
            <div class="pre bidi" dir="auto" style="line-height:1.5">{p.profile.text}</div>
          </div>
        )}
        {p.audioProfile && (
          <div class="card">
            <h2>Voice profile</h2>
            <FileList ids={[p.audioProfile.fileId]} />
            {p.audioProfile.transcript && <div class="pre bidi muted" dir="auto">{p.audioProfile.transcript}</div>}
          </div>
        )}
        {(p.lookingFor.text || p.lookingFor.minAge || p.lookingFor.maxAge) && (
          <div class="card">
            <h2>Looking for</h2>
            {p.lookingFor.text && <div class="pre bidi" dir="auto">{p.lookingFor.text}</div>}
            {(p.lookingFor.minAge || p.lookingFor.maxAge) && (
              <p class="muted" style="margin:6px 0 0">
                {p.lookingFor.minAge && p.lookingFor.maxAge ? `Age ${p.lookingFor.minAge}–${p.lookingFor.maxAge}` : p.lookingFor.maxAge ? `Up to age ${p.lookingFor.maxAge}` : `From age ${p.lookingFor.minAge}`}
              </p>
            )}
          </div>
        )}
        {(p.resumeFileIds.length > 0 || p.photoFileIds.length > 0) && (
          <div class="card">
            <h2>Resume &amp; photos</h2>
            <FileList ids={p.resumeFileIds} />
            {p.photoFileIds.length > 0 && <div style="margin-top:8px"><FileList ids={p.photoFileIds} hidePhotosUntilAsked={isGirl} /></div>}
          </div>
        )}

        {(ideas?.length ?? 0) > 0 && (
          <Section title="Ideas" count={ideas!.length}>
            {ideas!.map((i) => {
              const other = i.aId === id ? i.bId : i.aId;
              return (
                <div key={i.id} class="event">
                  <div class="head"><b><NameLink id={other} people={people} fallback="Me" /></b><span>{IDEA_STATUS[i.status]}</span></div>
                  {i.suggestedBy.length > 0 && <div class="small muted">Suggested by {i.suggestedBy.map((s, k) => <span key={k}>{k > 0 && ', '}{s.personId ? <NameLink id={s.personId} people={people} /> : s.site}</span>)}</div>}
                  {i.notes && <div class="small">{i.notes}</div>}
                </div>
              );
            })}
          </Section>
        )}

        {shares.length > 0 && (
          <Section title={isSingle ? 'Profile shared' : 'Profiles shared with them'} count={shares.length}>
            {shares.map((a) => {
              const others = a.linkKeys.filter((k) => k.startsWith('p:') && k !== 'p:' + id).map((k) => k.slice(2));
              return (
                <div key={a.id} class="event">
                  <div class="head"><b>{a.kind === 'profile-sent' ? 'Sent' : 'Received'}</b><span>{a.at ? shortDate(a.at) : 'Date unknown'}</span></div>
                  <div>{others.length ? others.map((o, k) => <span key={o}>{k > 0 && ', '}<NameLink id={o} people={people} /></span>) : <span class="muted">—</span>}</div>
                </div>
              );
            })}
          </Section>
        )}

        {contactCount > 0 && (
          <Section title="Contact people" count={contactCount}>
            {p.contactPeople.map((c) => (
              <div key={c.personId} class="event"><span class="muted">{c.relation}: </span><NameLink id={c.personId} people={people} /></div>
            ))}
            {contactOf?.map((x) => (
              <div key={x.id} class="event"><span class="muted">Contact for: </span><a href={'#/person/' + x.id} onClick={(e) => { e.preventDefault(); go('/person/' + x.id); }}>{displayName(x)}</a></div>
            ))}
          </Section>
        )}

        <Section title="Details & categories">
          {phones.map((ph, i) => <div key={i} class="event">Phone: <b>{phoneLabel(ph)}</b></div>)}
          {p.emails.map((e) => <div key={e} class="event">Email: <b>{e}</b></div>)}
          {p.dob && <div class="event">Date of birth: {p.dob}</div>}
          {p.age && <div class="event small muted">Age {p.age.value} {p.age.estimated ? `(noted around ${shortDate(p.age.asOf)})` : `on ${shortDate(p.age.asOf)}`}</div>}
          {p.altNames.length > 0 && <div class="event">Also written: {p.altNames.join(', ')}</div>}
          {p.kohen !== undefined && p.kohen !== null && <div class="event">Kohen: {p.kohen ? 'Yes' : 'No'}</div>}
          {factEntries.map(([k, v]) => <div key={k} class="event">{FACT_LABEL[k] ?? k}: {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}</div>)}
          {p.howWellKnown && <div class="event">{HOW_WELL_LABEL[p.howWellKnown]}</div>}
          {p.okToShare && <div class="event">OK to share their profile: {OK_TO_SHARE_LABEL[p.okToShare]}</div>}
          {p.links.map((l) => <div key={l} class="event"><a href={l} target="_blank" rel="noopener noreferrer">{l}</a></div>)}
          {p.tags.length > 0 && <div class="chips wrap" style="margin-top:8px">{p.tags.map((t) => <span key={t} class="pill">{t}</span>)}</div>}
          {!phones.length && !p.emails.length && !factEntries.length && !p.tags.length && <p class="muted">Nothing yet. Tap Edit to add details and categories.</p>}
          {p.legacy && <LegacyRecord record={p.legacy.record} />}
        </Section>

        {(p.cameFrom || p.voucher) && (
          <Section title="Where they came from">
            {p.cameFrom && (
              <div class="event">
                {CAME_FROM_LABEL[p.cameFrom.kind]}
                {p.cameFrom.personId && <> — <NameLink id={p.cameFrom.personId} people={people} /></>}
                {p.cameFrom.note && <div class="muted">{p.cameFrom.note}</div>}
                {p.cameFrom.date && <div class="small muted">{shortDate(p.cameFrom.date)}</div>}
              </div>
            )}
            {p.voucher && <div class="event">Vouched for by {p.voucher.personId ? <NameLink id={p.voucher.personId} people={people} /> : ''} {p.voucher.text}</div>}
          </Section>
        )}

        <div class="band">History</div>
        {!acts ? <Loading /> : acts.length === 0 ? <p class="muted small">Nothing yet. Calls, messages and notes show up here.</p> : acts.map((a) => <HCard key={a.id} a={a} selfId={id} people={people} />)}

        {p.notes && (
          <Section title="Private notes">
            <div class="pre bidi" dir="auto">{p.notes}</div>
          </Section>
        )}

        <p class="added">Added: {p.createdAt ? dateTime(p.createdAt) : 'date unknown'}{p.legacyKey?.startsWith('peermatch:') ? ' (in PeerMatch)' : ''}</p>
        <button class="btn danger" type="button" onClick={remove}>Delete {displayName(p)}</button>
      </main>

      <Composer onNote={saveNote} onAudio={saveRecording} />
      {sheet === 'stands' && <StandsSheet p={p} onClose={() => setSheet(null)} />}
      {(sheet === 'call' || sheet === 'whatsapp' || sheet === 'sms') && (
        <Sheet title={sheet === 'call' ? 'Call which number?' : sheet === 'whatsapp' ? 'WhatsApp which number?' : 'SMS which number?'} onClose={() => setSheet(null)}>
          {(sheet === 'call' ? phones : sheet === 'whatsapp' ? waPhones : smsPhones).map((ph, i) => (
            <button key={i} type="button" class="choice" onClick={() => { setSheet(null); if (sheet === 'call') call(p, ph); else if (sheet === 'whatsapp') whatsapp(p, ph); else sms(p, ph); }}>
              <b>{displayPhone(ph.number)}</b>{ph.label && <span class="muted">{ph.label}</span>}
            </button>
          ))}
        </Sheet>
      )}
      {sheet === 'email' && (
        <Sheet title="Email which address?" onClose={() => setSheet(null)}>
          {p.emails.map((e) => <button key={e} type="button" class="choice" onClick={() => { setSheet(null); email(p, e); }}><b>{e}</b></button>)}
        </Sheet>
      )}
    </>
  );
}

function LegacyRecord({ record }: { record: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div style="margin-top:12px">
      <button type="button" class="btn small quiet" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} the original PeerMatch record</button>
      {open && <pre class="pre small" style="overflow:auto;max-height:50vh">{JSON.stringify(record, null, 1)}</pre>}
    </div>
  );
}
