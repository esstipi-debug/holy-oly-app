import { useSyncExternalStore } from "react";
import { getSnapshot, subscribe, promptInstall } from "./pwaInstallStore";

/** Reads the `beforeinstallprompt` state captured by pwaInstallStore.ts (module-scope,
 *  registered from main.tsx) so the button works no matter which screen the user is on
 *  when the browser fires the event. iOS Safari never fires it — `canInstall` stays false
 *  by design there (D6/current memory: no A2HS prompt, only manual "Compartir → Agregar a inicio"). */
export function usePwaInstall(): { canInstall: boolean; promptInstall: () => Promise<void> } {
  const { canInstall } = useSyncExternalStore(subscribe, getSnapshot);
  return { canInstall, promptInstall };
}
