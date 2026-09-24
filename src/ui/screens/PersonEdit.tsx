/* Add / Edit a Guy, Girl or Shadchan — PeerMatch's form, with the owner's chosen changes:
   compact phone rows (name + number + Remove, "+ Add another phone"), email behind
   "+ Add email", Looking for with only "Up to age", Who sent it (search or new name),
   Suggested to me, How well do I know them. Attachment: Attach only / Attach + parse text.
   Unsaved changes are kept as a draft if the app closes. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { db } from '../../db/db';
import { addActivity, blankPerson, keysFor, saveFile, savePerson } from '../../db/repo';
import type { ID, InboxItem, Person, Role } from '../../db/types';
import { useFileUrl, useLive } from '../../hooks';
import { ageFromText, currentAge } from '../../lib/age';
import { isAudio, isImage, isPdfType, isVcard, prepareImage } from '../../lib/images';
import { displayPhone, phoneKey, phoneType } from '../../lib/phone';
import { readFileText } from '../../lib/readText';
import { norm, searchPeople } from '../../lib/search';
import { emailsInText, phonesInText, readVcards } from '../../inbox/inbox';
import { guessFromText } from '../../inbox/fileItem';
import { back, go, readClipboard, reportError, route, showToast } from '../../state';
import { HOW_WELL_LABEL } from '../../text';

const HOW_WELL_SHORT = { personal: 'Know personally', recommended: 'Recommended', card: 'Only details' } as const;
import { Loading, Sheet, TopBar, YesNo } from '../parts/common';
import { FileList } from '../parts/Files';
import { Recorder } from '../parts/Recorder';
import { displayName } from '../describe';

/* One phone line: whose it is (blank = the person's own) and the number. */
interface PhoneRow { name: string; number: string; personId?: ID }
interface DraftValue { person: Person; ageInput: string; rows: PhoneRow[]; pendingAudio: ID[] }

async function fromInbox(item: InboxItem, p: Person): Promise<{ ageInput: string; pendingAudio: ID[] }> {
  const text = [item.title, item.text].filter(Boolean).join('\n').trim();
  const pendingAudio: ID[] = [];
  if (text) p.profile.text = text;
  const emails = emailsInText(text);
  for (const n of phonesInText(text)) p.phones.push({ number: n, type: phoneType(n) });
  for (const fid of item.fileIds) {
    const f = await db.files.get(fid);
    if (!f) continue;
    if (isVcard(f.type, f.name)) {
      const card = readVcards(await f.blob.text())[0];
      if (card) {
        if (!p.name) p.name = card.name;
        for (const ph of card.phones) p.phones.push({ number: ph.number, type: phoneType(ph.number), ...(ph.waid ? { waid: ph.waid } : {}) });
        emails.push(...card.emails);
      }
    } else if (isPdfType(f.type, f.name)) p.resumeFileIds.push(fid);
    else if (isImage(f.type)) (p.roles.includes('single') ? p.photoFileIds : p.resumeFileIds).push(fid);
    else if (isAudio(f.type, f.name)) pendingAudio.push(fid);
    else p.resumeFileIds.push(fid);
  }
  const seen = new Set<string>();
  p.phones = p.phones.filter((ph) => { const k = phoneKey(ph.number) || ph.number; if (seen.has(k)) return false; seen.add(k); return true; });
  p.emails = [...new Set([...p.emails, ...emails])];
  const age = ageFromText(text);
  return { ageInput: age ? String(age) : '', pendingAudio };
}

function Photo({ id, onPick, onRemove }: { id: ID | undefined; onPick: (f: File) => void; onRemove: () => void }) {
  const { url } = useFileUrl(id, true);
  return (
    <label class="ftile">
      {url ? <img src={url} alt="" /> : <span>Photo</span>}
      <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) onPick(f); }} />
      {id && <button type="button" class="rm" onClick={(e) => { e.preventDefault(); onRemove(); }}>Remove</button>}
    </label>
  );
}

