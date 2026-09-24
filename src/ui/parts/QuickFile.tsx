/* File a captured item on the same screen: what is it · name/age/phone (pre-filled, editable) ·
   who sent it (recent shadchanim first) · Save. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../../db/db';
import { blankPerson, savePerson } from '../../db/repo';
import type { Gender, InboxItem, Person } from '../../db/types';
import { fileItem, guessFromText, possibleSame, type FileKind } from '../../inbox/fileItem';
import { useLive } from '../../hooks';
import { norm, searchPeople } from '../../lib/search';
import { phoneKey, phoneType } from '../../lib/phone';
import { relativeDay } from '../../lib/format';
import { go, mode, reportError, showToast } from '../../state';
import { displayName } from '../describe';

export function QuickFile({ text, getItem, onKeep, allowEmpty, senderHint }: { text: string; getItem: () => Promise<InboxItem>; onKeep?: () => void; allowEmpty?: boolean; senderHint?: string }) {
  const [kind, setKind] = useState<FileKind>('idea');

  const [touched, setTouched] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('f');
  const [sender, setSender] = useState<Person>();
  const [find, setFind] = useState('');
  const [saving, setSaving] = useState(false);
  const [same, setSame] = useState<Person[]>([]);

  const all = useLive(() => db.people.toArray(), []);
  const live = useMemo(() => (all ?? []).filter((p) => !p.deletedAt && !p.roles.includes('me')), [all]);
  const guess = useMemo(() => guessFromText(text, all ?? []), [text, all]);
  const [senderTouched, setSenderTouched] = useState(false);

  /* Follow the text until the owner edits a field themselves. */
  useEffect(() => {
    if (touched) return;
    setName(guess.name);
    setAge(guess.age);
    setPhone(guess.phones[0] ?? '');
    setCity(guess.city);
  }, [guess, touched]);
  useEffect(() => {
    if (senderTouched) return;
    /* The WhatsApp chat's name (from the add-on): a saved name, or a phone number. */
    if (senderHint) {
      const hint = norm(senderHint);
      const key = phoneKey(senderHint);
      const match = live.find((p) => (key && p.phoneKeys.includes(key)) || norm(p.name) === hint || p.altNames.some((a) => norm(a) === hint));
      if (match) { setSender(match); return; }
      if (!all) return;
      setFind(senderHint);
      return;
    }
    if (guess.senderId) setSender(live.find((p) => p.id === guess.senderId));
  }, [guess, senderTouched, live, senderHint]);

  useEffect(() => {
    let live = true;
    possibleSame(name, phone ? [phone] : []).then((r) => { if (live) setSame(r); });
    return () => { live = false; };
  }, [name, phone]);

  const recent = useMemo(() => live.filter((p) => p.roles.includes('shadchan')).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6), [live]);
  const found = useMemo(() => (find.trim() ? searchPeople(live, find).people.slice(0, 8) : []), [live, find]);

  const edit = (fn: (v: string) => void) => (e: Event) => { setTouched(true); fn((e.currentTarget as HTMLInputElement).value); };

  const addNewSender = async () => {
    const typed = find.trim();
    const isPhone = !!phoneKey(typed) && /^[+\d\s()-]+$/.test(typed);
    const p = blankPerson({ roles: ['shadchan'], name: isPhone ? '' : typed, phones: isPhone ? [{ number: typed, type: phoneType(typed) }] : [] });
    await savePerson(p);
    setSenderTouched(true);
    setSender(p);
    setFind('');
  };

  const save = async () => {
    if (!text.trim() && !allowEmpty) return;
    setSaving(true);
    try {
      const item = await getItem();
      const p = await fileItem(item, { kind, name, age, city, gender, phones: phone ? [phone] : [], ...(sender ? { senderId: sender.id } : {}) });
      go('/home', { replace: true });
      showToast(kind === 'idea' ? `Saved: ${displayName(p)} — waiting for your answer.` : `Saved: ${displayName(p)}.`, { label: 'Open', run: () => go('/person/' + p.id) });
    } catch (e) {
      setSaving(false);
      reportError('Not saved. Everything is still here — try again.', e);
    }
  };

  /* The owner is single in both modes; in shadchan mode "for a friend" is a single to set up. */
  const kinds: [FileKind, string][] = [['idea', 'Idea for me'], ['friend', mode.value === 'me' ? 'For a friend' : 'A single'], ['shadchan', 'A shadchan']];
  const single = kind !== 'shadchan';

  return (
    <div>
      <div class="section-title" style="margin-top:12px">What is it?</div>
      <div class="chips wrap">
        {kinds.map(([k, l]) => <button key={k} type="button" class={`chip${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
        {onKeep && <button type="button" class="chip" onClick={onKeep}>Just keep it</button>}
      </div>

      {kind === 'friend' && (
        <div class="chips">
          <button type="button" class={`chip${gender === 'f' ? ' on' : ''}`} onClick={() => setGender('f')}>Girl</button>
          <button type="button" class={`chip${gender === 'm' ? ' on' : ''}`} onClick={() => setGender('m')}>Guy</button>
        </div>
      )}

      <label class="field"><span>Name</span>
        <input type="text" dir="auto" autocomplete="off" value={name} placeholder={single ? 'Her name' : 'Shadchan’s name'} onInput={edit(setName)} />
      </label>
      <div class="grid-2">
        {single && <label class="field"><span>Age</span><input type="number" inputMode="numeric" value={age} onInput={edit(setAge)} /></label>}
        <label class="field"><span>City</span><input type="text" dir="auto" value={city} onInput={edit(setCity)} /></label>
      </div>
      <label class="field"><span>Phone</span><input type="tel" value={phone} onInput={edit(setPhone)} /></label>

      {same.length > 0 && (
        <div class="notice warn">
          <b>Already here?</b>
          {same.map((p) => (
            <div key={p.id} style="margin-top:6px">
              <a href={'#/person/' + p.id} onClick={(e) => { e.preventDefault(); go('/person/' + p.id); }}>{displayName(p)}</a>
              <span class="small"> · added {relativeDay(p.createdAt).toLowerCase()}{p.suggestedToMe ? ' · suggested to you before' : ''}</span>
            </div>
          ))}
          <div class="small" style="margin-top:6px">Saving adds a separate person. To add this to the one above, keep it and use “Add to someone” in the Inbox.</div>
        </div>
      )}

      <div class="section-title" style="margin-top:4px">Who sent it?</div>
      {sender ? (
        <div class="chips wrap">
          <button type="button" class="chip on" aria-label={`${displayName(sender)} — change`} onClick={() => { setSenderTouched(true); setSender(undefined); }}>{displayName(sender)} <span aria-hidden="true">✕</span></button>
        </div>
      ) : (
        <>
          {recent.length > 0 && (
            <div class="chips wrap">
              {recent.map((p) => <button key={p.id} type="button" class="chip" onClick={() => { setSenderTouched(true); setSender(p); }}>{displayName(p)}</button>)}
            </div>
          )}
          <input type="search" placeholder="Search anyone, or type a new name" value={find} onInput={(e) => setFind(e.currentTarget.value)} />
          {found.map((p) => <button key={p.id} type="button" class="chip" style="margin:6px 6px 0 0" onClick={() => { setSenderTouched(true); setSender(p); setFind(''); }}>{displayName(p)}</button>)}
          {find.trim().length >= 2 && !found.some((p) => p.name.trim().toLowerCase() === find.trim().toLowerCase()) && (
            <button type="button" class="btn small" style="margin-top:6px" onClick={addNewSender}>Add “{find.trim()}” as a new shadchan</button>
          )}
        </>
      )}

      <div class="form-actions">
        <button class="btn primary" type="button" disabled={saving || (!text.trim() && !allowEmpty)} onClick={save}>
          {kind === 'idea' ? 'Save idea' : 'Save'}
        </button>
      </div>
    </div>
  );
}
