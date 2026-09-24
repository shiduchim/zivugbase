/* Sending profiles and shadchan cards from the list's share bar — the one owner of that.
   Each person goes as their own message (never bundled), and every send is written to their
   History as what really happened ("Profile shared · WhatsApp"), not as a claim it arrived. */
import type { ID, Person } from '../db/types';
import { addActivity } from '../db/repo';
import { ageLabel } from '../lib/age';
import { displayPhone } from '../lib/phone';
import { isAndroid } from './contact';
import { displayName } from './describe';

export type Channel = 'whatsapp' | 'sms' | 'email';
export const CHANNEL_WORD: Record<Channel, string> = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' };

/* Who sent this person to me: where they came from, else their first contact person. */
export function senderOf(p: Person, byId: Map<ID, Person>): Person | undefined {
  const id = p.cameFrom?.personId ?? p.contactPeople[0]?.personId;
  return id ? byId.get(id) : undefined;
}

const clean = (s: string): string => s.replace(/\*/g, '').trim();

export function profileText(p: Person, byId: Map<ID, Person>): string {
  const from = senderOf(p, byId);
  const age = ageLabel(p.age, p.dob);
  return [
    clean(displayName(p)),
    age ? 'Age: ' + age : '',
    p.profile.text.trim(),
    from ? 'Sent by: ' + clean(displayName(from)) : '',
    from?.phones[0] ? 'Sender phone: ' + displayPhone(from.phones[0].number) : ''
  ].filter(Boolean).join('\n');
}

export function cardText(p: Person): string {
  return [
    clean(displayName(p)),
    ...p.phones.filter((ph) => ph.number.trim()).map((ph) => 'Phone: ' + displayPhone(ph.number)),
    ...p.emails.map((e) => 'Email: ' + e),
    p.tags.length ? 'Tags: ' + p.tags.join(', ') : ''
  ].filter(Boolean).join('\n');
}

export const textFor = (p: Person, byId: Map<ID, Person>): string =>
  p.roles.includes('single') ? profileText(p, byId) : cardText(p);

/* No number: WhatsApp opens and you pick the chat there. On Android the app opens directly,
   so leaving WhatsApp comes back here instead of to a browser page. */
export function openChannel(channel: Channel, text: string, subject = ''): void {
  const t = encodeURIComponent(text);
  if (channel === 'whatsapp') {
    if (isAndroid()) location.href = 'whatsapp://send?text=' + t;
    else window.open('https://wa.me/?text=' + t, '_blank', 'noopener');
  } else if (channel === 'sms') {
    location.href = 'sms:?body=' + encodeURIComponent(clean(text));
  } else {
    location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + t;
  }
}

export function sendOne(p: Person, channel: Channel, byId: Map<ID, Person>): void {
  const text = textFor(p, byId);
  addActivity('profile-sent', text, [p.id], { title: p.roles.includes('single') ? 'Profile shared' : 'Contact card shared', channel })
    .catch((e) => console.error('could not record', e));
  openChannel(channel, text, displayName(p));
}
