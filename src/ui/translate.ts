/* Translate a profile into English, Hebrew or Russian, shown right in the app (PeerMatch's
   ui-fixes-v73): Chrome's on-phone translator first (downloads a language pack once), otherwise
   Google's translate service. The profile itself is never changed. */
export type Lang = 'en' | 'he' | 'ru';
export const LANG_LABEL: Record<Lang, string> = { en: 'English', he: 'Hebrew', ru: 'Russian' };

export function detectLanguage(text: string): Lang {
  const he = (text.match(/[֐-׿]/g) ?? []).length;
  const ru = (text.match(/[Ѐ-ӿ]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  if (he >= ru && he >= en && he > 0) return 'he';
  if (ru >= he && ru >= en && ru > 0) return 'ru';
  return 'en';
}

function chunks(text: string, max = 1400): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.55) cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.55) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\s+/, '');
  }
  if (rest) out.push(rest);
  return out;
}

interface ChromeTranslator { translate(t: string): Promise<string>; destroy?(): void }
interface TranslatorApi {
  availability?(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: EventTarget) => void }): Promise<ChromeTranslator>;
}

async function onPhone(text: string, from: Lang, to: Lang, status: (s: string) => void): Promise<string | null> {
  const api = (globalThis as { Translator?: TranslatorApi }).Translator;
  if (!api || typeof api.create !== 'function') return null;
  try {
    if (api.availability) {
      const a = await api.availability({ sourceLanguage: from, targetLanguage: to });
      if (a === 'unavailable') return null;
      if (a === 'downloadable' || a === 'downloading') status(`Preparing ${from.toUpperCase()} → ${to.toUpperCase()} translation…`);
    }
    const tr = await api.create({
      sourceLanguage: from, targetLanguage: to,
      monitor(m) { m.addEventListener('downloadprogress', (e) => status(`Downloading the language pack… ${Math.round(((e as ProgressEvent).loaded || 0) * 100)}%`)); }
    });
    const parts = chunks(text);
    const out: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      status(parts.length > 1 ? `Translating ${i + 1} of ${parts.length}…` : 'Translating…');
      out.push(await tr.translate(parts[i]!));
    }
    tr.destroy?.();
    return out.join('\n\n');
  } catch {
    return null;
  }
}

async function online(text: string, from: Lang, to: Lang, status: (s: string) => void): Promise<string> {
  const parts = chunks(text, 1200);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    status(parts.length > 1 ? `Translating ${i + 1} of ${parts.length}…` : 'Translating…');
    const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(parts[i]!)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('Translation service ' + r.status);
    const j = (await r.json()) as [[string][]];
    out.push((j?.[0] ?? []).map((a) => a?.[0] ?? '').join(''));
  }
  return out.join('\n\n');
}

export async function translate(text: string, to: Lang, status: (s: string) => void): Promise<string> {
  const from = detectLanguage(text);
  if (from === to) return text;
  status('Translating…');
  return (await onPhone(text, from, to, status)) ?? (await online(text, from, to, status));
}
