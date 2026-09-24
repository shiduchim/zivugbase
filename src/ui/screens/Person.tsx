/* A person's page, exactly in PeerMatch's order (docs/REBUILD_INVENTORY.md in shiduchim/match).
   Guys and girls, and shadchanim, have different pages — as in PeerMatch:

   Guy / Girl: header · last call · Age · "Contact person" Call Email WhatsApp SMS Waiting ·
     Call due · Translate · profile · Looking for · attachment · talked by phone / in person ·
     Contacts · quick details · Linked Shadchan · (added: Add to… folders, how well, suggested) ·
     History · added date · note bar.
   Shadchan: header · last call · "Contact shadchan" row · Call today / tomorrow / Clear ·
     Linked profiles · Referred by · quick details · profile / notes · attachment ·
     (added: Add to… folders, how well) · History · added date · note bar. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { db } from '../../db/db';
import { addActivity, ensureMe, getSetting, saveFile, savePerson, timeline } from '../../db/repo';
import { allFolders, folderPath } from '../../db/folders';
import { applySuggestedToMe } from '../../import/peermatch';
import type { Activity, ID, List, Person, Phone } from '../../db/types';
import { useFileUrl, useLive } from '../../hooks';
import { ageLabel } from '../../lib/age';
import { dateTime, startOfDay } from '../../lib/format';
import { digitsOf, displayPhone, phoneType } from '../../lib/phone';
import { back, go, mode, reportError, showToast } from '../../state';
import { CHANNEL_LABEL, HOW_WELL_LABEL, KIND_LABEL } from '../../text';
import { Loading, Sheet, TopBar, Viewer, YesNo } from '../parts/common';
import { FileList } from '../parts/Files';
import { FolderPicker } from '../parts/FolderPicker';
import { MicIcon, SendIcon, StopIcon } from '../parts/Icons';
import { canRecord, pickType } from '../parts/Recorder';
import { call, canSms, canWhatsApp, email, sms, whatsapp } from '../contact';
import { displayName } from '../describe';
import { BODY_TYPES, FLAGS, LANGUAGES } from '../fields';
import { LANG_LABEL, translate, type Lang } from '../translate';

const DAY = 86400000;
type Pick = { kind: 'call' | 'whatsapp' | 'sms'; who: Person; phones: Phone[] } | null;

/* Save one change to the stored record (never to a stale copy on screen). */
async function patch(id: ID, fn: (q: Person) => void): Promise<void> {
  const q = await db.people.get(id);
  if (!q) return;
  fn(q);
  await savePerson(q);
}
const openPerson = (id: ID) => go('/person/' + id);
const toInput = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ───── header ───── */

function DetailHead({ p }: { p: Person }) {
  const [view, setView] = useState(false);
  const single = p.roles.includes('single');
  const isGirl = single && p.gender === 'f';
  const hasPhoto = p.photoFileIds.length > 0;
  const tile = useFileUrl(!isGirl && hasPhoto ? p.photoFileIds[0] : undefined, true);
  const full = useFileUrl(view ? p.photoFileIds[0] : undefined);
  return (
    <header class="dhead">
      <button class="roundback" type="button" aria-label="Back" onClick={() => back('/people')}>‹</button>
      <h1 class="bidi" dir="auto">{displayName(p).replace(/\*/g, '')}</h1>
      {tile.url && <button class="tile" type="button" aria-label="Open the photo" onClick={() => setView(true)}><img src={tile.url} alt="" /></button>}
      {isGirl && hasPhoto && <button class="lb sm" type="button" style="padding:4px 10px" onClick={() => setView(true)}>Photo</button>}
      <div class="edit">
        {single && <span class="bh">ב״ה</span>}
        <button class="lb" type="button" onClick={() => go(`/person/${p.id}/edit`)}>Edit</button>
      </div>
      {view && full.url && <Viewer url={full.url} onClose={() => setView(false)} />}
    </header>
  );
}

/* ───── pieces both pages use ───── */

