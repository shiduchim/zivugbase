/* One search (PLAN §6.6): find the right person in 2–3 seconds. Words that mean a filter become
   removable chips — a number is an age, a city is a city, "last year" is when they were added —
   and the rest is matched against names, profiles and notes, forgiving small spelling mistakes. */
import MiniSearch from 'minisearch';
import type { Person, Role } from '../db/types';
import { currentAge } from './age';
import { digitsOf } from './phone';
import { startOfDay } from './format';

const DAY = 86400000;

export interface Chip { id: string; label: string; source: string }
export interface Filters {
  ageMin?: number;
  ageMax?: number;
  gender?: 'm' | 'f';
  role?: Role;
  cities: CityGroup[];
  addedFrom?: number;
  addedTo?: number;
  waiting?: boolean;
  favorite?: boolean;
  digits: string[];
}
export interface Parsed { chips: Chip[]; filters: Filters; words: string }

/* Lower case, no niqqud or accents, no quote marks (כפר חב"ד = כפר חבד). */
export const norm = (s: string): string =>
  String(s ?? '').normalize('NFKD').replace(/\p{M}/gu, '').replace(/["'״׳`’]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const CITY_GROUPS: string[][] = [
  ['Jerusalem', 'yerushalayim', 'ירושלים'],
  ['Bnei Brak', 'bney brak', 'בני ברק'],
  ['Tzfat', 'safed', 'tsfat', 'zefat', 'צפת'],
  ['Beitar', 'beitar illit', 'ביתר', 'ביתר עילית'],
  ['Beit Shemesh', 'bet shemesh', 'בית שמש'],
  ['Kfar Chabad', 'כפר חבד'],
  ['Nachalat Har Chabad', 'נחלת הר חבד'],
  ['Kiryat Malachi', 'קרית מלאכי', 'קריית מלאכי'],
  ['Tel Aviv', 'תל אביב'],
  ['Haifa', 'חיפה'],
  ['Netanya', 'נתניה'],
  ['Ashdod', 'אשדוד'],
  ['Ashkelon', 'אשקלון'],
  ['Petach Tikva', 'petah tikva', 'פתח תקווה', 'פתח תקוה'],
  ['Modiin', 'modiin illit', 'מודיעין', 'מודיעין עילית'],
  ['Elad', 'אלעד'],
  ['Rechovot', 'rehovot', 'רחובות'],
  ['Ramat Gan', 'רמת גן'],
  ['Lod', 'לוד'],
  ['Beer Sheva', 'beersheba', 'באר שבע'],
  ['Migdal HaEmek', 'migdal haemek', 'מגדל העמק'],
  ['Crown Heights', 'קראון הייטס'],
  ['Brooklyn', 'ברוקלין'],
  ['Flatbush'],
  ['Lakewood', 'לייקווד'],
  ['Monsey', 'מונסי'],
  ['New York', 'nyc', 'ניו יורק'],
  ['Los Angeles'],
  ['Miami'],
  ['Chicago'],
  ['Baltimore'],
  ['Toronto'],
  ['Montreal'],
  ['London', 'לונדון'],
  ['Manchester'],
  ['Antwerp'],
  ['Paris', 'פריז'],
  ['Moscow', 'מוסקבה', 'москва'],
  ['Kyiv', 'kiev', 'киев'],
  ['Dnipro', 'dnepropetrovsk', 'днепр'],
  ['Melbourne'],
  ['Johannesburg']
];

const GENDER_WORDS: Record<string, 'm' | 'f'> = {
  guy: 'm', guys: 'm', boy: 'm', boys: 'm', bochur: 'm', bochurim: 'm', bachur: 'm', male: 'm', man: 'm', men: 'm', בחור: 'm', בחורים: 'm',
  girl: 'f', girls: 'f', bochura: 'f', bochurot: 'f', female: 'f', woman: 'f', women: 'f', lady: 'f', בחורה: 'f', בחורות: 'f'
};
const ROLE_WORDS: Record<string, Role> = {
  shadchan: 'shadchan', shadchanim: 'shadchan', shadchanit: 'shadchan', shadchante: 'shadchan', shadchente: 'shadchan', matchmaker: 'shadchan', matchmakers: 'shadchan',
  שדכן: 'shadchan', שדכנית: 'shadchan', שדכנים: 'shadchan', שדכניות: 'shadchan',
  single: 'single', singles: 'single', helper: 'helper', helpers: 'helper'
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HEB = /[֐-׿]/;
/* A whole word or phrase; Hebrew may carry a one- or two-letter prefix (מירושלים, בירושלים). */
const phraseRe = (alias: string) =>
  new RegExp(`(?:^|[^\\p{L}\\p{N}])${HEB.test(alias) ? '[מבולהשכ]{0,2}' : ''}${escapeRe(alias)}(?=$|[^\\p{L}\\p{N}])`, 'u');

export interface CityGroup { label: string; aliases: string[]; res: RegExp[] }
const group = (label: string, aliases: string[]): CityGroup => ({ label, aliases, res: aliases.map(phraseRe) });
const BUILT_IN: CityGroup[] = CITY_GROUPS.map(([label, ...rest]) => group(label!, [norm(label!), ...rest.map(norm)]));
const groupCache = new WeakMap<Person[], CityGroup[]>();

/* The built-in cities plus every city already written in the data. */
export function cityGroups(people: Person[]): CityGroup[] {
  const cached = groupCache.get(people);
  if (cached) return cached;
  const out = [...BUILT_IN];
  const known = new Set(BUILT_IN.flatMap((g) => g.aliases));
  for (const p of people) {
    const c = norm(p.city);
    if (c.length < 3 || known.has(c)) continue;
    known.add(c);
    if (BUILT_IN.some((g) => g.res.some((re) => re.test(' ' + c + ' ')))) continue;
    out.push(group(p.city.trim(), [c]));
  }
  groupCache.set(people, out);
  return out;
}

function datePhrase(phrase: string, at: number): { from: number; to: number; label: string } | undefined {
  const today = startOfDay(at);
  const d = new Date(at);
  const weekStart = today - d.getDay() * DAY;
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const yearStart = new Date(d.getFullYear(), 0, 1).getTime();
  switch (phrase) {
    case 'today': return { from: today, to: Infinity, label: 'Added today' };
    case 'yesterday': return { from: today - DAY, to: today, label: 'Added yesterday' };
    case 'this week': return { from: weekStart, to: Infinity, label: 'Added this week' };
    case 'last week': return { from: weekStart - 7 * DAY, to: weekStart, label: 'Added last week' };
    case 'this month': return { from: monthStart, to: Infinity, label: 'Added this month' };
    case 'last month': return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), to: monthStart, label: 'Added last month' };
    case 'this year': return { from: yearStart, to: Infinity, label: 'Added this year' };
    case 'last year': return { from: new Date(d.getFullYear() - 1, 0, 1).getTime(), to: yearStart, label: 'Added last year' };
  }
  if (/^(?:19|20)\d{2}$/.test(phrase)) {
    const y = Number(phrase);
    return { from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime(), label: `Added in ${y}` };
  }
  return undefined;
}

