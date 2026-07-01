type Listener = () => void;

function isStandalone(): boolean {
  return (
    // jsdom (unit tests) doesn't implement matchMedia — guard so tests don't crash.
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
    // iOS Safari exposes this instead of the display-mode media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const listeners = new Set<Listener>();
let deferredEvent: BeforeInstallPromptEvent | null = null;
let installed = isStandalone();
let snapshot = { canInstall: false };

function recompute(): void {
  const canInstall = !installed && deferredEvent !== null;
  if (canInstall !== snapshot.canInstall) snapshot = { canInstall };
  listeners.forEach((listener) => listener());
}

// Module-scope, not a hook effect: `beforeinstallprompt` fires once per page load, often
// before the user ever navigates to the screen that renders the install button (e.g. it
// fires while on "Hoy", the default landing route). An effect tied to that screen's mount
// would miss it. This module is imported eagerly from main.tsx so the listener is live
// from the very first script execution, regardless of which route the user lands on.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredEvent = e as BeforeInstallPromptEvent;
  recompute();
});
window.addEventListener("appinstalled", () => {
  deferredEvent = null;
  installed = true;
  recompute();
});

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): { canInstall: boolean } {
  return snapshot;
}

export async function promptInstall(): Promise<void> {
  if (!deferredEvent) return;
  await deferredEvent.prompt();
  await deferredEvent.userChoice;
  deferredEvent = null;
  recompute();
}