function LastCall({ a }: { a: Activity | undefined }) {
  if (!a) return null;
  const phone = typeof a.meta?.phone === 'string' ? a.meta.phone : '';
  const secs = typeof a.meta?.durationApproxSec === 'number' ? a.meta.durationApproxSec : 0;
  const bits = [typeof a.meta?.answered === 'boolean' ? (a.meta.answered ? 'Answered' : 'Not answered') : '', secs ? `~${secs < 60 ? secs + 's' : Math.round(secs / 60) + 'm'} away` : ''].filter(Boolean);
  return (
    <div class="lastcall">
      <div class="top"><span>Last call status{phone ? ' • ' + phone : ''}</span><span>{dateTime(a.at)}</span></div>
      {bits.length > 0 && <div class="meta">{bits.join(' • ')}</div>}
      {a.text && <div class="pre bidi" dir="auto">{a.text}</div>}
      {a.audioFileId && <FileList ids={[a.audioFileId]} />}
    </div>
  );
}

/* Profile text: WhatsApp *bold* shown bold, phone numbers tappable (Call / WhatsApp). */
const TOKEN = /(\*[^*\n]+\*)|(\+?\d[\d\s().-]{7,}\d)/g;
function RichText({ text, onPhone }: { text: string; onPhone: (n: string) => void }) {
  const out: preact.ComponentChildren[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m[2]) { const n = digitsOf(m[2]).length; if (n < 9 || n > 15) continue; }
    if (m.index! > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<b key={k++}>{m[1].slice(1, -1)}</b>);
    else { const num = m[2]!; out.push(<button key={k++} type="button" class="inline-phone" onClick={() => onPhone(num)}>{num}</button>); }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <div class="pre bidi profile-text" dir="auto">{out}</div>;
}

const OUTGOING = new Set(['message-out', 'profile-sent']);

function NameLink({ id, people }: { id: ID; people: Map<ID, Person> }) {
  const p = people.get(id);
  if (!p) return <span class="muted">someone</span>;
  return <a href={'#/person/' + id} onClick={(e) => { e.preventDefault(); openPerson(id); }}>{displayName(p)}</a>;
}

function HCard({ a, selfId, people }: { a: Activity; selfId: ID; people: Map<ID, Person> }) {
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
      {others.length > 0 && <div class="to">{OUTGOING.has(a.kind) || a.kind === 'call' || a.kind === 'action' ? 'To: ' : 'With: '}{others.map((id, i) => <span key={id}>{i > 0 && ', '}<NameLink id={id} people={people} /></span>)}</div>}
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
        ? <span class="recnote" aria-live="polite">Recording… {mmss}</span>
        : <input type="text" dir="auto" placeholder="Note…" aria-label="Note" value={text} onInput={(e) => setText(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} />}
      {rec
        ? <button type="button" class="go rec" aria-label="Stop and save the voice note" onClick={stop}><StopIcon /></button>
        : text.trim()
          ? <button type="button" class="go" aria-label="Save note" onClick={send}><SendIcon /></button>
          : canRecord() && <button type="button" class="go" aria-label="Record a voice note" onClick={start}><MicIcon /></button>}
    </div>
  );
}

/* A text box that saves itself a moment after you stop typing (PeerMatch's quick details). */
function AutoText({ label, value, placeholder, area, onSave }: { label: string; value: string; placeholder?: string; area?: boolean; onSave: (v: string) => Promise<void> }) {
  const [v, setV] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const typing = useRef(false);
  useEffect(() => { if (!typing.current) setV(value); }, [value]);
  const change = (next: string) => {
    setV(next);
    typing.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { typing.current = false; void onSave(next.trim()); }, 400);
  };
  return area
    ? <label class="qfield area"><span>{label}</span><textarea dir="auto" value={v} placeholder={placeholder} onInput={(e) => change(e.currentTarget.value)} /></label>
    : <label class="qfield"><span>{label}</span><input type="text" dir="auto" value={v} placeholder={placeholder} onInput={(e) => change(e.currentTarget.value)} /></label>;
}

