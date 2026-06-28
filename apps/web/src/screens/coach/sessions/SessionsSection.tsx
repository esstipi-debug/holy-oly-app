import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { PrescribedExercise, RM, SessionView } from "@holy-oly/core";
import { kgDeviation } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { SessionEditor } from "./SessionEditor";
import { ComplexAnalysis } from "./ComplexAnalysis";
import { RetryButton } from "../../../ui/RetryButton";

const sec: CSSProperties = { fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--wl-muted)", margin: "22px 0 10px" };
const card: CSSProperties = { background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "10px 12px", marginTop: 8 };
const noteStyle: CSSProperties = { fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 2, fontStyle: "italic" };

const DEVIATION_MARKER: Record<"none" | "igual" | "mas" | "menos", string> = {
  none: "",
  igual: "=",
  mas: "↑",
  menos: "↓",
};

function load(targetKg: number | undefined): string {
  return targetKg != null ? `${targetKg} kg` : "—";
}

export function SessionsSection({ athleteId, hoyWeek, totalWeeks }: { athleteId: string; hoyWeek: number; totalWeeks: number }) {
  const repo = useRepository();
  const { t } = useTranslation(["coach", "common"]);
  const [week, setWeek] = useState(Math.min(Math.max(hoyWeek, 1), totalWeeks));
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  // RMs vigentes del plan — base del eslabón débil del complejo (sin plan → sin kg, oculto honesto).
  const [rms, setRms] = useState<RM | undefined>(undefined);
  const [editing, setEditing] = useState<SessionView | null>(null);
  // Error ≠ vacío (D5): un fallo de carga no puede mostrarse como "Sin sesiones".
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  const refresh = useCallback(() => setReload((r) => r + 1), []);

  // El fetch vive en el effect con guard `on`: cambiar de semana rápido cancela la respuesta
  // en vuelo (ni setSessions ni setError de una semana vieja pisan a la vigente).
  useEffect(() => {
    let on = true;
    setSessions(null);
    setError(false);
    repo.getPrescriptionWeek(athleteId, week)
      .then((s) => { if (on) setSessions(s); })
      .catch(() => { if (on) setError(true); });
    return () => { on = false; };
  }, [repo, athleteId, week, reload]);

  // RMs del plan (para el eslabón débil del complejo). Independiente de la semana; fallo silencioso
  // → el análisis cae a sólo carga/complejidad (kg oculto), nunca un kg inventado.
  useEffect(() => {
    let on = true;
    repo.getPlan(athleteId).then((p) => { if (on) setRms(p?.rms); }, () => { if (on) setRms(undefined); });
    return () => { on = false; };
  }, [repo, athleteId, reload]);

  const onSave = useCallback(async (exercises: PrescribedExercise[]) => {
    if (!editing) return;
    await repo.setSession(athleteId, editing.week, editing.sessionIdx, exercises);
    setEditing(null);
    refresh();
  }, [repo, athleteId, editing, refresh]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={sec}>{t("secSessions")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
          <button type="button" aria-label={t("sesPrevWeek")} onClick={() => setWeek((w) => Math.max(1, w - 1))} style={{ border: 0, background: "transparent", color: "var(--wl-text)", cursor: "pointer", fontSize: 16 }}>‹</button>
          {t("sesWeekNav", { week })}
          <button type="button" aria-label={t("sesNextWeek")} onClick={() => setWeek((w) => Math.min(totalWeeks, w + 1))} style={{ border: 0, background: "transparent", color: "var(--wl-text)", cursor: "pointer", fontSize: 16 }}>›</button>
        </div>
      </div>
      {error ? (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>
          {t("sesLoadError")}{" "}
          <RetryButton onClick={refresh} />
        </div>
      ) : sessions === null ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>{t("common:loading")}</div>
      ) : sessions.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>{t("sesEmpty")}</div>
      ) : (
        sessions.map((s) => (
          <div key={s.sessionIdx} style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
                <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: "var(--wl-text)" }}>{t("previewDay", { n: s.day ?? s.sessionIdx + 1 })}{s.turno ? ` · ${s.turno}` : ""}</span>
                {s.fecha && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginLeft: 8 }}>{t("sesRegisteredOn", { fecha: s.fecha })}</span>
                )}
              </div>
              <button type="button" aria-label={t("sesEditAria", { n: s.sessionIdx + 1 })} onClick={() => setEditing(s)} style={{ border: 0, background: "transparent", color: "var(--wl-accent)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11 }}>{t("sesEditBtn")}</button>
            </div>
            {s.exercises.map((e, i) => {
              const dev = e.actual?.done ? kgDeviation(e.targetKg, e.actual.kg) : "none";
              const marker = DEVIATION_MARKER[dev];
              return (
                <div key={i} style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
                    <span style={{ color: "var(--wl-text)" }}>{e.movementName}</span>
                    <span>
                      {e.sets}×{e.reps} · {load(e.targetKg)}
                      {e.actual?.desfasado ? (
                        <span style={{ color: "var(--wl-muted)" }}>{" · "}{t("sesDesfasado", { name: e.actual.movementName, kg: e.actual.kg != null ? ` ${e.actual.kg} kg` : "" })}</span>
                      ) : e.actual?.substituted ? (
                        <span style={{ color: "var(--wl-accent)" }}>{" · "}{t("sesReal", { name: e.actual.movementName, kg: e.actual.kg != null ? ` ${e.actual.kg} kg` : "" })}{t("sesSubstituted")}</span>
                      ) : e.actual?.done && e.actual.kg != null ? (
                        <span style={{ color: "var(--wl-accent)" }}>{" · "}{t("sesRealKg", { kg: e.actual.kg, marker })}</span>
                      ) : e.actual && !e.actual.done ? (
                        <span style={{ color: "var(--wl-muted)" }}>{" · "}{t("sesNotDone")}</span>
                      ) : null}
                    </span>
                  </div>
                  {e.actual?.note && (
                    <div style={noteStyle}>📝 {e.actual.note}</div>
                  )}
                  <ComplexAnalysis movementId={e.movementId} rms={rms} />
                </div>
              );
            })}
          </div>
        ))
      )}
      {editing && (
        <SessionEditor open week={editing.week} sessionIdx={editing.sessionIdx} exercises={editing.exercises} rms={rms} onClose={() => setEditing(null)} onSave={onSave} />
      )}
    </div>
  );
}
