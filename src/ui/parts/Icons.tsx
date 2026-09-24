/* PeerMatch's own icons (history-composer-v36): outline mic, send, stop and back chevron. */
const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' } as const;

export function MicIcon() {
  return (
    <svg {...props} width="23" height="23">
      <path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V5a3.5 3.5 0 0 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z" />
      <path d="M5.75 10.75a6.25 6.25 0 0 0 12.5 0M12 17v3.25M9.25 20.25h5.5" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg {...props} width="23" height="23">
      <path d="m4 4 16 8-16 8 3-8-3-8Z" />
      <path d="M7 12h13" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg {...props} width="23" height="23">
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg {...props} width="27" height="27" stroke-width={2.35}>
      <path d="M15.5 5 8.5 12l7 7" />
    </svg>
  );
}
