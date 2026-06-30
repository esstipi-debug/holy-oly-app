import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSkin, setSkin as persistSkin, getVariant, setVariant as persistVariant, type CheckinVariant } from "./prefs";
import { NavIcon } from "./primitives";
// Imported (not "/icon.svg"): Vite inlines it as a data URI, so the logo survives the single-file
// `file://` demo build where an absolute "/icon.svg" path would 404. Benefits the normal build too.
// NOTE: this is a copy of public/icon.svg (which stays as the favicon source for index.html / the
// normal build) — keep the two in sync if the icon ever changes.
import iconUrl from "../../assets/icon.svg";
import { DemoBanner } from "../../ui/DemoBanner";
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

const NAV: Array<{ to: string; labelKey: string; icon: ReactNode; end?: boolean }> = [
  { to: "/atleta", labelKey: "nav.hoy", icon: NavIcon.hoy, end: true },
  { to: "/atleta/progreso", labelKey: "nav.progreso", icon: NavIcon.prog },
  { to: "/atleta/cuenta", labelKey: "nav.cuenta", icon: NavIcon.cuenta },
];

export function AthleteShell() {
  const { t } = useTranslation();
  const [skin, setSkinState] = useState<string>(() => getSkin());
  const [variant, setVariantState] = useState<CheckinVariant>(() => getVariant());

  const setSkin = useCallback((s: string) => { persistSkin(s); setSkinState(s); }, []);
  const setVariant = useCallback((v: CheckinVariant) => { persistVariant(v); setVariantState(v); }, []);

  const ctx = useMemo<AtletaOutletCtx>(() => ({ skin, setSkin, variant, setVariant }), [skin, setSkin, variant, setVariant]);

  return (
    <div className={`ho-shell wl wl--${skin}`}>
      <DemoBanner />
      <header className="ho-hobar">
        <img className="ho-hobar__logo" src={iconUrl} alt="" />
        <div className="ho-hobar__brand">
          <span className="ho-hobar__name">Holy Oly</span>
          <span className="ho-hobar__motto">smart training · zero burnout</span>
        </div>
        <span className="ho-hobar__spacer" />
        <Link to="/atleta/cuenta" className="ho-hobar__avatar" aria-label={t("nav.myAccount")}>
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
            {n.icon}<span>{t(n.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
