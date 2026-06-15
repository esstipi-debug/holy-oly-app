import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { MePlanView, SessionView, MeRecorrido } from "@holy-oly/core";
import { sessionTonnage, completion } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { xpForSession, cumulativeXp, levelInfo, weekStreak, highestTier } from "./celebracion/gamify";
import { Celebracion, type CelData, type CelLift, type CelStat } from "./celebracion/Celebracion";

type LoadState = "loading" | "ready" | "error";
const CL = (n: number): string => n.toLocaleString("es-CL");
const fmtTon = (kg: number): string => (kg >= 1000 ? `${(kg / 1000).toFixed(1).replace(".", ",")} t` : `${Math.round(kg)} kg`);
const costToReach = (level: number): number => 100 * level * (level - 1);

/**
 * A4 · celebración tras guardar un entreno (rediseño 0110, gamificación DERIVADA). Re-lee la sesión
 * guardada + recorrido + macro-history y arma la celebración del mayor alcance logrado (Día/Semana/
 * Macro). XP/nivel/racha calculados (sin backend). Sin trabajo marcado → "Sesión registrada" sobria.
 */
export function VictoriaScreen() {
  const { week: weekP, idx: idxP } = useParams();
  const navigate = useNavigate();
  const week = Number(weekP);
  const idx = Number(idxP);

  const [plan, setPlan] = useState<MePlanView | null>(null);
  const [session, setSession] = useState<SessionView | undefined>(undefined);
  const [recorrido, setRecorrido] = useState<MeRecorrido | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!Number.isInteger(week) || !Number.isInteger(idx)) { navigate("/atleta", { replace: true }); return; }
    let on = true;
    // El recorrido es independiente: un fallo no debe tumbar la celebración (cae a sin-gamificación).
    const recP = me.getMeRecorrido().then((r) => r as MeRecorrido | null, () => null);
    Promise.all([me.getMePlan(), me.getMeSessions(week)])
      .then(async ([p, views]: [MePlanView, SessionView[]]) => {
        if (!on) return;
        const s = views.find((v) => v.sessionIdx === idx);
        if (!s) { setState("error"); return; }
        setPlan(p); setSession(s); setRecorrido(await recP); setState("ready");
      })
      .catch(() => { if (on) setState("error"); });
    return () => { on = false; };
  }, [week, idx, navigate]);

  if (state === "loading") return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>Cargando…</div>;
  if (state === "error" || !session || !plan) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>No pudimos cargar el resumen</div>
        <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 14 }} onClick={() => navigate("/atleta")}>Volver al inicio</button>
      </div>
    );
  }

  const exercises = session.exercises;
  const comp = completion(exercises);
  const didWork = comp.done > 0;
  const onClaim = (): void => {
    try { localStorage.setItem(`ho:cel-seen:${week}-${idx}`, "1"); } catch { /* noop */ }
    navigate("/atleta");
  };

  // Sin trabajo marcado → no hay celebración: registro sobrio y honesto.
  if (!didWork) {
    return (
      <div style={{ padding: "4px 2px" }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 26, textTransform: "uppercase", color: "var(--wl-text)" }}>Sesión registrada</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 8, lineHeight: 1.5 }}>Día {session.day ?? idx + 1}{session.turno ? ` · ${session.turno}` : ""} — sin series marcadas. Cuando marques tus series, las celebramos.</div>
        <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 16 }} onClick={onClaim}>Listo</button>
        <button type="button" className="wl-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => navigate("/atleta", { state: { openCheckin: true } })}>Registrar bienestar</button>
      </div>
    );
  }

  // ── Derivaciones (gamify) ───────────────────────────────────────────────
  const planV = plan.plan;
  const barKg = 20; // los discos aproximan; el kg manda (DiscRow usa el real por sexo vía perSide)
  const tonnage = sessionTonnage(exercises);
  const allDone = comp.total > 0 && comp.done === comp.total;
  const diaXp = xpForSession(tonnage, allDone);
  const diaSets = exercises.reduce((a, e) => a + (e.actual?.sets?.filter((s) => s.done).length ?? 0), 0);

  const lifts: CelLift[] = exercises.map((e) => {
    const done = e.actual?.sets?.filter((s) => s.done) ?? [];
    const top = done.length ? Math.max(...done.map((s) => s.kg ?? 0)) : (e.targetKg ?? 0);
    return { nm: e.actual?.movementName ?? e.movementName, top, sets: done.length || e.sets, reps: done[0]?.reps ?? e.reps, ...(e.pct != null ? { pct: e.pct } : {}) };
  });

  const semanas = recorrido?.semanas ?? [];
  const cumXp = cumulativeXp(semanas);
  const lvl = levelInfo(cumXp);
  const currentWeek = planV?.currentWeek ?? week;
  const streakWeeks = weekStreak(semanas, currentWeek);
  const tag = streakWeeks >= 4 ? "Imparable" : streakWeeks >= 2 ? "Constante" : "En marcha";

  const lvlStart = costToReach(lvl.level);
  const span = Math.max(1, costToReach(lvl.nextLevel) - lvlStart);
  const toPct = Math.max(0, Math.min(100, ((cumXp - lvlStart) / span) * 100));
  const fromPct = Math.max(0, Math.min(toPct, ((cumXp - diaXp - lvlStart) / span) * 100));

  const recWeek = semanas.find((s) => s.week === week);
  const weekClosed = !!recWeek && recWeek.sesionesTotales > 0 && recWeek.sesionesHechas >= recWeek.sesionesTotales;
  const macroClosed = planV?.totalWeeks != null && week >= planV.totalWeeks && weekClosed;
  const tiers = highestTier(weekClosed, !!macroClosed);
  const tierList = tiers === "macro" ? ["dia", "semana", "macro"] as const
    : tiers === "semana" ? ["dia", "semana"] as const
    : ["dia"] as const;

  // Semana
  const wkVol = recWeek ? recWeek.trabajoKg + recWeek.calentamientoKg : 0;
  const weekXp = recWeek ? Math.floor(recWeek.trabajoKg / 50) : 0;
  const weekStats: CelStat[] = recWeek
    ? [
        { v: `${recWeek.sesionesHechas}/${recWeek.sesionesTotales}`, l: "días" },
        { v: `${recWeek.sesionesTotales > 0 ? Math.round((recWeek.sesionesHechas / recWeek.sesionesTotales) * 100) : 0}%`, l: "cumplimiento" },
        { v: fmtTon(wkVol), l: "volumen" },
      ]
    : [];

  // Macro
  const macroVol = semanas.reduce((a, s) => a + s.trabajoKg + s.calentamientoKg, 0);
  const macroSesiones = semanas.reduce((a, s) => a + s.sesionesHechas, 0);
  const macroTotales = semanas.reduce((a, s) => a + s.sesionesTotales, 0);
  const macroStats: CelStat[] = [
    { v: `${planV?.totalWeeks ?? semanas.length}/${planV?.totalWeeks ?? semanas.length}`, l: "semanas" },
    { v: fmtTon(macroVol), l: "volumen" },
    { v: `${planV?.phases.length ?? 0}`, l: "fases ✓" },
    { v: `Nv ${lvl.level}`, l: "nivel" },
    { v: `${macroSesiones}`, l: "sesiones" },
    { v: `${macroTotales > 0 ? Math.round((macroSesiones / macroTotales) * 100) : 0}%`, l: "cumplim." },
  ];

  const data: CelData = {
    tiers: [...tierList],
    barKg,
    radar: null, // v1: el radar de bienestar necesita ítems del check-in diario (hueco de datos) → empty-state
    streakWeeks,
    level: lvl.level, nextLevel: lvl.nextLevel, xpToNext: lvl.xpToNext, xpFromPct: fromPct, xpToPct: toPct, tag,
    diaMeta: `Semana ${week} · Día ${session.day ?? idx + 1}${session.turno ? ` · ${session.turno}` : ""}`,
    lifts, diaXp, diaTotalKg: tonnage, diaSets,
    week, weekMeta: `${planV?.currentPhase ?? ""}${planV?.currentPhase ? " · " : ""}${recWeek?.sesionesHechas ?? 0} entrenos registrados`, weekStats, weekXp,
    macroName: planV?.macroName ?? "Macro", macroMeta: `${planV?.totalWeeks ?? semanas.length} semanas · listo para competir`,
    macroStats, phases: planV?.phases.map((p) => p.name) ?? [], macroXp: cumXp,
    onClaim,
  };

  return (
    <div>
      <Celebracion data={data} />
      <button type="button" className="wl-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => navigate("/atleta", { state: { openCheckin: true } })}>Registrar bienestar</button>
    </div>
  );
}