export function parseQuery(q: string, people: Person[], at = Date.now()): Parsed {
  let rest = ' ' + norm(q) + ' ';
  const chips: Chip[] = [];
  const filters: Filters = { cities: [], digits: [] };
  const take = (source: string) => { rest = rest.replace(source, ' '); };

  /* cities first (they can be several words) */
  const aliases = cityGroups(people).flatMap((g) => g.aliases.map((a, i) => ({ g, a, re: g.res[i]! }))).sort((x, y) => y.a.length - x.a.length);
  for (const { g, re } of aliases) {
    const m = rest.match(re);
    if (!m || filters.cities.includes(g)) continue;
    const source = m[0].replace(/^[^\p{L}\p{N}]/u, '');
    filters.cities.push(g);
    chips.push({ id: 'city:' + g.label, label: g.label, source });
    take(source);
  }

  /* dates */
  for (const phrase of ['today', 'yesterday', 'this week', 'last week', 'this month', 'last month', 'this year', 'last year']) {
    if (!rest.includes(' ' + phrase + ' ')) continue;
    const r = datePhrase(phrase, at)!;
    filters.addedFrom = r.from; filters.addedTo = r.to;
    chips.push({ id: 'added', label: r.label, source: phrase });
    take(' ' + phrase + ' ');
    rest = ' ' + rest.trim() + ' ';
    break;
  }
  const year = rest.match(/ (?:in |from )?((?:19|20)\d{2}) /);
  if (year && filters.addedFrom === undefined) {
    const r = datePhrase(year[1]!, at)!;
    filters.addedFrom = r.from; filters.addedTo = r.to;
    chips.push({ id: 'added', label: r.label, source: year[0].trim() });
    take(year[0].trim());
  }

  /* an age range: "25-30", "25 to 30" */
  const range = rest.match(/ (\d{2}) ?(?:-|–|to) ?(\d{2}) /);
  if (range) {
    const a = Number(range[1]), b = Number(range[2]);
    if (a >= 18 && b <= 99 && a <= b) {
      filters.ageMin = a; filters.ageMax = b;
      chips.push({ id: 'age', label: `Age ${a}–${b}`, source: range[0].trim() });
      take(range[0].trim());
    }
  }

  const words: string[] = [];
  for (const t of rest.split(' ').filter(Boolean)) {
    if (/^\d{2}$/.test(t) && filters.ageMin === undefined && Number(t) >= 18) {
      const n = Number(t);
      filters.ageMin = n - 2; filters.ageMax = n + 2;
      chips.push({ id: 'age', label: `Age about ${n}`, source: t });
    } else if (/^\+?[\d-]{3,}$/.test(t) && digitsOf(t).length >= 3) {
      filters.digits.push(digitsOf(t));
      chips.push({ id: 'phone:' + t, label: `Phone has ${t}`, source: t });
    } else if (GENDER_WORDS[t] && !filters.gender) {
      filters.gender = GENDER_WORDS[t];
      chips.push({ id: 'gender', label: filters.gender === 'm' ? 'Guys' : 'Girls', source: t });
    } else if (ROLE_WORDS[t] && !filters.role) {
      filters.role = ROLE_WORDS[t];
      chips.push({ id: 'role', label: t.startsWith('shadchan') || t.startsWith('match') || HEB.test(t) ? 'Shadchanim' : t.startsWith('helper') ? 'Helpers' : 'Singles', source: t });
    } else if (t === 'waiting') {
      filters.waiting = true;
      chips.push({ id: 'waiting', label: 'Waiting for an answer', source: t });
    } else if (['favorite', 'favorites', 'favourite', 'favourites', 'starred', '⭐'].includes(t)) {
      filters.favorite = true;
      chips.push({ id: 'favorite', label: 'Favorites', source: t });
    } else words.push(t);
  }
  return { chips, filters, words: words.join(' ') };
}

