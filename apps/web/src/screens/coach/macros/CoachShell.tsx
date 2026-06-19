import { useCallback, useMemo, useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { getCoachSkin, setCoachSkin as persistCoachSkin } from "./coachPrefs";

export interface CoachOutletCtx {
  skin: string;
  setSkin: (skin: string) => void;
}

/** Contexto del shell del coach (skin actual + setter). Tolera la ausencia de Outlet (tests que
 *  montan una pantalla del coach suelta) cayendo al default "legend" + setter no-op. */
export function useCoachCtx(): CoachOutletCtx {
  return useOutletContext<CoachOutletCtx | null>() ?? { skin: "legend", setSkin: () => {} };
}

/** Coach layout: skin (legend por default, cambiable desde Cuenta) + la pantalla activa + el bottom
 *  nav persistente. El wrapper `.wl--<skin>` re-skinea todo el coach por token-swap (las pantallas leen
 *  var(--wl-*)). La preferencia vive en localStorage (coachPrefs) y se pasa por contexto del Outlet. */
export function CoachShell() {
  const [skin, setSkinState] = useState<string>(() => getCoachSkin());
  const setSkin = useCallback((s: string) => { persistCoachSkin(s); setSkinState(s); }, []);
  const ctx = useMemo<CoachOutletCtx>(() => ({ skin, setSkin }), [skin, setSkin]);

  return (
    <div className={`wl wl--${skin}`} style={{ minHeight: "100vh", background: "var(--wl-bg)" }}>
      {/* Clear the fixed BottomNav (~55px) so the last element of any coach screen stays tappable. */}
      <div style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}>
        <Outlet context={ctx} />
      </div>
      <BottomNav />
    </div>
  );
}
