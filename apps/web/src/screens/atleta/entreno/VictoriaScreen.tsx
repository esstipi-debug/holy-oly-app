import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import type { MePlanView, SessionView, MeRecorrido, DayLog, MonitorSeries } from "@holy-oly/core";
import { sessionTonnage, completion } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { xpForSession, cumulativeXp, levelInfo, weekStreak, highestTier } from "./celebracion/gamify";
import { buildWellnessRadar } from "./celebracion/radarData";
import { Celebracion, type CelData, type CelLift, type CelStat } from "./celebracion/Celebracion";

type LoadState = "loading" | "ready" | "error";
const fmtTon = (kg: number): string => (kg >= 1000 ? `${(kg / 1000).toFixed(1).replace(".", ",")} t` : `${Math.round(kg)} kg`);
const costToReach = (level: number): number => 100 * level * (level - 1);

/**
 * A4 · celebración tras guardar un entreno (rediseño 0110, gamificación DERIVADA). Re-lee la sesión
 * guardada + recorrido + macro-history y arma la celebración del mayor alcance logrado (Día/Semana/
 * Macro). XP/nivel/racha calculados (sin backend). Sin trabajo marcado → "Sesión registrada" sobria.
 */
export function VictoriaScreen() {
  const { t } = useTranslation(["atleta", "common", "domain"]);
  const { week: weekP, idx: idxP } = useParams();
  const navigate = useNavigate();
  const week = Number(weekP);
  const idx = Number(idxP);

  const [plan, setPlan] = useState<MePlanView | null>(null);
  const [session, setSession] = useState<SessionView | undefined>(undefined);
  const [recorrido, setRecorrido] = useState<MeRecorrido | null>(null);
  const [dayLog, setDayLog] = useState<DayLog | null>(null);
  const [series, setSeries] = useState<MonitorSeries | undefined>(undefined);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!Number.isInteger(week) || !Number.isInteger(idx)) { navigate("/atleta", { replace: true }); return; }
    let on = true;
    // Recorrido / check-in / serie son independientes: un fallo no tumba la celebración (la
    // gamificación cae a su default; el radar de bienestar cae a su empty-state honesto).
    const recP = me.getMeRecorrido().then((r) => r as MeRecorrido | null, () => null);
    const dayP = me.getDayLog().then((d) => d.entry, () => null);
    const serP = me.getMeSeries().then((s) => s, () => undefined);
    Promise.all([me.getMePlan(), me.getMeSessions(week)])
      .then(async ([p, views]: [MePlanView, SessionView[]]) => {
        if (!on) return;
        const s = views.find((v) => v.sessionIdx === idx);
        if (!s) { setState("error"); return; }
        setPlan(p); setSession(s);
        setRecorrido(await recP); setDayLog(await dayP); setSeries(await serP);
        setState("ready");
      })
      .catch(() => { if (on) setState("error"); });
    return () => { on = false; };
  }, [week, idx, navigate]);

  if (state === "loading") return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>{t("common:loading")}</div>;
  if (state === "error" || !session || !plan) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>{t("vicLoadError")}</div>
        <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 14 }} onClick={() => navigate("/atleta")}>{t("common:backToHome")}</button>
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
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 26, textTransform: "uppercase", color: "var(--wl-text)" }}>{t("vicSessionLogged")}</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 8, lineHeight: 1.5 }}>{t("vicDay", { day: session.day ?? idx + 1 })}{session.turno ? ` · ${session.turno}` : ""}{t("vicNoSetsMarked")}</div>
        <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 16 }} onClick={onClaim}>{t("vicDone")}</button>
        <button type="button" className="wl-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => navigate("/atleta", { state: { openCheckin: true } })}>{t("vicLogWellness")}</button>
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
  const tag = streakWeeks >= 4 ? t("vicTagUnstoppable") : streakWeeks >= 2 ? t("vicTagConsistent") : t("vicTagOnTrack");

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
        { v: `${recWeek.sesionesHechas}/${recWeek.sesionesTotales}`, l: t("vicStatDays") },
        { v: `${recWeek.sesionesTotales > 0 ? Math.round((recWeek.sesionesHechas / recWeek.sesionesTotales) * 100) : 0}%`, l: t("vicStatCompliance") },
        { v: fmtTon(wkVol), l: t("vicStatVolume") },
      ]
    : [];

  // Macro
  const macroVol = semanas.reduce((a, s) => a + s.trabajoKg + s.calentamientoKg, 0);
  const macroSesiones = semanas.reduce((a, s) => a + s.sesionesHechas, 0);
  const macroTotales = semanas.reduce((a, s) => a + s.sesionesTotales, 0);
  const macroStats: CelStat[] = [
    { v: `${planV?.totalWeeks ?? semanas.length}/${planV?.totalWeeks ?? semanas.length}`, l: t("vicStatWeeks") },
    { v: fmtTon(macroVol), l: t("vicStatVolume") },
    { v: `${planV?.phases.length ?? 0}`, l: `${t("vicStatPhases")} ✓` },
    { v: t("vicLevelAbbr", { level: lvl.level }), l: t("vicStatLevel") },
    { v: `${macroSesiones}`, l: t("vicStatSessions") },
    { v: `${macroTotales > 0 ? Math.round((macroSesiones / macroTotales) * 100) : 0}%`, l: t("vicStatComplianceShort") },
  ];

  // Proyección del dominio por id estable (macroId + phase.key / currentPhaseKey). Fallback al texto
  // horneado en el wire (ES) sólo sin macroId (buildMePlanView siempre lo setea).
  const mid = planV?.macroId;
  const macroNm = mid ? t(`domain:macro.${mid}.name`) : (planV?.macroName ?? t("vicMacroFallback"));
  const currentPhaseName = mid ? t(`domain:macro.${mid}.phase.${planV?.currentPhaseKey ?? ""}.name`) : (planV?.currentPhase ?? "");
  const phaseNames: string[] = mid
    ? (planV?.phases ?? []).map((p) => t(`domain:macro.${mid}.phase.${p.key}.name`))
    : (planV?.phases.map((p) => p.name) ?? []);

  const data: CelData = {
    tiers: [...tierList],
    barKg,
    radar: buildWellnessRadar(dayLog, series), // hoy (check-in) vs promedio (ítems semanales); null → empty-state
    streakWeeks,
    level: lvl.level, nextLevel: lvl.nextLevel, xpToNext: lvl.xpToNext, xpFromPct: fromPct, xpToPct: toPct, tag,
    diaMeta: `${t("vicDiaMeta", { week, day: session.day ?? idx + 1 })}${session.turno ? ` · ${session.turno}` : ""}`,
    lifts, diaXp, diaTotalKg: tonnage, diaSets,
    week, weekMeta: `${currentPhaseName}${currentPhaseName ? " · " : ""}${t("vicWeekMeta", { count: recWeek?.sesionesHechas ?? 0 })}`, weekStats, weekXp,
    macroName: macroNm, macroMeta: t("vicMacroMeta", { count: planV?.totalWeeks ?? semanas.length }),
    macroStats, phases: phaseNames, macroXp: cumXp,
    onClaim,
  };

  return (
    <div>
      <Celebracion data={data} />
      <button type="button" className="wl-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => navigate("/atleta", { state: { openCheckin: true } })}>{t("vicLogWellness")}</button>
    </div>
  );
}
