/* Add or edit a person. Short by default: a name, or any one of profile text / resume / photo, is
   enough. Unsaved changes are kept as a draft if the app closes. Same phone or name as someone
   already here is shown before saving — never merged or duplicated silently. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { db } from '../../db/db';
import { addActivity, blankPerson, keysFor, saveFile, savePerson } from '../../db/repo';
import type { CameFrom, ID, InboxItem, Person, Role } from '../../db/types';
import { useLive } from '../../hooks';
import { ageFromText, currentAge } from '../../lib/age';
import { isAudio, isImage, isPdfType, isVcard, prepareImage } from '../../lib/images';
import { phoneType } from '../../lib/phone';
import { norm } from '../../lib/search';
import { emailsInText, phonesInText, readVcards } from '../../inbox/inbox';
import { back, go, reportError, route, showToast } from '../../state';
import { CAME_FROM_LABEL, HELPER_TYPES, HOW_WELL_LABEL, OK_TO_SHARE_LABEL, PICKABLE_ROLES, ROLE_LABEL } from '../../text';
import { Loading, TopBar, YesNo } from '../parts/common';
import { FileList } from '../parts/Files';
import { displayName } from '../describe';

interface DraftValue { person: Person; ageInput: string; from?: string; pendingAudio: ID[] }

async function fromInbox(item: InboxItem, p: Person): Promise<{ ageInput: string; pendingAudio: ID[] }> {
  const text = [item.title, item.text].filter(Boolean).join('\n').trim();
  const pendingAudio: ID[] = [];
  if (text) {
    if (p.roles.includes('single')) p.profile.text = text;
    else p.notes = text;
  }
  const numbers = phonesInText(text);
  const emails = emailsInText(text);
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
  for (const n of numbers) if (!p.phones.some((x) => keysFor({ phones: [x] })[0] === keysFor({ phones: [{ number: n, type: '' }] })[0])) p.phones.push({ number: n, type: phoneType(n) });
  p.emails = [...new Set([...p.emails, ...emails])];
  const age = ageFromText(text);
  return { ageInput: age ? String(age) : '', pendingAudio };
}

export function PersonEdit({ id }: { id?: ID }) {
  const q = route.value.query;
  const from = id ? undefined : q.get('from') ?? undefined;
  const draftKey = id ? 'person:' + id : from ? 'person:new:inbox:' + from : 'person:new';

  const [form, setForm] = useState<Person>();
  const [original, setOriginal] = useState<Person>();
  const [ageInput, setAgeInput] = useState('');
  const [pendingAudio, setPendingAudio] = useState<ID[]>([]);
  const [restored, setRestored] = useState(false);
  const [problem, setProblem] = useState('');
  const [dups, setDups] = useState<Person[]>();
  const [newTag, setNewTag] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const initialJson = useRef('');
  const startAge = useRef<string>('');

  const allPeople = useLive(() => db.people.toArray(), []);
  const knownTags = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of allPeople ?? []) if (!p.deletedAt) for (const t of p.tags) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 40);
  }, [allPeople]);

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
      /* Compare against what's stored, so an age filled in from the Inbox counts as a change. */
      const stored = base.age || base.dob ? currentAge(base.age, base.dob) : undefined;
      startAge.current = stored === undefined ? '' : String(stored);
      initialJson.current = JSON.stringify({ base, age });
      const d = await db.drafts.get(draftKey);
      const dv = d?.value as DraftValue | undefined;
      if (d && dv?.person && (!id || d.savedAt > base.updatedAt)) {
        base = dv.person;
        age = dv.ageInput;
        audio = dv.pendingAudio ?? audio;
        setRestored(true);
      }
      setForm(base);
      setAgeInput(age);
      setPendingAudio(audio);
    })().catch((e) => setProblem(String(e)));
  }, [id, from, reloadKey]);

  /* draft autosave */
  useEffect(() => {
    if (!form) return;
    const now = JSON.stringify({ base: form, age: ageInput });
    if (now === initialJson.current) return;
    const t = setTimeout(() => {
      const value: DraftValue = { person: form, ageInput, pendingAudio, ...(from ? { from } : {}) };
      db.drafts.put({ key: draftKey, value, savedAt: Date.now() }).catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [form, ageInput]);

  if (problem) return <><TopBar title="Edit" backTo="/people" /><main><p class="notice bad">{problem}</p></main></>;
  if (!form) return <><TopBar title="" backTo="/people" /><main><Loading /></main></>;

  const set = (patch: Partial<Person>) => setForm({ ...form, ...patch });
  const isSingle = form.roles.includes('single');
  const isHelper = form.roles.includes('helper');

  const toggleRole = (r: Role) => set({ roles: form.roles.includes(r) ? form.roles.filter((x) => x !== r) : [...form.roles, r] });
  const toggleTag = (t: string) => set({ tags: form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t] });
  const addTags = () => {
    const add = newTag.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
    if (add.length) set({ tags: [...new Set([...form.tags, ...add])] });
    setNewTag('');
  };

  const addFiles = async (files: FileList | null, kind: 'resume' | 'photo') => {
    if (!files?.length) return;
    try {
      const ids: ID[] = [];
      for (const f of [...files]) {
        if (isImage(f.type)) {
          const { blob, thumb } = await prepareImage(f);
          ids.push(await saveFile(blob, f.name, thumb ? { thumb } : {}));
        } else ids.push(await saveFile(f, f.name));
      }
      if (kind === 'resume') set({ resumeFileIds: [...form.resumeFileIds, ...ids] });
      else set({ photoFileIds: [...form.photoFileIds, ...ids] });
    } catch (e) {
      reportError('The file was not added.', e);
    }
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
    p.city = p.city.trim();
    p.phones = p.phones.filter((ph) => ph.number.trim()).map((ph) => ({ ...ph, number: ph.number.trim(), type: phoneType(ph.number) || ph.type }));
    p.emails = p.emails.map((e) => e.trim()).filter(Boolean);
    if (!p.name && !p.profile.text.trim() && !p.resumeFileIds.length && !p.photoFileIds.length && !p.phones.length) {
      setDups(undefined);
      showToast('Add a name — or a profile, resume, photo or phone number.');
      return;
    }
    if (ageInput.trim() !== startAge.current) {
      const n = Number(ageInput);
      if (!ageInput.trim()) delete p.age;
      else if (n >= 16 && n <= 120) p.age = { value: Math.floor(n), asOf: Date.now() };
      else { showToast('The age doesn’t look right.'); return; }
    }
    if (!p.roles.includes('single')) delete p.kohen;
    if (!skipDupCheck) {
      const keys = new Set(keysFor(p));
      const name = norm(p.name);
      const same = (allPeople ?? []).filter((x) => x.id !== p.id && !x.deletedAt && ((x.phoneKeys.some((k) => keys.has(k)) && !(original?.phoneKeys ?? []).some((k) => x.phoneKeys.includes(k))) || (!!name && !id && norm(x.name) === name)));
      if (same.length) { setDups(same); window.scrollTo(0, 0); return; }
    }
    try {
      await savePerson(p);
      await db.drafts.delete(draftKey);
      for (const fid of pendingAudio) await addActivity('audio', '', [p.id], { audioFileId: fid, title: 'Voice note (from Inbox)' });
      if (from) await db.inbox.update(from, { level: 'filed', filedAs: { kind: 'person', id: p.id, personId: p.id } });
      go('/person/' + p.id, { replace: true });
      if (original) showToast('Saved.', { label: 'Undo', run: async () => { await db.people.put(original); } });
      else showToast(`${displayName(p)} added.`);
    } catch (e) {
      reportError('Not saved. Your changes are still here — try again.', e);
    }
  };

  return (
    <>
      <TopBar title={id ? `Edit ${displayName(form)}` : 'Add a person'} backTo={id ? '/person/' + id : '/home'} />
      <main>
        {restored && (
          <p class="notice">Your unsaved changes were brought back. <button type="button" class="btn small quiet" onClick={discardDraft}>Discard them</button></p>
        )}
        {dups && (
          <div class="notice warn">
            <p style="margin-top:0"><b>Already here?</b> The same {dups.some((d) => d.phoneKeys.some((k) => keysFor(form).includes(k))) ? 'phone number' : 'name'}:</p>
            {dups.map((d) => (
              <p key={d.id}><a href={'#/person/' + d.id} onClick={(e) => { e.preventDefault(); go('/person/' + d.id); }}>{displayName(d)}</a> {d.city && `· ${d.city}`}</p>
            ))}
            <div class="btn-row">
              <button class="btn" type="button" onClick={() => setDups(undefined)}>Go back to the form</button>
              <button class="btn primary" type="button" onClick={() => save(true)}>Save as a separate person</button>
            </div>
          </div>
        )}

        <div class="field"><span class="section-title">Who is this?</span>
          <div class="checks">
            {PICKABLE_ROLES.map((r) => (
              <label key={r} class="check"><input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />{ROLE_LABEL[r]}</label>
            ))}
          </div>
        </div>
        {isSingle && (
          <div class="field" style="margin-bottom:14px">
            <div class="chips">
              <button type="button" class={`chip${form.gender === 'm' ? ' on' : ''}`} onClick={() => set({ gender: 'm' })}>Guy</button>
              <button type="button" class={`chip${form.gender === 'f' ? ' on' : ''}`} onClick={() => set({ gender: 'f' })}>Girl</button>
            </div>
          </div>
        )}
        {isHelper && (
          <label class="field"><span>What do they do?</span>
            <input type="text" list="helper-types" value={form.helperType ?? ''} onInput={(e) => set({ helperType: e.currentTarget.value })} />
            <datalist id="helper-types">{HELPER_TYPES.map((h) => <option key={h} value={h} />)}</datalist>
          </label>
        )}

        <label class="field"><span>Name</span>
          <input type="text" dir="auto" autocomplete="off" value={form.name} onInput={(e) => set({ name: e.currentTarget.value })} />
        </label>
        <div class="grid-2">
          <label class="field"><span>Age</span>
            <input type="number" inputMode="numeric" min={16} max={120} value={ageInput} onInput={(e) => setAgeInput(e.currentTarget.value)} />
          </label>
          <label class="field"><span>City</span>
            <input type="text" dir="auto" value={form.city} onInput={(e) => set({ city: e.currentTarget.value })} />
          </label>
        </div>

        <div class="field"><span class="section-title">Phone</span>
          {form.phones.map((ph, i) => (
            <div key={i} style="display:flex;gap:6px;margin-bottom:6px">
              <input type="tel" value={ph.number} aria-label="Phone number" onInput={(e) => { const phones = [...form.phones]; phones[i] = { ...ph, number: e.currentTarget.value }; set({ phones }); }} />
              <input type="text" value={ph.label ?? ''} placeholder="whose? e.g. mother" aria-label="Whose number" style="max-width:40%" onInput={(e) => { const phones = [...form.phones]; phones[i] = { ...ph, label: e.currentTarget.value }; set({ phones }); }} />
              <button type="button" class="btn small quiet" onClick={() => set({ phones: form.phones.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" class="btn small" onClick={() => set({ phones: [...form.phones, { number: '', type: '' }] })}>{form.phones.length ? 'Add another phone' : 'Add a phone'}</button>
        </div>
        <div class="field"><span class="section-title">Email</span>
          {form.emails.map((em, i) => (
            <div key={i} style="display:flex;gap:6px;margin-bottom:6px">
              <input type="email" value={em} onInput={(e) => { const emails = [...form.emails]; emails[i] = e.currentTarget.value; set({ emails }); }} />
              <button type="button" class="btn small quiet" onClick={() => set({ emails: form.emails.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" class="btn small" onClick={() => set({ emails: [...form.emails, ''] })}>{form.emails.length ? 'Add another email' : 'Add an email'}</button>
        </div>

        <label class="field"><span>{isSingle ? 'Profile' : 'About them'}</span>
          <textarea dir="auto" class="bidi" value={form.profile.text} onInput={(e) => set({ profile: { text: e.currentTarget.value, updatedAt: Date.now() } })} />
        </label>
        {isSingle && (
          <>
            <label class="field"><span>Looking for</span>
              <textarea dir="auto" class="bidi" style="min-height:90px" value={form.lookingFor.text} onInput={(e) => set({ lookingFor: { ...form.lookingFor, text: e.currentTarget.value } })} />
            </label>
            <div class="grid-2">
              <label class="field"><span>From age</span>
                <input type="number" inputMode="numeric" value={form.lookingFor.minAge ?? ''} onInput={(e) => { const v = Number(e.currentTarget.value); const lf = { ...form.lookingFor }; if (v) lf.minAge = v; else delete lf.minAge; set({ lookingFor: lf }); }} />
              </label>
              <label class="field"><span>To age</span>
                <input type="number" inputMode="numeric" value={form.lookingFor.maxAge ?? ''} onInput={(e) => { const v = Number(e.currentTarget.value); const lf = { ...form.lookingFor }; if (v) lf.maxAge = v; else delete lf.maxAge; set({ lookingFor: lf }); }} />
              </label>
            </div>
          </>
        )}

        <div class="field"><span class="section-title">Resume &amp; photos</span>
          {form.resumeFileIds.map((fid) => (
            <div key={fid} style="display:flex;gap:6px;align-items:center"><FileList ids={[fid]} /><button type="button" class="btn small quiet" onClick={() => set({ resumeFileIds: form.resumeFileIds.filter((x) => x !== fid) })}>Remove</button></div>
          ))}
          {form.photoFileIds.map((fid) => (
            <div key={fid} style="display:flex;gap:6px;align-items:center"><FileList ids={[fid]} /><button type="button" class="btn small quiet" onClick={() => set({ photoFileIds: form.photoFileIds.filter((x) => x !== fid) })}>Remove</button></div>
          ))}
          <div class="btn-row" style="margin-top:6px">
            <label class="btn small" style="cursor:pointer">Add a resume<input type="file" accept="application/pdf,image/*" hidden onChange={(e) => { void addFiles(e.currentTarget.files, 'resume'); e.currentTarget.value = ''; }} /></label>
            <label class="btn small" style="cursor:pointer">Add a photo<input type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.currentTarget.files, 'photo'); e.currentTarget.value = ''; }} /></label>
          </div>
        </div>

        <div class="field"><span class="section-title">Categories</span>
          {knownTags.length > 0 && (
            <div class="chips wrap">
              {[...new Set([...form.tags, ...knownTags])].map((t) => (
                <button key={t} type="button" class={`chip${form.tags.includes(t) ? ' on' : ''}`} aria-pressed={form.tags.includes(t)} onClick={() => toggleTag(t)}>{t}</button>
              ))}
            </div>
          )}
          {!knownTags.length && form.tags.length > 0 && <div class="chips wrap">{form.tags.map((t) => <button key={t} type="button" class="chip on" onClick={() => toggleTag(t)}>{t}</button>)}</div>}
          <div style="display:flex;gap:6px">
            <input type="text" dir="auto" placeholder="New category, e.g. Older singles" value={newTag} onInput={(e) => setNewTag(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTags(); } }} />
            <button type="button" class="btn small" onClick={addTags}>Add</button>
          </div>
        </div>

        <div class="field"><span class="section-title">Where they came from</span>
          <select value={form.cameFrom?.kind ?? ''} onChange={(e) => {
            const kind = e.currentTarget.value as CameFrom['kind'] | '';
            if (!kind) { const f = { ...form }; delete f.cameFrom; setForm(f); }
            else set({ cameFrom: { ...(form.cameFrom ?? {}), kind } });
          }}>
            <option value="">Not set</option>
            {(Object.keys(CAME_FROM_LABEL) as CameFrom['kind'][]).filter((k) => k !== 'import' || form.cameFrom?.kind === 'import').map((k) => <option key={k} value={k}>{CAME_FROM_LABEL[k]}</option>)}
          </select>
          {form.cameFrom && (
            <input type="text" dir="auto" style="margin-top:6px" placeholder="Who, or where (e.g. Mrs. Katz, ChabadMatch)" value={form.cameFrom.note ?? ''} onInput={(e) => set({ cameFrom: { ...form.cameFrom!, note: e.currentTarget.value } })} />
          )}
          {form.cameFrom?.personId && <p class="muted small">Linked to {displayName((allPeople ?? []).find((x) => x.id === form.cameFrom!.personId) ?? { name: 'someone' })}.</p>}
        </div>

        {isSingle && (
          <div class="field" style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px">
            <b>Kohen?</b>
            <YesNo value={form.kohen ?? null} allowUnset onChange={(v) => { const f = { ...form }; if (v === null) delete f.kohen; else f.kohen = v; setForm(f); }} />
          </div>
        )}

        <label class="field"><span>Private notes (never shared)</span>
          <textarea dir="auto" class="bidi" style="min-height:90px" value={form.notes} onInput={(e) => set({ notes: e.currentTarget.value })} />
        </label>

        <details class="section">
          <summary>More details</summary>
          <div class="body">
            <label class="field"><span>Date of birth</span>
              <input type="date" value={form.dob ?? ''} onInput={(e) => { const f = { ...form }; if (e.currentTarget.value) f.dob = e.currentTarget.value; else delete f.dob; setForm(f); }} />
            </label>
            <label class="field"><span>Other spellings of the name (comma between)</span>
              <input type="text" dir="auto" value={form.altNames.join(', ')} onInput={(e) => set({ altNames: e.currentTarget.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            </label>
            <label class="field"><span>Links (one per line)</span>
              <textarea style="min-height:70px" value={form.links.join('\n')} onInput={(e) => set({ links: e.currentTarget.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
            </label>
            <div class="field"><span class="section-title">How well do I know them?</span>
              <div class="chips wrap">
                {(Object.keys(HOW_WELL_LABEL) as (keyof typeof HOW_WELL_LABEL)[]).map((k) => (
                  <button key={k} type="button" class={`chip${form.howWellKnown === k ? ' on' : ''}`} onClick={() => { const f = { ...form }; if (f.howWellKnown === k) delete f.howWellKnown; else f.howWellKnown = k; setForm(f); }}>{HOW_WELL_LABEL[k]}</button>
                ))}
              </div>
            </div>
            {isSingle && (
              <div class="field"><span class="section-title">OK to share their profile?</span>
                <div class="chips wrap">
                  {(Object.keys(OK_TO_SHARE_LABEL) as (keyof typeof OK_TO_SHARE_LABEL)[]).map((k) => (
                    <button key={k} type="button" class={`chip${form.okToShare === k ? ' on' : ''}`} onClick={() => { const f = { ...form }; if (f.okToShare === k) delete f.okToShare; else f.okToShare = k; setForm(f); }}>{OK_TO_SHARE_LABEL[k]}</button>
                  ))}
                </div>
              </div>
            )}
            <div class="field" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <b>Only calls or SMS (kosher phone)?</b>
              <YesNo value={!!form.reach?.rules.includes('calls-or-sms-only')} onChange={(v) => {
                const rules = (form.reach?.rules ?? []).filter((r) => r !== 'calls-or-sms-only');
                if (v) rules.push('calls-or-sms-only');
                set({ reach: { ...(form.reach ?? {}), rules } });
              }} />
            </div>
          </div>
        </details>

        <div class="form-actions">
          <button class="btn quiet" type="button" onClick={cancel}>Cancel</button>
          <button class="btn primary" type="button" onClick={() => save()}>Save</button>
        </div>
      </main>
    </>
  );
}
