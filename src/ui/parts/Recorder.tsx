/* Record a voice note that is kept playable (for when talking is faster than typing). */
import { useEffect, useRef, useState } from 'preact/hooks';
import { useObjectUrl } from '../../hooks';

export function pickType(): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export const canRecord = (): boolean => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export function Recorder({ onSave, onCancel }: { onSave: (blob: Blob, seconds: number) => void | Promise<void>; onCancel: () => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob>();
  const [error, setError] = useState('');
  const rec = useRef<MediaRecorder>();
  const stream = useRef<MediaStream>();
  const timer = useRef<ReturnType<typeof setInterval>>();
  const url = useObjectUrl(blob);

  const release = () => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = undefined;
  };
  useEffect(() => () => { try { rec.current?.state === 'recording' && rec.current.stop(); } catch { /* ignore */ } release(); }, []);

  const start = async () => {
    setError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('The microphone isn’t allowed. Allow it in Chrome’s site settings, then try again.');
      return;
    }
    const type = pickType();
    const r = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      release();
      setBlob(new Blob(chunks, { type: r.mimeType || type || 'audio/webm' }));
      setState('done');
    };
    rec.current = r;
    r.start(1000);
    setSecs(0);
    const t0 = Date.now();
    timer.current = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 500);
    setState('recording');
  };

  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div>
      {error && <p class="notice warn">{error}</p>}
      {state === 'idle' && <button type="button" class="btn primary full" onClick={start}>Start recording</button>}
      {state === 'recording' && (
        <>
          <p style="text-align:center;font-size:1.4rem" aria-live="polite">Recording… {mmss}</p>
          <button type="button" class="btn danger full" onClick={() => rec.current?.stop()}>Stop</button>
        </>
      )}
      {state === 'done' && url && (
        <>
          <audio controls src={url} style="width:100%;margin:8px 0" />
          <div class="btn-row">
            <button type="button" class="btn quiet" onClick={() => { setBlob(undefined); setState('idle'); }}>Record again</button>
            <button type="button" class="btn primary" onClick={() => blob && onSave(blob, secs)}>Save</button>
          </div>
        </>
      )}
      <button type="button" class="btn quiet full" style="margin-top:8px" onClick={onCancel}>Cancel</button>
    </div>
  );
}
