import { useState, useSyncExternalStore } from "react";
import { getSnapshot, subscribe, promptInstall, isIosAddToHomeScreenAvailable } from "./pwaInstallStore";

/** Reads the `beforeinstallprompt` state captured by pwaInstallStore.ts (module-scope,
 *  registered from main.tsx) so the button works no matter which screen the user is on
 *  when the browser fires the event. On iOS there's no such event — `showIosHint` signals
 *  the caller to render manual "Compartir → Agregar a inicio" instructions instead. */
export function usePwaInstall(): { canInstall: boolean; showIosHint: boolean; promptInstall: () => Promise<void> } {
  const { canInstall } = useSyncExternalStore(subscribe, getSnapshot);
  const [showIosHint] = useState(isIosAddToHomeScreenAvailable);
  return { canInstall, showIosHint, promptInstall };
}
