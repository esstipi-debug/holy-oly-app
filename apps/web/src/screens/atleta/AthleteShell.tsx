import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useOutletContext } from "react-router-dom";
import { getSkin, setSkin as persistSkin, getVariant, setVariant as persistVariant, type CheckinVariant } from "./prefs";
import { NavIcon } from "./primitives";
import "./atleta.css";

export interface AtletaOutletCtx {
  skin: string;
  setSkin: (s: string) => void;
  variant: CheckinVariant;
  setVariant: (v: CheckinVariant) => void;
}

/** Typed accessor for the athlete shell's Outlet context (skin + check-in variant). */
export function useAtletaCtx(): AtletaOutletCtx {
  return useOutletContext<AtletaOutletCtx>();
}

const NAV: Array<{ to: string; label: string; icon: ReactNode; end?: boolean }> = [
  { to: "/atleta", label: "Hoy", icon: NavIcon.hoy, end: true },
  { to: "/atleta/progreso", label: "Mi progreso", icon: NavIcon.prog },
  { to: "/atleta/cuenta", label: "Cuenta", icon: NavIcon.cuenta },
];

export function AthleteShell() {
  const [skin, setSkinState] = useState<string>(() => getSkin());
  const [variant, setVariantState] = useState<CheckinVariant>(() => getVariant());

  const setSkin = useCallback((s: string) => { persistSkin(s); setSkinState(s); }, []);
  const setVariant = useCallback((v: CheckinVariant) => { persistVariant(v); setVariantState(v); }, []);

  const ctx = useMemo<AtletaOutletCtx>(() => ({ skin, setSkin, variant, setVariant }), [skin, setSkin, variant, setVariant]);

  return (
    <div className={`ho-shell wl wl--${skin}`}>
      <header className="ho-hobar">
        <img className="ho-hobar__logo" src="/icon.svg" alt="" />
        <div className="ho-hobar__brand">
          <span className="ho-hobar__name">Holy Oly</span>
          <span className="ho-hobar__motto">smart training · zero burnout</span>
        </div>
        <span className="ho-hobar__spacer" />
        <Link to="/atleta/cuenta" className="ho-hobar__avatar" aria-label="Mi cuenta">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.4" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
          </svg>
        </Link>
      </header>

      <main className="ho-scroll">
        <Outlet context={ctx} />
      </main>

      <nav className="ho-nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => "ho-nav__btn" + (isActive ? " is-on" : "")}>
            {n.icon}<span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
