/* ZivugBase - minimal event bus.

   Replaces PeerMatch's pattern of each new file wrapping openP/openS/renderP.
   Features subscribe to events instead of redefining each other's functions,
   so load order stops being load-bearing. */

const handlers = new Map();

export const bus = {
  on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => handlers.get(event)?.delete(fn);
  },
  emit(event, payload) {
    for (const fn of handlers.get(event) || []) {
      try { fn(payload); } catch (err) { console.warn('ZivugBase handler failed for', event, err); }
    }
  }
};