/* Call · Email · WhatsApp · SMS · Waiting for reply — five equal buttons (PeerMatch order). */
function ContactButtons({ p, reach, onPick }: { p: Person; reach: Person; onPick: (x: Pick) => void }) {
  const phones = reach.phones.filter((ph) => ph.number.trim());
  const emails = p.emails.length ? p.emails : reach.emails;
  const waiting = p.waitingSince !== undefined;
  const need = (what: string) => showToast(`Add ${what} first — tap Edit.`);
  const act = (kind: 'call' | 'whatsapp' | 'sms') => {
    const list = kind === 'call' ? phones : kind === 'sms' ? phones.filter(canSms) : phones.filter((ph) => canWhatsApp(reach, ph));
    if (!list.length) { need(kind === 'sms' && phones.length ? 'a mobile number (landlines can’t get SMS)' : 'a phone number'); return; }
    if (list.length === 1) {
      const ph = list[0]!;
      if (kind === 'call') call(reach, ph, p); else if (kind === 'whatsapp') whatsapp(reach, ph, '', p); else sms(reach, ph, p);
    } else onPick({ kind, who: reach, phones: list });
  };
  const toggleWaiting = async () => {
    await patch(p.id, (q) => { if (waiting) delete q.waitingSince; else q.waitingSince = Date.now(); });
    await addActivity('status', waiting ? 'Cleared waiting for reply.' : '', [p.id], { title: waiting ? 'Reply received' : 'Waiting for reply' });
  };
  return (
    <div class="crow">
      <button class="lb" type="button" onClick={() => act('call')}>Call</button>
      <button class="lb" type="button" onClick={() => (emails.length ? email(reach, emails[0]!, p) : need('an email'))}>Email</button>
      <button class="lb" type="button" onClick={() => act('whatsapp')}>WhatsApp</button>
      <button class="lb" type="button" onClick={() => act('sms')}>SMS</button>
      <button class={`lb ${waiting ? 'wait-on' : 'outline'}`} type="button" aria-pressed={waiting} onClick={toggleWaiting}>Waiting for reply</button>
    </div>
  );
}

/* Call today · Call tomorrow · (Pick a date) · Clear. PeerMatch had it for shadchanim;
   the owner asked for it on everyone, so anyone can be put on Calls due in one tap. */
