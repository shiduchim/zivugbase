/* Resumes, photos, voice notes and other files. Pictures open in the app; PDFs and other files
   are saved/opened by the phone (Android Chrome can't show a PDF inside a web page). */
import { useState } from 'preact/hooks';
import type { ID } from '../../db/types';
import { getFile } from '../../db/repo';
import { useFileUrl } from '../../hooks';
import { isAudio, isImage } from '../../lib/images';
import { reportError } from '../../state';
import { Viewer } from './common';

export async function openFile(id: ID): Promise<void> {
  const rec = await getFile(id);
  if (!rec) { reportError('This file is missing.', undefined); return; }
  const url = URL.createObjectURL(rec.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = rec.name || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function Thumb({ id, onOpen }: { id: ID; onOpen: (url: string) => void }) {
  const small = useFileUrl(id, true);
  const full = useFileUrl(id, false);
  if (!small.url) return null;
  return <img src={small.url} alt={small.name ?? 'photo'} onClick={() => full.url && onOpen(full.url)} />;
}

function FileItem({ id, onView }: { id: ID; onView: (url: string) => void }) {
  const f = useFileUrl(id);
  if (!f.type) return null;
  if (isImage(f.type)) return <Thumb id={id} onOpen={onView} />;
  if (isAudio(f.type, f.name) && f.url) return <audio controls preload="none" src={f.url} style="width:100%" />;
  return (
    <button type="button" class="btn quiet file-link" onClick={() => openFile(id).catch((e) => reportError('Could not open the file.', e))}>
      Open {/pdf/i.test(f.type) ? 'PDF' : 'file'}: {f.name}
    </button>
  );
}

export function FileList({ ids, hidePhotosUntilAsked }: { ids: ID[]; hidePhotosUntilAsked?: boolean }) {
  const [view, setView] = useState<string>();
  const [shown, setShown] = useState(!hidePhotosUntilAsked);
  if (!ids.length) return null;
  if (!shown) return <button type="button" class="btn quiet" onClick={() => setShown(true)}>Show photo{ids.length > 1 ? 's' : ''} ({ids.length})</button>;
  return (
    <>
      <div class="thumbs">{ids.map((id) => <FileItem key={id} id={id} onView={setView} />)}</div>
      {view && <Viewer url={view} onClose={() => setView(undefined)} />}
    </>
  );
}
