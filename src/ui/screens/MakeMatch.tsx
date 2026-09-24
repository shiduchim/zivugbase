/* Make match — PeerMatch's screen (docs/REBUILD_INVENTORY.md §6): tick one guy and one girl
   (and at most one shadchan) in the lists, tap "Make match". Suggested match card, Send to,
   the message, languages to include, photos, then Contact · SMS · WhatsApp · Email.
   One History entry is written and shows on the guy, the girl and the shadchan. */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { db } from '../../db/db';
import { addActivity, getFile } from '../../db/repo';
import type { ID, Person, Phone } from '../../db/types';
import { useLive } from '../../hooks';
import { ageLabel } from '../../lib/age';
import { dialNumber, displayPhone, whatsappNumber } from '../../lib/phone';
import { back, go, mode, selection, showToast } from '../../state';
import { TopBar } from '../parts/common';
import { isAndroid } from '../contact';
import { displayName } from '../describe';

/* The header button, shadchan mode only (as in PeerMatch). */
export function MatchButton() {
  if (mode.value === 'me') return null;
  return <button type="button" class="hbtn" onClick={() => go('/match')}>Make match</button>;
}

interface Target { key: string; label: string; person: Person; phone?: Phone; email?: string }

const clean = (s: string) => s.replace(/\*/g, '').trim();
const script = (line: string): 'he' | 'ru' | 'en' | '' => (/[֐-׿]/.test(line) ? 'he' : /[Ѐ-ӿ]/.test(line) ? 'ru' : /[a-z]/i.test(line) ? 'en' : '');