function CallDue({ p }: { p: Person }) {
  const [open, setOpen] = useState(false);
  const today = startOfDay(Date.now());
  const due = p.nextStep?.due;
  const day = due !== undefined ? startOfDay(due) : undefined;
  const other = day !== undefined && day !== today && day !== today + DAY;
  const set = async (at: number | undefined, label: string) => {
    await patch(p.id, (q) => { if (at === undefined) delete q.nextStep; else { q.nextStep = { what: 'Call', due: at }; delete q.snoozeUntil; } });
    await addActivity('status', '', [p.id], { title: at === undefined ? 'Call reminder cleared' : `Call reminder set — ${label}` });
  };
  return (
    <>
      <div class="duerow">
        <button type="button" class={`lb sm${day === today ? ' wait-on' : ''}`} onClick={() => set(today + 12 * 3600000, 'today')}>Call today</button>
        <button type="button" class={`lb sm${day === today + DAY ? ' wait-on' : ''}`} onClick={() => set(today + DAY + 12 * 3600000, 'tomorrow')}>Call tomorrow</button>
        <button type="button" class={`lb sm${other ? ' wait-on' : ''}`} onClick={() => setOpen(!open)}>{other ? new Date(due!).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Pick a date'}</button>
        <button type="button" class="lb sm gray" disabled={due === undefined} onClick={() => set(undefined, '')}>{due === undefined ? 'No reminder' : 'Clear'}</button>
      </div>
      {open && <input type="date" style="margin:-4px 0 10px" value={due ? toInput(due) : ''} onInput={(e) => { const at = Date.parse(e.currentTarget.value + 'T12:00'); if (Number.isFinite(at)) { void set(at, new Date(at).toLocaleDateString()); setOpen(false); } }} />}
    </>
  );
}

function Talked({ p }: { p: Person }) {
  const f = p.facts;
  const setFact = (k: string, v: string | boolean) => patch(p.id, (q) => { if (v === '' || v === false) delete q.facts[k]; else q.facts[k] = v; });
  return (
    <div class="pcardx">
      <div class="checks">
        <label class="check"><input type="checkbox" checked={!!f.talkedPhone} onChange={(e) => setFact('talkedPhone', e.currentTarget.checked)} />Talked by phone</label>
        <label class="check"><input type="checkbox" checked={!!f.talkedInPerson} onChange={(e) => setFact('talkedInPerson', e.currentTarget.checked)} />Talked in person</label>
      </div>
      {!!f.talkedPhone && <AutoText area label="Conversation info" value={String(f.phoneConversationNote ?? '')} placeholder="Phone conversation: length, importance, what it was like…" onSave={(v) => setFact('phoneConversationNote', v)} />}
      {!!f.talkedInPerson && <AutoText area label="Conversation info" value={String(f.inPersonConversationNote ?? '')} placeholder="In person: where, how it went…" onSave={(v) => setFact('inPersonConversationNote', v)} />}
    </div>
  );
}

/* Tags · Religious level · Religious details (+ for guys and girls the checkboxes above them). */
function QuickDetails({ p }: { p: Person }) {
  const f = p.facts;
  const single = p.roles.includes('single');
  const setFact = (k: string, v: string | boolean) => patch(p.id, (q) => { if (v === '' || v === false) delete q.facts[k]; else q.facts[k] = v; });
  return (
    <div class="pcardx qd">
      {single && (
        <>
          <div class="checks">
            {FLAGS.map(([k, label]) => {
              const on = k === 'kohen' ? p.kohen === true : !!f[k];
              return <label key={k} class="check"><input type="checkbox" checked={on} onChange={(e) => { const c = e.currentTarget.checked; void (k === 'kohen' ? patch(p.id, (q) => { if (c) q.kohen = true; else delete q.kohen; }) : setFact(k, c)); }} />{label}</label>;
            })}
          </div>
          <div class="grp">Speaks languages</div>
          <div class="checks">
            {LANGUAGES.map(([k, label]) => <label key={k} class="check"><input type="checkbox" checked={!!f[k]} onChange={(e) => setFact(k, e.currentTarget.checked)} />{label}</label>)}
          </div>
          <div class="grp">Body type</div>
          <div class="checks">
            {BODY_TYPES.map(([k, label]) => <label key={k} class="check"><input type="checkbox" checked={f.bodyType === k} onChange={(e) => setFact('bodyType', e.currentTarget.checked ? k : '')} />{label}</label>)}
          </div>
          <div class="grp" style="margin-bottom:0" />
        </>
      )}
      <AutoText label="Tags" value={p.tags.join(', ')} placeholder="Add tags" onSave={(v) => patch(p.id, (q) => { q.tags = v.split(/[,;]+/).map((t) => t.trim()).filter(Boolean); })} />
      <AutoText label="Religious level" value={String(f.religiousLevel ?? '')} placeholder="e.g. strong, moderate, light" onSave={(v) => setFact('religiousLevel', v)} />
      <AutoText label="Religious details" value={String(f.religiousDetails ?? '')} placeholder="e.g. Chabad, Breslev, Yeshivish, tzniut" onSave={(v) => setFact('religiousDetails', v)} />
    </div>
  );
}

function ContactRow({ label, who, about, onPick }: { label: string; who: Person | undefined; about: Person; onPick: (x: Pick) => void }) {
  const phones = who?.phones.filter((ph) => ph.number.trim()) ?? [];
  const act = (kind: 'call' | 'whatsapp' | 'sms') => {
    if (!who) return;
    const list = kind === 'call' ? phones : kind === 'sms' ? phones.filter(canSms) : phones.filter((ph) => canWhatsApp(who, ph));
    if (!list.length) { showToast(kind === 'sms' ? 'This number can’t get SMS (landline).' : 'No WhatsApp for this number.'); return; }
    if (list.length === 1) {
      const ph = list[0]!;
      if (kind === 'call') call(who, ph, about); else if (kind === 'whatsapp') whatsapp(who, ph, '', about); else sms(who, ph, about);
    } else onPick({ kind, who, phones: list });
  };
  return (
    <div class="crow2">
      <div class="head">
        <span class="kind">{label}:</span>
        {!who ? <span class="nm">Not added</span>
          : who.id === about.id ? <span class="nm bidi">{displayName(who)}</span>
          : <a class="nm bidi" href={'#/person/' + who.id} onClick={(e) => { e.preventDefault(); openPerson(who.id); }}>{displayName(who)}</a>}
      </div>
      {phones.length ? (
        <>
          {phones.map((ph, i) => <div key={i} class="ph">{displayPhone(ph.number)}{ph.type === 'landline' ? ' · landline' : ''}</div>)}
          <div class="acts">
            <button type="button" class="lb" onClick={() => act('call')}>Call</button>
            <button type="button" class="lb" onClick={() => act('whatsapp')}>WhatsApp</button>
            <button type="button" class="lb" onClick={() => act('sms')}>SMS</button>
          </div>
        </>
      ) : <div class="empty-ph">No phone number</div>}
    </div>
  );
}

function ShadchanSelect({ p, label, people }: { p: Person; label: string; people: Map<ID, Person> }) {
  const shadchanim = [...people.values()].filter((x) => x.roles.includes('shadchan') && x.id !== p.id).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div class="pcardx">
      <div class="t">{label}</div>
      <div style="display:flex;gap:6px">
        <select aria-label={label} value={p.cameFrom?.personId ?? ''} onChange={(e) => {
          const v = e.currentTarget.value;
          void patch(p.id, (q) => {
            if (v) q.cameFrom = { kind: q.cameFrom?.kind ?? 'referred', ...(q.cameFrom?.note ? { note: q.cameFrom.note } : {}), personId: v };
            else if (q.cameFrom) { delete q.cameFrom.personId; if (!q.cameFrom.note) delete q.cameFrom; }
          });
        }}>
          <option value="">{p.cameFrom?.note ? `${p.cameFrom.note} (not linked)` : label === 'Referred by' ? 'No one' : 'Add linked Shadchan…'}</option>
          {shadchanim.map((s) => <option key={s.id} value={s.id}>{displayName(s)}{s.phones[0] ? ' • ' + displayPhone(s.phones[0].number) : ''}</option>)}
        </select>
        {p.cameFrom?.personId && <button type="button" class="lb sm" style="padding:4px 14px" onClick={() => openPerson(p.cameFrom!.personId!)}>Open</button>}
      </div>
    </div>
  );
}

