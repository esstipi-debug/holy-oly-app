import { useEffect, useState } from "react";

function isStandalone(): boolean {
  return (
    // jsdom (unit tests) doesn't implement matchMedia — guard so tests don't crash on mount.
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) ||
    // iOS Safari exposes this instead of the display-mode media query.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Captures the `beforeinstallprompt` event (Chrome/Edge/Android) so the app can offer its
 *  own "Instalar app" button instead of relying on the user to notice the browser's own UI.
 *  iOS Safari never fires this event — there `canInstall` stays false by design (D6/current
 *  memory: no A2HS prompt on iOS, only manual "Compartir → Agregar a inicio"). */
export function usePwaInstall(): { canInstall: boolean; promptInstall: () => Promise<void> } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    function onBeforeInstallPrompt(e: BeforeInstallPromptEvent): void {
      e.preventDefault();
      setDeferred(e);
    }
    function onAppInstalled(): void {
      setDeferred(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function promptInstall(): Promise<void> {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return { canInstall: !installed && deferred !== null, promptInstall };
}