/* Keep only lines written in the ticked languages (lines with no letters always stay). */
function byLanguage(text: string, langs: Set<string>): string {
  return text.split('\n').filter((l) => { const s = script(l); return !s || langs.has(s); }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function MakeMatch() {
  const all = useLive(() => db.people.toArray(), []);
  const people = useMemo(() => new Map((all ?? []).filter((p) => !p.deletedAt).map((p) => [p.id, p])), [all]);
  const ticked = [...new Set(Object.values(selection.value).flat())].map((id) => people.get(id)).filter((p): p is Person => !!p);
  const guys = ticked.filter((p) => p.roles.includes('single') && p.gender === 'm');
  const girls = ticked.filter((p) => p.roles.includes('single') && p.gender === 'f');
  const shads = ticked.filter((p) => p.roles.includes('shadchan') && !p.roles.includes('single'));
  const guy = guys.length === 1 ? guys[0] : undefined;
  const girl = girls.length === 1 ? girls[0] : undefined;
  const shad = shads.length === 1 ? shads[0] : undefined;

  const contactOf = (p: Person): Person => {
    if (p.phones.some((ph) => ph.number.trim())) return p;
    for (const c of p.contactPeople) { const x = people.get(c.personId); if (x?.phones.some((ph) => ph.number.trim())) return x; }
    return p;
  };
  const targets: Target[] = [];
  const addTarget = (key: string, label: string, person: Person | undefined) => {
    if (!person) return;
    const phone = person.phones.find((ph) => ph.number.trim());
    const email = person.emails[0];
    targets.push({ key, label: `${label}${phone ? ' • ' + displayPhone(phone.number) : ''}`, person, ...(phone ? { phone } : {}), ...(email ? { email } : {}) });
  };
  if (shad) addTarget('shad', `Shadchan: ${displayName(shad)}`, shad);
  if (girl) addTarget('girl', girl && contactOf(girl).id !== girl.id ? `Girl contact person (${displayName(contactOf(girl))})` : 'Girl', girl && contactOf(girl));
  if (guy) addTarget('guy', guy && contactOf(guy).id !== guy.id ? `Guy contact person (${displayName(contactOf(guy))})` : 'Guy', guy && contactOf(guy));

  const [to, setTo] = useState('');
  const [langs, setLangs] = useState<Set<string>>(new Set(['en', 'he', 'ru']));
  const [photos, setPhotos] = useState(false);
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const target = targets.find((t) => t.key === to) ?? targets[0];

  const present = new Set<string>([guy, girl].flatMap((p) => (p ? p.profile.text.split('\n').map(script) : [])).filter(Boolean));
  const block = (word: string, p: Person) => {
    const c = contactOf(p);
    const age = ageLabel(p.age, p.dob);
    return [
      '--------------------',
      `${word} — ${clean(displayName(p))}${age ? ` (age ${age})` : ''}`,
      byLanguage(clean(p.profile.text), langs),
      c.id !== p.id || c.phones[0] ? '\nCONTACT' : '',
      c.id !== p.id ? clean(displayName(c)) : '',
      c.phones[0] ? displayPhone(c.phones[0].number) : ''
    ].filter((x) => x !== '').join('\n');
  };
  const template = guy && girl ? [
    'Shidduch suggestion',
    `Guy: ${clean(displayName(guy))}`,
    `Girl: ${clean(displayName(girl))}`,
    '',
    `Hi${target ? ' ' + clean(target.key === 'shad' ? displayName(target.person) : target.key === 'girl' ? 'Girl contact person' : 'Guy contact person') : ''},`,
    '',
    block('GUY', guy),
    block('GIRL', girl),
    '--------------------'
  ].join('\n') : '';
  useEffect(() => { if (!edited) setMessage(template); }, [template]);

  if (!all) return null;
  if (!guy || !girl || shads.length > 1) {
    return (
      <>
        <TopBar title="Make match" backTo="/people" />
        <main>
          <p class="notice warn">Tick <b>one guy</b> and <b>one girl</b> in the Guys and Girls lists{shads.length > 1 ? ', and at most one shadchan' : ' (and, if you like, one shadchan)'}, then tap Make match again.</p>
          <p class="muted small">Ticked now: {guys.length} {guys.length === 1 ? 'guy' : 'guys'}, {girls.length} {girls.length === 1 ? 'girl' : 'girls'}, {shads.length} {shads.length === 1 ? 'shadchan' : 'shadchanim'}.</p>
        </main>
      </>
    );
  }

  const needText = () => {
    if (!guy.profile.text.trim() || !girl.profile.text.trim()) { showToast('Both profiles need profile text before sending.'); return true; }
    return false;
  };
  const record = async (channel: string, title: string) => {
    const links: ID[] = [guy.id, girl.id, ...(shad ? [shad.id] : []), ...(target && ![guy.id, girl.id, shad?.id].includes(target.person.id) ? [target.person.id] : [])];
    await addActivity(channel === 'phone' ? 'call' : 'message-out', channel === 'phone' ? '' : message, links, { title, channel, meta: { match: { guyId: guy.id, girlId: girl.id, ...(shad ? { shadchanId: shad.id } : {}) } } });
  };
  const photoFiles = async (): Promise<File[]> => {
    const out: File[] = [];
    for (const p of [guy, girl]) {
      const fid = p.photoFileIds[0];
      if (!fid) continue;
      const f = await getFile(fid);
      if (f) out.push(new File([f.blob], `${clean(displayName(p))}.${f.type.includes('png') ? 'png' : 'jpg'}`, { type: f.type }));
    }
    return out;
  };

  const contact = async () => {
    if (!target?.phone) { showToast('No phone number for this person.'); return; }
    await record('phone', `Match contact • ${target.label.split(' • ')[0]}`);
    location.href = 'tel:' + dialNumber(target.phone.number);
  };
  const sendSms = async () => {
    if (needText()) return;
    if (!target?.phone) { showToast('No phone number for this person.'); return; }
    if (target.phone.type === 'landline') { showToast('A landline can’t get SMS.'); return; }
    await record('sms', 'Match sent • SMS');
    location.href = `sms:${dialNumber(target.phone.number)}?body=${encodeURIComponent(message)}`;
  };
  const sendWhatsApp = async () => {
    if (needText()) return;
    const files = photos ? await photoFiles() : [];
    if (files.length && navigator.canShare?.({ files })) {
      try { await navigator.share({ files, text: message }); await record('whatsapp', 'Match sent • WhatsApp'); return; } catch (e) { if ((e as DOMException)?.name === 'AbortError') return; }
    }
    await record('whatsapp', 'Match sent • WhatsApp');
    const n = target?.phone ? whatsappNumber(target.phone.number, target.phone.waid) : '';
    const t = encodeURIComponent(message);
    if (isAndroid()) location.href = n ? `whatsapp://send?phone=${n}&text=${t}` : `whatsapp://send?text=${t}`;
    else window.open(n ? `https://wa.me/${n}?text=${t}` : `https://wa.me/?text=${t}`, '_blank', 'noopener');
  };
  const sendEmail = async () => {
    if (needText()) return;
    const files = photos ? await photoFiles() : [];
    if (files.length && navigator.canShare?.({ files })) {
      try { await navigator.share({ files, text: message, title: 'Shidduch suggestion' }); await record('email', 'Match sent • Email'); return; } catch (e) { if ((e as DOMException)?.name === 'AbortError') return; }
    }
    await record('email', 'Match sent • Email');
    location.href = `mailto:${target?.email ?? ''}?subject=${encodeURIComponent('Shidduch suggestion')}&body=${encodeURIComponent(message)}`;
  };

  const langRow: [string, string][] = [['en', 'English'], ['he', 'Hebrew'], ['ru', 'Russian']];
  return (
    <>
      <TopBar title="Make match" backTo="/people" />
      <main>
        <div class="pcardx">
          <div class="t" style="letter-spacing:.05em">SUGGESTED MATCH</div>
          <div class="grid-2">
            <div class="mbox"><div class="t">GUY</div><b class="bidi">{displayName(guy)}</b></div>
            <div class="mbox"><div class="t">GIRL</div><b class="bidi">{displayName(girl)}</b></div>
          </div>
          <div class="mshad"><div class="t">SHADCHAN</div><b class="bidi">{shad ? displayName(shad) : 'Not selected'}</b></div>
        </div>

        <label class="field"><span>Send to</span>
          <select value={target?.key ?? ''} onChange={(e) => { setTo(e.currentTarget.value); setEdited(false); }}>
            {targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <label class="field"><span>Message</span>
          <textarea dir="auto" class="bidi" style="min-height:230px" value={message} onInput={(e) => { setMessage(e.currentTarget.value); setEdited(true); }} />
        </label>
        {present.size > 1 && (
          <div class="field">
            <span class="section-title">Include in this match message</span>
            <div class="checks">
              {langRow.filter(([k]) => present.has(k)).map(([k, l]) => (
                <label key={k} class="check"><input type="checkbox" checked={langs.has(k)} onChange={(e) => { const s = new Set(langs); if (e.currentTarget.checked) s.add(k); else s.delete(k); setLangs(s); setEdited(false); }} />{l}</label>
              ))}
            </div>
          </div>
        )}
        {(guy.photoFileIds.length > 0 || girl.photoFileIds.length > 0) && (
          <label class="check" style="margin-bottom:12px"><input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.currentTarget.checked)} />Include profile photos with WhatsApp / Email</label>
        )}
        <div class="duerow" style="grid-template-columns:repeat(4,1fr)">
          <button type="button" class="lb" onClick={contact}>Contact</button>
          <button type="button" class="lb" onClick={sendSms}>SMS</button>
          <button type="button" class="lb" onClick={sendWhatsApp}>WhatsApp</button>
          <button type="button" class="lb" onClick={sendEmail}>Email</button>
        </div>
        <p class="muted small">Contact calls the person selected above. SMS, WhatsApp and Email send the message to that same selection.</p>
        <button type="button" class="btn quiet full" onClick={() => back('/people')}>Cancel</button>
      </main>
    </>
  );
}
