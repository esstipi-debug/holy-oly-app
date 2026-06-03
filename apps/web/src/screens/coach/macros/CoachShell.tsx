import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

/** Coach layout: skin "legend" (oro/metal) + la pantalla activa + el bottom nav persistente.
 *  El wrapper `.wl--legend` re-skinea todo el coach por token-swap (las pantallas leen var(--wl-*)). */
export function CoachShell() {
  return (
    <div className="wl wl--legend" style={{ minHeight: "100vh", background: "var(--wl-bg)" }}>
      <Outlet />
      <BottomNav />
    </div>
  );
}
