/* Speak → text. Uses the browser's speech recognition (on the phone when Chrome offers it,
   otherwise Chrome's online service — the owner accepted this). The text box always stays
   editable, and the keyboard's own microphone works as well. */
import { useEffect, useRef, useState } from 'preact/hooks';

type Lang = 'en-US' | 'he-IL' | 'ru-RU';
const LANGS: { key: Lang; label: string }[] = [
  { key: 'en-US', label: 'English' },
  { key: 'he-IL', label: 'עברית' },
  { key: 'ru-RU', label: 'Русский' }
];

/* Minimal typing for the Web Speech API (not in TypeScript's DOM library everywhere). */
interface Rec {
  lang: string; continuous: boolean; interimResults: boolean; processLocally?: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
interface RecCtor { new (): Rec; available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string> }

const Ctor = (): RecCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const canListen = (): boolean => !!Ctor();

function savedLang(): Lang {
  try { return (localStorage.getItem('zb-speech-lang') as Lang) || 'en-US'; } catch { return 'en-US'; }
}

export function SpeechBox({ value, onChange, rows = 8, autoStart }: { value: string; onChange: (v: string) => void; rows?: number; autoStart?: boolean }) {
  const [lang, setLang] = useState<Lang>(savedLang);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const rec = useRef<Rec>();
  const want = useRef(false);
  const base = useRef(value);
  const latest = useRef(value);
  latest.current = value;

  const stop = () => {
    want.current = false;
    setListening(false);
    setInterim('');
    try { rec.current?.stop(); } catch { /* already stopped */ }
  };

  /* One short session at a time, restarted until you tap Stop: this avoids Android Chrome's
     repeated-words problem with "continuous" listening. */
  const startSession = async () => {
    const C = Ctor();
    if (!C) return;
    const r = new C();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    let appended = false; /* some phones report the same final words twice */
    try {
      if (C.available && 'processLocally' in r && (await C.available({ langs: [lang], processLocally: true })) === 'available') r.processLocally = true;
    } catch { /* use the default */ }
    r.onresult = (e) => {
      let fin = '';
      let mid = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) fin += res[0].transcript; else mid += res[0].transcript;
      }
      if (fin && !appended) {
        appended = true;
        const sep = base.current && !/\s$/.test(base.current) ? ' ' : '';
        base.current = base.current + sep + fin.trim();
        onChange(base.current);
      }
      setInterim(mid);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      want.current = false;
      setListening(false);
      setError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'The microphone isn’t allowed for ZivugBase. Allow it in Chrome’s site settings — or use the microphone on your keyboard.'
          : e.error === 'network'
            ? 'Listening needs the internet on this phone right now. Use the microphone on your keyboard instead (it can work offline).'
            : 'Listening stopped. Use the microphone on your keyboard, or try again.'
      );
    };
    r.onend = () => {
      setInterim('');
      if (want.current) void startSession();
    };
    rec.current = r;
    try { r.start(); } catch { /* a session is already running */ }
  };

  const start = () => {
    setError('');
    base.current = latest.current;
    want.current = true;
    setListening(true);
    void startSession();
  };

  useEffect(() => { if (autoStart && canListen()) start(); return () => { want.current = false; try { rec.current?.abort(); } catch { /* ignore */ } }; }, []);

  return (
    <div>
      {canListen() && (
        <div class="chips" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l.key} type="button" class={`chip${l.key === lang ? ' on' : ''}`} aria-pressed={l.key === lang} disabled={listening}
              onClick={() => { setLang(l.key); try { localStorage.setItem('zb-speech-lang', l.key); } catch { /* optional */ } }}>{l.label}</button>
          ))}
        </div>
      )}
      <textarea
        class="bidi"
        dir="auto"
        rows={rows}
        value={value + (interim ? (value ? ' ' : '') + interim : '')}
        placeholder={canListen() ? 'Tap Start and speak — or type here.' : 'Type here, or tap the microphone on your keyboard.'}
        onInput={(e) => { base.current = e.currentTarget.value; onChange(e.currentTarget.value); }}
      />
      {error && <p class="notice warn">{error}</p>}
      {canListen() && (
        listening
          ? <button type="button" class="btn danger full" onClick={stop}>Stop listening</button>
          : <button type="button" class="btn full" onClick={start}>{value ? 'Speak more' : 'Start speaking'}</button>
      )}
    </div>
  );
}
