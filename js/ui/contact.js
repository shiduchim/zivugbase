/* ZivugBase - contact actions.

   Button order is fixed at Call, Email, WhatsApp, SMS everywhere it appears.
   Israeli numbers dial locally; WhatsApp always gets an internationalised
   msisdn; +1 and other international numbers pass through untouched.

   WhatsApp deliberately uses the whatsapp:// scheme so that leaving WhatsApp
   returns to this app rather than to an api.whatsapp.com page in the browser. */

import { dialPhone, waPhone, esc } from '../core/format.js';
import { addActivity } from './activity.js';

const isAndroid = () => /Android/i.test(navigator.userAgent);

export function contactActions(record) {
  const phone = String(record.phone || record.sourcePhone || record.contact1Phone || '').trim();
  const email = String(record.email || '').trim();
  return [
    { id: 'call',  label: 'Call',     tone: 'primary', enabled: !!phone },
    { id: 'email', label: 'Email',    tone: 'soft',    enabled: !!email },
    { id: 'wa',    label: 'WhatsApp', tone: 'green',   enabled: !!waPhone(phone) },
    { id: 'sms',   label: 'SMS',      tone: 'soft',    enabled: !!phone }
  ];
}

export function contactBar(record) {
  return `<div class="contact-bar">${contactActions(record).map(a =>
    `<button class="btn btn-${a.tone}${a.enabled ? '' : ' is-disabled'}" data-contact="${a.id}"${a.enabled ? '' : ' disabled'}>${esc(a.label)}</button>`
  ).join('')}</div>`;
}

export async function runContact(record, action, text = '') {
  const phone = String(record.phone || record.sourcePhone || record.contact1Phone || '').trim();
  const email = String(record.email || '').trim();
  let url = '';

  if (action === 'call') url = 'tel:' + dialPhone(phone);
  else if (action === 'sms') url = 'sms:' + dialPhone(phone) + (text ? (isAndroid() ? '?body=' : '&body=') + encodeURIComponent(text) : '');
  else if (action === 'email') url = 'mailto:' + encodeURIComponent(email);
  else if (action === 'wa') {
    const n = waPhone(phone);
    url = isAndroid()
      ? `whatsapp://send?phone=${n}${text ? '&text=' + encodeURIComponent(text) : ''}`
      : `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  }
  if (!url) return false;

  const labels = { call: 'Call', sms: 'SMS', email: 'Email', wa: 'WhatsApp' };
  await addActivity(record, { type: 'action', action: labels[action], text: labels[action] + ' opened' });
  location.href = url;
  return true;
}