/* Removes a chip's words from the query. */
export function withoutChip(q: string, chip: Chip): string {
  return (' ' + norm(q) + ' ').replace(' ' + chip.source + ' ', ' ').replace(chip.source, ' ').replace(/\s+/g, ' ').trim();
}

const indexCache = new WeakMap<Person[], MiniSearch<Person>>();
function index(people: Person[]): MiniSearch<Person> {
  const cached = indexCache.get(people);
  if (cached) return cached;
  const ms = new MiniSearch<Person>({
    fields: ['name', 'alt', 'city', 'helperType', 'tags', 'profile', 'lookingFor', 'notes', 'emails', 'facts'],
    extractField: (p, field) => {
      switch (field) {
        case 'alt': return p.altNames.join(' ');
        case 'tags': return p.tags.join(' ');
        case 'profile': return p.profile.text;
        case 'lookingFor': return p.lookingFor.text;
        case 'emails': return p.emails.join(' ');
        case 'facts': return Object.values(p.facts).filter((v) => typeof v === 'string').join(' ');
        default: return (p as unknown as Record<string, unknown>)[field] ?? '';
      }
    },
    processTerm: (t) => norm(t) || null
  });
  ms.addAll(people);
  indexCache.set(people, ms);
  return ms;
}

export function matchesFilters(p: Person, f: Filters, at = Date.now()): boolean {
  if (f.role && !p.roles.includes(f.role)) return false;
  if (f.gender && p.gender !== f.gender) return false;
  if (f.favorite && !p.favorite) return false;
  if (f.waiting && p.waitingSince === undefined) return false;
  if (f.addedFrom !== undefined && (p.createdAt < f.addedFrom || p.createdAt >= (f.addedTo ?? Infinity))) return false;
  if (f.ageMin !== undefined) {
    const age = currentAge(p.age, p.dob, at);
    if (age === undefined || age < f.ageMin || age > (f.ageMax ?? 999)) return false;
  }
  if (f.digits.length) {
    const all = p.phones.map((ph) => digitsOf(ph.number)).concat(p.phoneKeys).join(' ');
    if (!f.digits.every((d) => all.includes(d))) return false;
  }
  if (f.cities.length) {
    const hay = ' ' + norm(p.city + ' ' + p.profile.text) + ' ';
    if (!f.cities.every((c) => c.res.some((re) => re.test(hay)))) return false;
  }
  return true;
}

export function searchPeople(people: Person[], q: string, at = Date.now()): { people: Person[]; parsed: Parsed } {
  const parsed = parseQuery(q, people, at);
  let list = people.filter((p) => matchesFilters(p, parsed.filters, at));
  if (parsed.words) {
    const hits = index(people).search(parsed.words, {
      prefix: true,
      fuzzy: (term) => (term.length >= 4 ? 0.2 : false),
      combineWith: 'AND',
      boost: { name: 3, alt: 2, tags: 1.5, city: 1.5 }
    });
    const score = new Map(hits.map((h) => [h.id as string, h.score]));
    list = list.filter((p) => score.has(p.id)).sort((a, b) => score.get(b.id)! - score.get(a.id)!);
  } else if (q.trim()) {
    list = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return { people: list, parsed };
}

/* The letter a person is filed under in the A–Z list. */
export function groupLetter(name: string): string {
  const c = norm(name).charAt(0);
  if (/[a-z]/.test(c)) return c.toUpperCase();
  if (HEB.test(c)) return c;
  if (/\p{L}/u.test(c)) return c.toUpperCase();
  return '#';
}
