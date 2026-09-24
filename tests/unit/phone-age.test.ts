import { describe, expect, it } from 'vitest';
import { dialNumber, displayPhone, israeliLocal, phoneKey, phoneType, whatsappNumber } from '../../src/lib/phone';
import { ageFromText, currentAge } from '../../src/lib/age';

describe('phone numbers (made-up examples)', () => {
  it('shows Israeli numbers locally and keeps international ones', () => {
    expect(israeliLocal('+972 50-000-0012')).toBe('0500000012');
    expect(displayPhone('00972500000012')).toBe('050-000-0012');
    expect(displayPhone('+1 (212) 555-0199')).toBe('+1 (212) 555-0199');
    expect(dialNumber('+972 50 000 0012')).toBe('0500000012');
    expect(dialNumber('+1 212 555 0199')).toBe('+12125550199');
  });
  it('builds WhatsApp numbers', () => {
    expect(whatsappNumber('050-000-0012')).toBe('972500000012');
    expect(whatsappNumber('anything', '972500000013')).toBe('972500000013');
    expect(whatsappNumber('+1 212 555 0199')).toBe('12125550199');
  });
  it('gives one key for every spelling of the same number', () => {
    const keys = ['050-000-0012', '+972 50-000-0012', '00972500000012', '972500000012'].map(phoneKey);
    expect(new Set(keys).size).toBe(1);
  });
  it('marks Israeli landlines so SMS can be hidden', () => {
    expect(phoneType('02-500-0012')).toBe('landline');
    expect(phoneType('050-000-0012')).toBe('mobile');
  });
});

describe('ages', () => {
  it('ticks over with time', () => {
    const asOf = Date.parse('2024-03-01');
    expect(currentAge({ value: 35, asOf }, undefined, Date.parse('2024-09-01'))).toBe(35);
    expect(currentAge({ value: 35, asOf }, undefined, Date.parse('2026-09-24'))).toBe(37);
  });
  it('prefers a date of birth', () => {
    expect(currentAge(undefined, '1995-04-03', Date.parse('2026-09-24'))).toBe(31);
  });
  it('reads ages in three languages', () => {
    expect(ageFromText('a 29 year old girl in the city')).toBe(29);
    expect(ageFromText('📌גיל: 37')).toBe(37);
    expect(ageFromText('בת 26 | עיר')).toBe(26);
    expect(ageFromText('Возраст: 41')).toBe(41);
    expect(ageFromText('age 12')).toBeUndefined();
  });
});
