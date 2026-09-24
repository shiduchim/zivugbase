/* Ages are stored with the date they were true, so "35" saved today is 36 next year. */
import type { AgeInfo } from '../db/types';

const YEAR = 365.2425 * 24 * 3600 * 1000;

export function currentAge(age: AgeInfo | undefined, dob?: string, at = Date.now()): number | undefined {
  if (dob) {
    const d = Date.parse(dob);
    if (Number.isFinite(d)) return Math.floor((at - d) / YEAR);
  }
  if (!age || !Number.isFinite(age.value)) return undefined;
  return Math.floor(age.value + Math.max(0, at - age.asOf) / YEAR);
}

export function ageLabel(age: AgeInfo | undefined, dob?: string, at = Date.now()): string {
  const n = currentAge(age, dob, at);
  return n === undefined ? '' : String(n);
}

/* Reads an age out of free text: "age 29", "29 years old", "בן 30", "בת 29", "29 лет", "גיל: 37". */
export function ageFromText(text: string): number | undefined {
  const s = String(text ?? '');
  const patterns = [
    /\bage\s*[:\-–]?\s*(\d{2})\b/i,
    /\b(\d{2})\s*(?:years?\s*old|y\/?o)\b/i,
    /(?:גיל\s*[:\-–]?\s*)(\d{2})\b/,
    /(?:^|\s)(?:בן|בת)\s+(\d{2})\b/,
    /(?:возраст\s*[:\-–]?\s*)(\d{2})\b/i,
    /\b(\d{2})\s*(?:лет|года)\b/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    const n = m ? Number(m[1]) : NaN;
    if (n >= 18 && n <= 99) return n;
  }
  return undefined;
}
