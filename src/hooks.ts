import { useEffect, useState } from 'preact/hooks';
import { liveQuery } from 'dexie';
import { getFile } from './db/repo';
import type { ID } from './db/types';

/* Runs a database query and re-runs it whenever the data it read changes. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<{ v: T } | undefined>(undefined);
  useEffect(() => {
    setValue(undefined);
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue({ v }),
      error: (e) => console.error('query failed', e)
    });
    return () => sub.unsubscribe();
  }, deps);
  return value?.v;
}

export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) { setUrl(undefined); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/* A stored file as a URL; the small thumbnail when there is one and it's enough. */
export function useFileUrl(id: ID | undefined, preferThumb = false): { url?: string; type?: string; name?: string } {
  const rec = useLive(async () => (id ? (await getFile(id)) ?? null : null), [id]);
  const blob = rec ? (preferThumb && rec.thumb) || rec.blob : undefined;
  const url = useObjectUrl(blob);
  return rec ? { ...(url ? { url } : {}), type: rec.type, name: rec.name } : {};
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
