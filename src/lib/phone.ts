/* Phone numbers. Israeli numbers are shown and dialed in local 0… form; WhatsApp gets the
   international form; +1 and other international numbers are kept as entered. */

export const digitsOf = (s: string): string => String(s ?? '').replace(/\D/g, '');

/* Israeli landlines (02/03/04/08/09 + 7 digits) can't receive SMS. 07x are VoIP/nationwide. */
export function israeliType(local: string): 'mobile' | 'landline' | '' {
  if (/^05\d{8}$/.test(local)) return 'mobile';
  if (/^07\d{8}$/.test(local)) return 'mobile';
  if (/^0[2-489]\d{7}$/.test(local)) return 'landline';
  return '';
}

/* To the local Israeli form when the number is Israeli; otherwise returns ''. */
export function israeliLocal(raw: string): string {
  let d = digitsOf(raw);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) {
    const rest = d.slice(3).replace(/^0/, '');
    return rest.length >= 8 && rest.length <= 9 ? '0' + rest : '';
  }
  if (/^0[2-9]\d{7,8}$/.test(d)) return d;
  return '';
}

export function displayPhone(raw: string): string {
  const local = israeliLocal(raw);
  if (!local) return String(raw ?? '').trim();
  if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
}

export function dialNumber(raw: string): string {
  const local = israeliLocal(raw);
  if (local) return local;
  const s = String(raw ?? '').trim();
  return s.startsWith('+') ? '+' + digitsOf(s) : digitsOf(s);
}

/* Digits for wa.me / whatsapp:// — international, no plus. */
export function whatsappNumber(raw: string, waid?: string): string {
  if (waid) return digitsOf(waid);
  const local = israeliLocal(raw);
  if (local) return '972' + local.slice(1);
  let d = digitsOf(raw);
  if (d.startsWith('00')) d = d.slice(2);
  return d.length >= 8 ? d : '';
}

/* One stable key per number for duplicate checks: the international digits when we can tell,
   otherwise the digits as written. */
export function phoneKey(raw: string): string {
  const local = israeliLocal(raw);
  if (local) return '972' + local.slice(1);
  let d = digitsOf(raw);
  if (d.startsWith('00')) d = d.slice(2);
  return d.length >= 7 ? d : '';
}

export function phoneType(raw: string): 'mobile' | 'landline' | '' {
  const local = israeliLocal(raw);
  return local ? israeliType(local) : '';
}
