const DAY = 86400000;

export function relativeDay(ms: number | undefined, at = Date.now()): string {
  if (!ms) return '';
  const days = Math.floor((startOfDay(at) - startOfDay(ms)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function shortDate(ms: number | undefined): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(ms: number | undefined): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function initials(name: string): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  return (parts.map((p) => [...p][0] ?? '').join('').slice(0, 2) || '?').toUpperCase();
}

export const isHebrew = (s: string): boolean => /[֐-׿]/.test(s);