/* Added from ZivugBase at the owner's request: folders (Add to…), how well I know them,
   and — for singles — suggested to me. */
function Organize({ p, folders, askSuggested, onAdd }: { p: Person; folders: List[]; askSuggested: boolean; onAdd: () => void }) {
  const inFolders = folders.filter((fo) => fo.memberIds.includes(p.id));
  return (
    <div class="pcardx">
      <div class="t">Folders</div>
      <div class="chips wrap" style="padding-bottom:0">
        {inFolders.map((fo) => <span key={fo.id} class="pill">{folderPath(fo.id, folders)}</span>)}
        <button type="button" class="chip" onClick={onAdd}>Add to…</button>
      </div>
      <div class="grp">How well do I know them?</div>
      <div class="chips wrap" style="padding-bottom:0">
        {(Object.keys(HOW_WELL_LABEL) as (keyof typeof HOW_WELL_LABEL)[]).map((k) => (
          <button key={k} type="button" class={`chip${p.howWellKnown === k ? ' on' : ''}`} aria-pressed={p.howWellKnown === k} onClick={() => patch(p.id, (q) => { if (q.howWellKnown === k) delete q.howWellKnown; else q.howWellKnown = k; })}>{HOW_WELL_LABEL[k]}</button>
        ))}
      </div>
      {askSuggested && (
        <div class="yn-row">
          <span>Suggested to me?</span>
          <YesNo value={p.suggestedToMe ?? null} onChange={async (v) => {
            const me = await ensureMe();
            await applySuggestedToMe(me.id, [{ personId: p.id, yes: !!v }]);
          }} />
        </div>
      )}
    </div>
  );
}

/* ───── the page ───── */

