/* Translate a profile into English, Hebrew or Russian. Uses Chrome's translator on the phone when
   it has one (nothing leaves the phone); otherwise opens Google Translate with the text. The
   profile itself is never changed. */
export type Lang = 'en' | 'he' | 'ru';
export const LANG_LABEL: Record<Lang, string> = { en: 'English', he: 'Hebrew', ru: 'Russian' };

const guessSource = (text: string): Lang => (/[֐-׿]/.test(text) ? 'he' : /[Ѐ-ӿ]/.test(text) ? 'ru' : 'en');

interface TranslatorApi { create(o: { sourceLanguage: string; targetLanguage: string }): Promise<{ translate(t: string): Promise<string> }> }

/* Returns the translation, or '' after opening Google Translate instead. */
export async function translate(text: string, to: Lang): Promise<string> {
  const from = guessSource(text);
  if (from === to) return text;
  const api = (globalThis as { Translator?: TranslatorApi }).Translator;
  if (api) {
    try {
      const t = await api.create({ sourceLanguage: from, targetLanguage: to });
      const parts: string[] = [];
      for (const chunk of text.split(/\n{2,}/)) parts.push(chunk.trim() ? await t.translate(chunk) : '');
      return parts.join('\n\n');
    } catch { /* fall through to the website */ }
  }
  window.open(`https://translate.google.com/?sl=auto&tl=${to}&op=translate&text=${encodeURIComponent(text.slice(0, 4500))}`, '_blank', 'noopener');
  return '';
}
