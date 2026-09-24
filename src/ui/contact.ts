/* Call · Email · WhatsApp · SMS — the one owner of every "contact this person" action.
   Each tap is written to the timeline as what really happened ("Call started"), never as a
   claim that a call was answered or a message was sent. */
import type { Person, Phone } from '../db/types';
import { addActivity } from '../db/repo';
import { dialNumber, displayPhone, whatsappNumber } from '../lib/phone';

export const isAndroid = (): boolean => /Android/i.test(navigator.userAgent);

/* Android opens WhatsApp directly, so leaving WhatsApp comes back here and not to a browser page. */
export function whatsappUrl(number: string, text = ''): string {
  if (isAndroid()) return `whatsapp://send?phone=${number}${text ? '&text=' + encodeURIComponent(text) : ''}`;
  return `https://wa.me/${number}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

function open(url: string): void {
  if (url.startsWith('https:')) window.open(url, '_blank', 'noopener');
  else location.href = url;
}

/* A kosher phone, or "calls or SMS only", never gets WhatsApp. */
export function canWhatsApp(p: Person, ph: Phone): boolean {
  if (p.reach?.rules.includes('calls-or-sms-only')) return false;
  if (/kosher|כשר/i.test(ph.label ?? '')) return false;
  return !!whatsappNumber(ph.number, ph.waid);
}
export const canSms = (ph: Phone): boolean => ph.type !== 'landline' && !!dialNumber(ph.number);

function log(p: Person, kind: 'call' | 'action', title: string, channel: string, detail: string): void {
  addActivity(kind, detail, [p.id], { title, channel }).catch((e) => console.error('could not record', e));
}

export function call(p: Person, ph: Phone): void {
  log(p, 'call', 'Call started', 'phone', displayPhone(ph.number));
  open('tel:' + dialNumber(ph.number));
}

export function whatsapp(p: Person, ph: Phone, text = ''): void {
  log(p, 'action', 'Opened WhatsApp', 'whatsapp', displayPhone(ph.number));
  open(whatsappUrl(whatsappNumber(ph.number, ph.waid), text));
}

export function sms(p: Person, ph: Phone): void {
  log(p, 'action', 'Opened SMS', 'sms', displayPhone(ph.number));
  open('sms:' + dialNumber(ph.number));
}

export function email(p: Person, address: string): void {
  log(p, 'action', 'Opened email', 'email', address);
  open('mailto:' + address);
}

export const phoneLabel = (ph: Phone): string => [displayPhone(ph.number), ph.label, ph.type === 'landline' ? 'landline' : ''].filter(Boolean).join(' · ');