export function PersonScreen({ id }: { id: ID }) {
  const p = useLive(async () => (await db.people.get(id)) ?? null, [id]);
  const acts = useLive(() => timeline(id), [id]);
  const folders = useLive(() => allFolders(), []);
  const all = useLive(() => db.people.toArray(), []);
  const myGender = useLive(() => getSetting<string>('myGender', ''), []);
  const [pick, setPick] = useState<Pick>(null);
  const [phoneMenu, setPhoneMenu] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [langBar, setLangBar] = useState(false);
  const [translated, setTranslated] = useState<{ lang: Lang; text: string }>();

  const people = useMemo(() => new Map((all ?? []).filter((x) => !x.deletedAt).map((x) => [x.id, x])), [all]);

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

  const single = p.roles.includes('single');
  const age = ageLabel(p.age, p.dob);
  const contacts = p.contactPeople.map((c) => people.get(c.personId)).filter((x): x is Person => !!x);
  const own = p.phones.filter((ph) => ph.number.trim());
  /* A single's contact row reaches the contact person (PeerMatch), or the single when there's none. */
  const reach = single ? contacts.find((c) => c.phones.some((ph) => ph.number.trim())) ?? p : p;
  const lastCall = acts?.find((a) => a.kind === 'call-note');
  const linked = [...people.values()].filter((x) => x.id !== p.id && (x.cameFrom?.personId === p.id || x.contactPeople.some((c) => c.personId === p.id)));
  const askSuggested = single && (myGender ? p.gender !== myGender : mode.value === 'me' && p.gender === 'f');

  const saveNote = async (text: string) => { await addActivity('note', text, [p.id]); };
  const saveRecording = async (blob: Blob, seconds: number) => {
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const fileId = await saveFile(blob, `Voice note ${new Date().toISOString().slice(0, 10)}.${ext}`);
      await addActivity('audio', '', [p.id], { audioFileId: fileId, meta: { seconds } });
    } catch (e) {
      reportError('The voice note was not saved.', e);
    }
  };
  const doTranslate = async (lang: Lang) => {
    const text = await translate(p.profile.text, lang);
    if (text) setTranslated({ lang, text });
  };

  const history = (
    <>
      <div class="band">History</div>
      {!acts ? <Loading /> : acts.length === 0 ? <p class="muted small">Nothing yet. Calls, messages and notes show up here.</p> : acts.map((a) => <HCard key={a.id} a={a} selfId={id} people={people} />)}
      <p class="added">Added to ZivugBase: {p.createdAt ? dateTime(p.createdAt) : 'date unknown'}{p.legacyKey?.startsWith('peermatch:') ? ' (from PeerMatch)' : ''}</p>
    </>
  );
  const attachment = p.resumeFileIds.length > 0 && (
    <div class="pcardx">
      <div class="t">Profile attachment</div>
      <FileList ids={p.resumeFileIds} />
    </div>
  );
  const organize = <Organize p={p} folders={folders ?? []} askSuggested={askSuggested} onAdd={() => setAdding(true)} />;

  return (
    <>
      <DetailHead p={p} />
      <main>
        <LastCall a={lastCall} />

        {single ? (
          <>
            {(age || own.some((ph) => ph.type === 'landline')) && (
              <div class="metapills">
                {age && <span>Age {age}</span>}
                {own.some((ph) => ph.type === 'landline') && <span>Landline</span>}
              </div>
            )}
            <div class="clabel">Contact person</div>
            <ContactButtons p={p} reach={reach} onPick={setPick} />
            <CallDue p={p} />
            {p.profile.text && (
              <>
                <button type="button" class="lb sm" style="padding:6px 16px;margin:2px 0 4px" onClick={() => setLangBar(!langBar)}>Translate</button>
                {langBar && (
                  <div class="chips">
                    {(Object.keys(LANG_LABEL) as Lang[]).map((l) => <button key={l} type="button" class={`chip${translated?.lang === l ? ' on' : ''}`} onClick={() => doTranslate(l)}>{LANG_LABEL[l]}</button>)}
                  </div>
                )}
                {translated && (
                  <div class="pcardx">
                    <div class="t">Translated to {LANG_LABEL[translated.lang]} <button type="button" class="link-btn" style="min-height:0;padding:0 0 0 8px" onClick={() => setTranslated(undefined)}>Hide</button></div>
                    <div class="pre bidi" dir="auto">{translated.text}</div>
                  </div>
                )}
                <div class="pcardx"><RichText text={p.profile.text} onPhone={setPhoneMenu} /></div>
              </>
            )}
            {p.audioProfile && <div class="pcardx"><div class="t">Audio profile</div><FileList ids={[p.audioProfile.fileId]} /></div>}
            {(p.lookingFor.text || p.lookingFor.maxAge) && (
              <div class="pcardx">
                {p.lookingFor.text && <><div class="t">Looking for</div><div class="pre bidi" dir="auto">{p.lookingFor.text}</div></>}
                {p.lookingFor.maxAge && <div style="margin-top:5px"><b>Up to age: </b>{p.lookingFor.maxAge}</div>}
              </div>
            )}
            {attachment}
            <Talked p={p} />
            <div class="pcardx contacts">
              <div class="h">Contacts</div>
              <ContactRow label="Profile" who={p} about={p} onPick={setPick} />
              {contacts.map((c, i) => <ContactRow key={c.id} label={`Contact ${i + 1}`} who={c} about={p} onPick={setPick} />)}
              {contacts.length < 2 && <ContactRow label={`Contact ${contacts.length + 1}`} who={undefined} about={p} onPick={setPick} />}
            </div>
            <QuickDetails p={p} />
            <ShadchanSelect p={p} label="Linked Shadchan" people={people} />
            {organize}
          </>
        ) : (
          <>
            <div class="clabel">{p.roles.includes('shadchan') ? 'Contact shadchan' : 'Contact'}</div>
            <ContactButtons p={p} reach={p} onPick={setPick} />
            <CallDue p={p} />
            {linked.length > 0 && (
              <div class="pcardx">
                <div class="t">Linked profiles ({linked.length})</div>
                <div class="chips wrap" style="padding-bottom:0">
                  {linked.map((x) => <button key={x.id} type="button" class="chip" onClick={() => openPerson(x.id)}>{x.roles.includes('single') ? (x.gender === 'f' ? 'Girl: ' : x.gender === 'm' ? 'Guy: ' : '') : ''}{displayName(x)}</button>)}
                </div>
              </div>
            )}
            <ShadchanSelect p={p} label="Referred by" people={people} />
            <QuickDetails p={p} />
            <Talked p={p} />
            {p.profile.text && (
              <div class="pcardx">
                <div class="t">Shadchan profile / notes</div>
                <RichText text={p.profile.text} onPhone={setPhoneMenu} />
              </div>
            )}
            {attachment}
            {organize}
          </>
        )}

        {history}
      </main>

      <Composer onNote={saveNote} onAudio={saveRecording} />

      {adding && <FolderPicker p={p} onClose={() => setAdding(false)} />}
      {pick && (
        <Sheet title={pick.kind === 'call' ? 'Call which number?' : pick.kind === 'whatsapp' ? 'WhatsApp which number?' : 'SMS which number?'} onClose={() => setPick(null)}>
          {pick.phones.map((ph, i) => (
            <button key={i} type="button" class="choice" onClick={() => { const x = pick; setPick(null); if (x.kind === 'call') call(x.who, ph, p); else if (x.kind === 'whatsapp') whatsapp(x.who, ph, '', p); else sms(x.who, ph, p); }}>
              <b>{displayPhone(ph.number)}</b>{ph.label && <span class="muted">{ph.label}</span>}
            </button>
          ))}
        </Sheet>
      )}
      {phoneMenu && (
        <Sheet title="Open phone number" onClose={() => setPhoneMenu(undefined)}>
          <p class="muted" style="margin-top:0">{phoneMenu}</p>
          <div class="btn-row">
            <button type="button" class="btn" onClick={() => { const n = phoneMenu; setPhoneMenu(undefined); call(p, { number: n, type: phoneType(n) }); }}>Call</button>
            <button type="button" class="btn" onClick={() => { const n = phoneMenu; setPhoneMenu(undefined); whatsapp(p, { number: n, type: phoneType(n) }); }}>WhatsApp</button>
          </div>
          <button type="button" class="btn quiet full" style="margin-top:8px" onClick={() => setPhoneMenu(undefined)}>Cancel</button>
        </Sheet>
      )}
    </>
  );
}
