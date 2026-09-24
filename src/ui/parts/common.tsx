import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import type { Person } from '../../db/types';
import { back, go, hideToast, pushLayer, route, toast } from '../../state';
import { useFileUrl } from '../../hooks';
import { initials } from '../../lib/format';
import { displayName, rowSide, rowSub } from '../describe';

export function TopBar({ title, backTo, right }: { title: ComponentChildren; backTo?: string; right?: ComponentChildren }) {
  return (
    <header class="topbar">
      {backTo !== undefined && (
        <button class="btn quiet small back" type="button" onClick={() => back(backTo)}>Back</button>
      )}
      <h1 class="bidi">{title}</h1>
      {right}
    </header>
  );
}

export function SettingsButton() {
  return <button class="btn quiet small" type="button" onClick={() => go('/settings')}>Settings</button>;
}

/* A panel that slides up from the bottom. One deep: never a sheet on a sheet. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => pushLayer(() => close.current()), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div class="sheet-shade" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* Full-screen photo. Back or Close returns. */
export function Viewer({ url, onClose }: { url: string; onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => pushLayer(() => close.current()), []);
  return (
    <div class="viewer" onClick={onClose}>
      <img src={url} alt="" />
      <button class="btn" type="button" onClick={onClose}>Close</button>
    </div>
  );
}

/* Initials, or the photo — except girls' photos, which open only when you ask (as in PeerMatch). */
export function Avatar({ p, big }: { p: Person; big?: boolean }) {
  const showPhoto = p.gender !== 'f' && p.photoFileIds.length > 0;
  const { url } = useFileUrl(showPhoto ? p.photoFileIds[0] : undefined, true);
  if (url) return <img class={`avatar${big ? ' big' : ''}`} src={url} alt="" />;
  return <span class={`avatar${big ? ' big' : ''}`} aria-hidden="true">{initials(p.name)}</span>;
}

export function PersonRow({ p, waitDays, sub, onClick, noSide }: { p: Person; waitDays?: number; sub?: string; onClick?: () => void; noSide?: boolean }) {
  const side = noSide ? undefined : rowSide(p, waitDays);
  return (
    <button type="button" class={`row${side?.wait ? ' wait' : ''}`} onClick={onClick ?? (() => go('/person/' + p.id))}>
      <Avatar p={p} />
      <span class="body">
        <span class="name bidi" style="display:block">{displayName(p)}{p.favorite && <span class="star" aria-label="favorite"> ★</span>}</span>
        <span class="sub bidi" style="display:block">{sub ?? rowSub(p)}</span>
      </span>
      {side && <span class={`pill${side.wait ? ' wait' : ''}`}>{side.text}</span>}
    </button>
  );
}

export function TabBar() {
  const at = route.value.path[0] ?? 'home';
  const tab = (key: string, label: string, to: string, match: string[]) => (
    <a
      href={'#' + to}
      aria-current={match.includes(at) ? 'page' : undefined}
      onClick={(e) => { e.preventDefault(); go(to); }}
    >{label}</a>
  );
  return (
    <nav class="tabbar" aria-label="Main">
      {tab('home', 'Home', '/home', ['home', 'inbox', 'capture'])}
      {tab('people', 'People', '/people', ['people', 'person'])}
    </nav>
  );
}

export function ToastView() {
  const t = toast.value;
  if (!t) return null;
  return (
    <div class="toast" role="status" aria-live="polite">
      <span>{t.text}</span>
      {t.action && (
        <button class="btn small" type="button" onClick={async () => { const a = t.action!; hideToast(); await a.run(); }}>{t.action.label}</button>
      )}
      {!t.action && <button class="btn small" type="button" onClick={hideToast}>OK</button>}
    </div>
  );
}

/* Explicit Yes / No (the owner's preference: never an X or a lone checkbox for a choice). */
export function YesNo({ value, onChange, yes = 'Yes', no = 'No', allowUnset }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void; yes?: string; no?: string; allowUnset?: boolean }) {
  return (
    <span class="yesno">
      <button type="button" class={`chip${value === true ? ' on' : ''}`} aria-pressed={value === true} onClick={() => onChange(allowUnset && value === true ? null : true)}>{yes}</button>
      <button type="button" class={`chip${value === false ? ' on' : ''}`} aria-pressed={value === false} onClick={() => onChange(allowUnset && value === false ? null : false)}>{no}</button>
    </span>
  );
}

export function Chips<T extends string>({ options, value, onChange, wrap }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; wrap?: boolean }) {
  return (
    <div class={`chips${wrap ? ' wrap' : ''}`} role="group">
      {options.map((o) => (
        <button key={o.key} type="button" class={`chip${o.key === value ? ' on' : ''}`} aria-pressed={o.key === value} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Loading() {
  return <p class="muted" style="padding:24px 0;text-align:center">Loading…</p>;
}