export function PersonEdit({ id }: { id?: ID }) {
  const q = route.value.query;
  const from = id ? undefined : q.get('from') ?? undefined;
  const draftKey = id ? 'person:' + id : from ? 'person:new:inbox:' + from : 'person:new:' + (q.get('role') ?? '') + (q.get('gender') ?? '');

  const [form, setForm] = useState<Person>();
  const [original, setOriginal] = useState<Person>();
  const [ageInput, setAgeInput] = useState('');
  const [rows, setRows] = useState<PhoneRow[]>([{ name: '', number: '' }]);
  const [pendingAudio, setPendingAudio] = useState<ID[]>([]);
  const [restored, setRestored] = useState(false);
  const [problem, setProblem] = useState('');
  const [dups, setDups] = useState<Person[]>();
  const [find, setFind] = useState('');
  const [parse, setParse] = useState('');
  const [recording, setRecording] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const initialJson = useRef('');
  const startAge = useRef('');

  const allPeople = useLive(() => db.people.toArray(), []);
  const live = useMemo(() => (allPeople ?? []).filter((p) => !p.deletedAt && !p.roles.includes('me')), [allPeople]);
  const byId = useMemo(() => new Map((allPeople ?? []).map((p) => [p.id, p])), [allPeople]);

  useEffect(() => {
    (async () => {
      let base: Person | undefined;
      let age = '';
      let audio: ID[] = [];
      if (id) {
        base = await db.people.get(id);
        if (!base) { setProblem('This person isn’t here any more.'); return; }
        setOriginal(structuredClone(base));
        const a = currentAge(base.age, base.dob);
        age = a === undefined ? '' : String(a);
      } else {
        const role = q.get('role') as Role | null;
        const gender = q.get('gender');
        base = blankPerson({ roles: role ? [role] : [], gender: gender === 'm' || gender === 'f' ? gender : '' });
        if (from) {
          const item = await db.inbox.get(from);
          if (item) ({ ageInput: age, pendingAudio: audio } = await fromInbox(item, base));
        }
      }
      /* Phone rows: the person's own numbers (no name), then each contact person's. */
      let r: PhoneRow[] = base.phones.map((ph) => ({ name: '', number: displayPhone(ph.number) }));
      for (const c of base.contactPeople) {
        const cp = await db.people.get(c.personId);
        if (!cp || cp.deletedAt) continue;
        const nums = cp.phones.filter((ph) => ph.number.trim());
        r.push({ name: cp.name, number: nums[0] ? displayPhone(nums[0].number) : '', personId: cp.id });
      }
      if (!r.length) r = [{ name: '', number: '' }];
      const stored = base.age || base.dob ? currentAge(base.age, base.dob) : undefined;
      startAge.current = stored === undefined ? '' : String(stored);
      initialJson.current = JSON.stringify({ base, age, r });
      const d = await db.drafts.get(draftKey);
      const dv = d?.value as DraftValue | undefined;
      if (d && dv?.person && (!id || d.savedAt > base.updatedAt)) {
        base = dv.person;
        age = dv.ageInput;
        r = dv.rows?.length ? dv.rows : r;
        audio = dv.pendingAudio ?? audio;
        setRestored(true);
      }
      setForm(base);
      setAgeInput(age);
      setRows(r);
      setPendingAudio(audio);
    })().catch((e) => setProblem(String(e)));
  }, [id, from, reloadKey]);

  /* draft autosave */
  useEffect(() => {
    if (!form) return;
    if (JSON.stringify({ base: form, age: ageInput, r: rows }) === initialJson.current) return;
    const t = setTimeout(() => {
      const value: DraftValue = { person: form, ageInput, rows, pendingAudio };
      db.drafts.put({ key: draftKey, value, savedAt: Date.now() }).catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [form, ageInput, rows]);

  if (problem) return <><TopBar title="Edit" backTo="/people" /><main><p class="notice bad">{problem}</p></main></>;
  if (!form) return <><TopBar title="" backTo="/people" /><main><Loading /></main></>;

  const set = (patch: Partial<Person>) => setForm({ ...form, ...patch });
  const single = form.roles.includes('single');
  const shadchan = form.roles.includes('shadchan');
  const kindWord = single ? (form.gender === 'f' ? 'Girl' : form.gender === 'm' ? 'Guy' : 'Single') : shadchan ? 'Shadchan' : 'Person';
  const sender = form.cameFrom?.personId ? byId.get(form.cameFrom.personId) : undefined;
  const recent = live.filter((p) => p.roles.includes('shadchan') && p.id !== form.id).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const found = find.trim() ? searchPeople(live.filter((p) => p.id !== form.id), find).people.slice(0, 8) : [];

  /* Fill only EMPTY fields from profile text (paste, or read from a PDF/picture). */
  const fillFrom = (text: string, base: Person = form): Person => {
    const g = guessFromText(text, live);
    const next = { ...base };
    if (!next.name.trim() && g.name) next.name = g.name;
    if (!next.city.trim() && g.city) next.city = g.city;
    if (!ageInput.trim() && g.age) setAgeInput(g.age);
    const nums = g.phones.filter((n) => !rows.some((r) => phoneKey(r.number) === phoneKey(n)));
    if (nums.length) {
      const filled = rows.filter((r) => r.number.trim() || r.name.trim());
      setRows([...filled, ...nums.map((n) => {
        const match = live.find((p) => p.roles.includes('shadchan') && p.phoneKeys.includes(phoneKey(n)) && p.id !== form.id);
        return { name: match ? match.name : '', number: displayPhone(n), ...(match ? { personId: match.id } : {}) };
      })]);
    }
    return next;
  };

  const pasteProfile = async () => {
    const t = await readClipboard();
    if (!t.trim()) { showToast('Chrome didn’t allow reading the clipboard. Tap inside Profile and choose Paste.'); return; }
    setForm(fillFrom(t, { ...form, profile: { text: t, updatedAt: Date.now() } }));
  };

  const setRow = (i: number, patch: Partial<PhoneRow>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    /* A number that belongs to someone already here fills in their name. */
    if (patch.number !== undefined && !next[i]!.name.trim()) {
      const match = live.find((p) => p.id !== form.id && p.roles.includes('shadchan') && p.phoneKeys.includes(phoneKey(patch.number!)));
      if (match) next[i] = { ...next[i]!, name: match.name, personId: match.id };
    }
    if (patch.name !== undefined && next[i]!.personId && norm(byId.get(next[i]!.personId!)?.name ?? '') !== norm(patch.name)) {
      const r = { ...next[i]! };
      delete r.personId;
      next[i] = r;
    }
    setRows(next);
  };

  const addPhoto = async (f: File) => {
    try {
      const { blob, thumb } = await prepareImage(f);
      const fid = await saveFile(blob, f.name, thumb ? { thumb } : {});
      set({ photoFileIds: [fid, ...form.photoFileIds.slice(1)] });
    } catch (e) { reportError('The photo was not added.', e); }
  };

  const attach = async (file: File, andParse: boolean) => {
    try {
      let blob: Blob = file;
      let extra = {};
      if (isImage(file.type)) { const r = await prepareImage(file); blob = r.blob; if (r.thumb) extra = { thumb: r.thumb }; }
      const fid = await saveFile(blob, file.name, extra);
      let next: Person = { ...form, resumeFileIds: [...form.resumeFileIds, fid] };
      setForm(next);
      if (!andParse) { setParse(`Attached ${file.name}.`); return; }
      setParse('Reading the text… (a scanned file can take a minute)');
      let text = '';
      try { text = await readFileText(file, file.name); } catch (e) {
        setParse(`Attached. The text couldn’t be read here (${e instanceof Error ? e.message : 'error'}) — the file is kept.`);
        return;
      }
      if (!text.trim()) { setParse('Attached. No text was found in it.'); return; }
      const had = next.profile.text.trim();
      next = { ...next, profile: { text: had ? had + '\n\n' + text : text, updatedAt: Date.now() } };
      setForm(fillFrom(text, next));
      setParse(had ? 'Attached. The text was added below what you had.' : 'Attached, and the text was filled in. Check it before saving.');
    } catch (e) {
      reportError('The file was not attached.', e);
    }
  };

  const chooseSender = (p: Person) => { set({ cameFrom: { kind: form.cameFrom?.kind ?? 'referred', personId: p.id } }); setFind(''); };
  const newSender = async () => {
    const typed = find.trim();
    const isPhone = !!phoneKey(typed) && /^[+\d\s()-]+$/.test(typed);
    const p = blankPerson({ roles: ['shadchan'], name: isPhone ? '' : typed, phones: isPhone ? [{ number: typed, type: phoneType(typed) }] : [] });
    await savePerson(p);
    chooseSender(p);
  };

  const discardDraft = async () => {
    await db.drafts.delete(draftKey);
    setRestored(false);
    setForm(undefined);
    setReloadKey((k) => k + 1);
  };
  const cancel = async () => {
    await db.drafts.delete(draftKey);
    back(id ? '/person/' + id : '/home');
  };

  const save = async (skipDupCheck = false) => {
    const p: Person = structuredClone(form);
    p.name = p.name.trim();
    const own = rows.filter((r) => r.number.trim() && (!r.name.trim() || norm(r.name) === norm(p.name)));
    const others = rows.filter((r) => r.name.trim() && norm(r.name) !== norm(p.name));
    const kept = new Map(p.phones.map((ph) => [phoneKey(ph.number) || ph.number, ph]));
    p.phones = own.map((r) => kept.get(phoneKey(r.number) || r.number) ?? { number: r.number.trim(), type: phoneType(r.number) });
    p.emails = p.emails.map((e) => e.trim()).filter(Boolean);
    p.tags = [...new Set(p.tags.map((t) => t.trim()).filter(Boolean))];
    if (!p.name && !p.profile.text.trim() && !p.resumeFileIds.length && !p.photoFileIds.length && !p.phones.length && !p.audioProfile) {
      showToast('Add a name — or a profile, attachment, photo, audio or phone number.');
      return;
    }
    if (ageInput.trim() !== startAge.current) {
      const n = Number(ageInput);
      if (!ageInput.trim()) delete p.age;
      else if (n >= 16 && n <= 120) p.age = { value: Math.floor(n), asOf: Date.now() };
      else { showToast('The age doesn’t look right.'); return; }
    }
    const max = p.lookingFor.maxAge;
    if (max !== undefined && (max < 18 || max > 99)) { showToast('Check "Up to age": use an age from 18 to 99.'); return; }
    if (!p.name && p.profile.text.trim()) p.name = p.profile.text.trim().split(/\n/)[0]!.replace(/[*_~]/g, '').slice(0, 70);
    if (!skipDupCheck) {
      const keys = new Set(keysFor(p));
      const name = norm(p.name);
      const same = live.filter((x) => x.id !== p.id && ((x.phoneKeys.some((k) => keys.has(k)) && !(original?.phoneKeys ?? []).some((k) => x.phoneKeys.includes(k))) || (!!name && !id && norm(x.name) === name)));
      if (same.length) { setDups(same); window.scrollTo(0, 0); return; }
    }
    try {
      /* Contact people: an existing person (by id, then by phone), or a new contact person. */
      const links: ID[] = [];
      for (const r of others) {
        let cid = r.personId;
        const key = phoneKey(r.number);
        if (!cid && key) cid = live.find((x) => x.id !== p.id && x.phoneKeys.includes(key))?.id;
        if (cid) {
          const c = await db.people.get(cid);
          if (c) {
            let changed = false;
            if (r.name.trim() && c.name !== r.name.trim()) { c.name = r.name.trim(); changed = true; }
            if (key && !c.phoneKeys.includes(key)) { c.phones = [{ number: r.number.trim(), type: phoneType(r.number) }, ...c.phones]; changed = true; }
            if (changed) await savePerson(c);
          }
        } else {
          const c = blankPerson({ roles: ['contact'], name: r.name.trim(), phones: r.number.trim() ? [{ number: r.number.trim(), type: phoneType(r.number) }] : [] });
          await savePerson(c);
          cid = c.id;
        }
        if (cid && !links.includes(cid)) links.push(cid);
      }
      p.contactPeople = links.map((cid) => p.contactPeople.find((c) => c.personId === cid) ?? { personId: cid, relation: 'Contact' });
      /* A contact person who is a shadchan is who sent it (PeerMatch linked them by phone). */
      if (!p.cameFrom?.personId && single) {
        const shad = links.map((cid) => byId.get(cid)).find((x) => x?.roles.includes('shadchan'));
        if (shad) p.cameFrom = { kind: 'referred', personId: shad.id };
      }
      await savePerson(p);
      await db.drafts.delete(draftKey);
      for (const fid of pendingAudio) await addActivity('audio', '', [p.id], { audioFileId: fid, title: 'Voice note (from the Intake folder)' });
      if (from) await db.inbox.update(from, { level: 'filed', filedAs: { kind: 'person', id: p.id, personId: p.id } });
      go('/person/' + p.id, { replace: true });
      if (original) showToast('Saved.', { label: 'Undo', run: async () => { await db.people.put(original); } });
      else showToast(`${displayName(p)} added.`);
    } catch (e) {
      reportError('Not saved. Your changes are still here — try again.', e);
    }
  };

  const whoSent = (label: string) => (
    <div class="field">
      <span class="lbl">{label}</span>
      {sender ? (
        <div class="chips wrap">
          <button type="button" class="chip on" aria-label={`${displayName(sender)} — change`} onClick={() => { const f = { ...form }; delete f.cameFrom; setForm(f); }}>{displayName(sender)} <span aria-hidden="true">✕</span></button>
        </div>
      ) : (
        <>
          {form.cameFrom?.note && <p class="muted small" style="margin:0 0 6px">Written as: {form.cameFrom.note}</p>}
          {recent.length > 0 && <div class="chips wrap">{recent.map((p) => <button key={p.id} type="button" class="chip" onClick={() => chooseSender(p)}>{displayName(p)}</button>)}</div>}
          <input type="search" placeholder="Search anyone, or type a new name" value={find} onInput={(e) => setFind(e.currentTarget.value)} />
          {found.map((p) => <button key={p.id} type="button" class="chip" style="margin:6px 6px 0 0" onClick={() => chooseSender(p)}>{displayName(p)}</button>)}
          {find.trim().length >= 2 && !found.some((p) => norm(p.name) === norm(find)) && (
            <button type="button" class="btn small" style="margin-top:6px" onClick={newSender}>Add “{find.trim()}” as a new shadchan</button>
          )}
        </>
      )}
    </div>
  );

  const attachmentBox = (
    <div class="fcard">
      <div class="fcard-h">PDF / screenshot</div>
      {form.resumeFileIds.map((fid) => (
        <div key={fid} class="afile"><FileList ids={[fid]} /><button type="button" class="rmlink" onClick={() => set({ resumeFileIds: form.resumeFileIds.filter((x) => x !== fid) })}>Remove</button></div>
      ))}
      <div class="attach2">
        <label class="gray">Attach only<input type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) void attach(f, false); }} /></label>
        <label>Attach + parse text<input type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) void attach(f, true); }} /></label>
      </div>
      <div class="astatus">{parse || (form.resumeFileIds.length ? 'Attached' : 'No PDF or screenshot attached')}</div>
    </div>
  );

  const flag = (k: string) => form.facts[k];
  const setFactText = (k: string, v: string) => { const facts = { ...form.facts }; if (v.trim()) facts[k] = v; else delete facts[k]; set({ facts }); };

  return (
    <>
      <header class="fhead">
        <h1>{id ? 'Edit' : 'Add'} {kindWord}</h1>
        {single && (
          <div class="ftools">
            <Photo id={form.photoFileIds[0]} onPick={addPhoto} onRemove={() => set({ photoFileIds: form.photoFileIds.slice(1) })} />
            {form.audioProfile
              ? <button type="button" class="ftool" onClick={() => { const f = { ...form }; delete f.audioProfile; setForm(f); }}>Remove audio</button>
              : <button type="button" class="ftool" onClick={() => setRecording(true)}>Audio profile</button>}
          </div>
        )}
      </header>
      <main>
        {restored && (
          <p class="notice">Your unsaved changes were brought back. <button type="button" class="btn small quiet" onClick={discardDraft}>Discard them</button></p>
        )}
        {dups && (
          <div class="notice warn">
            <p style="margin-top:0"><b>Already here?</b> The same {dups.some((d) => d.phoneKeys.some((k) => keysFor(form).includes(k))) ? 'phone number' : 'name'}:</p>
            {dups.map((d) => (
              <p key={d.id}><a href={'#/person/' + d.id} onClick={(e) => { e.preventDefault(); go('/person/' + d.id); }}>{displayName(d)}</a></p>
            ))}
            <div class="btn-row">
              <button class="btn" type="button" onClick={() => setDups(undefined)}>Go back to the form</button>
              <button class="btn primary" type="button" onClick={() => save(true)}>Save as a separate person</button>
            </div>
          </div>
        )}

        {form.audioProfile && <div class="fcard"><span class="lbl">Audio profile</span><FileList ids={[form.audioProfile.fileId]} /></div>}

        <div class={single ? 'grid-name' : ''}>
          <label class="field"><span>Name</span>
            <input type="text" dir="auto" autocomplete="off" value={form.name} onInput={(e) => set({ name: e.currentTarget.value })} />
          </label>
          {single && (
            <label class="field"><span>Age</span>
              <input type="number" inputMode="numeric" min={16} max={120} value={ageInput} onInput={(e) => setAgeInput(e.currentTarget.value)} />
            </label>
          )}
        </div>

        {single && (
          <>
            <div class="field">
              <div class="lblrow"><span class="lbl" style="margin:0">Profile</span><button type="button" class="paste" onClick={pasteProfile}>Paste profile</button></div>
              <textarea dir="auto" class="bidi" aria-label="Profile" value={form.profile.text} onInput={(e) => set({ profile: { text: e.currentTarget.value, updatedAt: Date.now() } })}
                onPaste={(e) => { const t = e.clipboardData?.getData('text') ?? ''; if (t) setTimeout(() => setForm((cur) => (cur ? fillFrom(t, cur) : cur)), 0); }} />
            </div>
            <div class="grid-look">
              <label class="field"><span>Looking for</span>
                <textarea dir="auto" class="bidi short" placeholder="What are they looking for?" value={form.lookingFor.text} onInput={(e) => set({ lookingFor: { ...form.lookingFor, text: e.currentTarget.value } })} />
              </label>
              <label class="field"><span>Up to age</span>
                <input type="number" inputMode="numeric" min={18} max={99} placeholder="Age" value={form.lookingFor.maxAge ?? ''} onInput={(e) => { const v = Number(e.currentTarget.value); const lf = { ...form.lookingFor }; delete lf.minAge; if (v) lf.maxAge = v; else delete lf.maxAge; set({ lookingFor: lf }); }} />
              </label>
            </div>
          </>
        )}

        <div class="fcard"><div class="fcard-h">{single ? 'Contacts' : 'Phone'}</div>
          {rows.map((r, i) => (
            <div key={i} class="prow">
              <input type="text" dir="auto" aria-label="Whose number" placeholder="Whose?" value={r.name} onInput={(e) => setRow(i, { name: e.currentTarget.value })} />
              <input type="tel" aria-label="Phone number" placeholder="Phone" value={r.number} onInput={(e) => setRow(i, { number: e.currentTarget.value })} onBlur={(e) => { const d = displayPhone(e.currentTarget.value); if (d !== r.number) setRow(i, { number: d }); }} />
              <button type="button" class="rmlink" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ name: '', number: '' }])}>Remove</button>
              {phoneType(r.number) === 'landline' && <span class="hint">Landline — SMS unavailable</span>}
              {r.personId && byId.get(r.personId)?.roles.includes('shadchan') && <span class="hint">Matches Shadchan: {byId.get(r.personId)!.name}</span>}
            </div>
          ))}
          <button type="button" class="addlink" onClick={() => setRows([...rows, { name: '', number: '' }])}>Add another phone</button>
          {form.emails.map((em, i) => (
            <div key={i} class="prow" style="grid-template-columns:1fr auto">
              <input type="email" placeholder="Email" aria-label="Email" value={em} onInput={(e) => { const emails = [...form.emails]; emails[i] = e.currentTarget.value; set({ emails }); }} />
              <button type="button" class="rmlink" onClick={() => set({ emails: form.emails.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" class="addlink" onClick={() => set({ emails: [...form.emails, ''] })}>Add {form.emails.length ? 'another ' : ''}email</button>
        </div>

        {single && whoSent('Who sent it?')}

        {single && attachmentBox}

        {!single && (
          <>
            <label class="field"><span>Profile / notes</span>
              <textarea dir="auto" class="bidi" placeholder="Paste shadchan information here, or attach a PDF/screenshot below" value={form.profile.text} onInput={(e) => set({ profile: { text: e.currentTarget.value, updatedAt: Date.now() } })} />
            </label>
            {attachmentBox}
          </>
        )}

        <label class="field"><span>Tags</span>
          <input type="text" dir="auto" placeholder="e.g. Chabad, Israel" value={form.tags.join(', ')} onInput={(e) => set({ tags: e.currentTarget.value.split(/[,;]+/).map((t) => t.trimStart()).filter((t, i, a) => t || i === a.length - 1) })} />
        </label>
        <label class="field"><span>Religious level</span>
          <input type="text" dir="auto" placeholder="e.g. strong, moderate, light" value={String(flag('religiousLevel') ?? '')} onInput={(e) => setFactText('religiousLevel', e.currentTarget.value)} />
        </label>
        <label class="field"><span>Religious details</span>
          <input type="text" dir="auto" placeholder="e.g. Chabad, Breslev, Yeshivish, tzniut" value={String(flag('religiousDetails') ?? '')} onInput={(e) => setFactText('religiousDetails', e.currentTarget.value)} />
        </label>
        {!single && whoSent('Referred by')}


        {single && (
          <div class="yn-row plain">
            <span class="lbl" style="margin:0">Suggested to me?</span>
            <YesNo value={form.suggestedToMe ?? null} allowUnset onChange={(v) => { const f = { ...form }; if (v === null) delete f.suggestedToMe; else f.suggestedToMe = v; setForm(f); }} />
          </div>
        )}
        <div class="field"><span class="lbl">How well do I know them?</span>
          <div class="tiny3">
            {(Object.keys(HOW_WELL_SHORT) as (keyof typeof HOW_WELL_SHORT)[]).map((k) => (
              <button key={k} type="button" class={form.howWellKnown === k ? 'on' : ''} aria-pressed={form.howWellKnown === k} title={HOW_WELL_LABEL[k]} onClick={() => { const f = { ...form }; if (f.howWellKnown === k) delete f.howWellKnown; else f.howWellKnown = k; setForm(f); }}>{HOW_WELL_SHORT[k]}</button>
            ))}
          </div>
        </div>

        <div class="savebar">
          <button class="primary" type="button" onClick={() => save()}>{id ? 'Save Changes' : `Save ${kindWord}`}</button>
          <button type="button" onClick={cancel}>Cancel</button>
        </div>
      </main>

      {recording && (
        <Sheet title="Audio profile" onClose={() => setRecording(false)}>
          <Recorder onCancel={() => setRecording(false)} onSave={async (blob) => {
            const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
            const fid = await saveFile(blob, `Audio profile.${ext}`);
            set({ audioProfile: { fileId: fid } });
            setRecording(false);
          }} />
        </Sheet>
      )}
    </>
  );
}
