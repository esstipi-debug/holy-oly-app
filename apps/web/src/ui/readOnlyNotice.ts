// Tiny pub/sub so the (non-React) HTTP layer can tell the UI a write was blocked by the read-only
// demo gate (403 demo_read_only). The DemoBanner subscribes and flashes a toast. Keeps the
// repository decoupled from React without a global error boundary.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to "a write was blocked by the demo read-only gate". Returns an unsubscribe fn. */
export function subscribeReadOnly(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Called by the HTTP layer when the API answers 403 demo_read_only. */
export function notifyReadOnly(): void {
  for (const fn of listeners) fn();
}
