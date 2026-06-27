import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Macrocycle, SessionView } from "@holy-oly/core";
import { barKgForSexo, dnaForFamily } from "@holy-oly/core";
import { DiscRow } from "../../ui/Disc";
import { signatureGroups, excludedNames } from "../coach/macros/composition";
import type { MeClient } from "../../data/meClient";

interface PhaseLite {
  name: string; from: number; to: number; imrLo: number; imrHi: number; volRel: number; focus: string;
}

const retryStyle: CSSProperties = {
  background: "none", border: "none", color: "var(--wl-accent)", cursor: "pointer",
  fontFamily: "var(--mono)", fontSize: 10.5, padding: 0, textDecoration: "underline",
};
const whyStyle: CSSProperties = {
  background: "none", border: "none", color: "var(--wl-accent)", cursor: "pointer",
  fontFamily: "var(--mono)", fontSize: 10.5, padding: 0, textAlign: "left", textDecoration: "underline",
};

/**
 * Detalle de UNA fase del macro, en lenguaje del atleta — se expande in-place al tocar la card en
 * `PlanDetailSheet`. Re-encuadre (NO es el tablero del coach): «qué vas a trabajar» desde el ADN de
 * la escuela, la semana representativa de la fase con SUS kg+discos reales (vía `/me/sessions`,
 * `DiscRow` oficial), y el % de la fase explicado al tap (HR-2). Sin RPE, sin ACWR, sin falso-verde:
 * dato ausente (sin ADN, sin receta, sin cliente) → la sección se omite, jamás se inventa.
 */
export function PhaseAtletaDetail({ phase, macro, client, sexo, currentWeek }: {
  phase: PhaseLite;
  /** Macro del catálogo (resuelto de `plan.macroId`); null si el plan no trae macroId → se omite el ADN. */
  macro: Macrocycle | null;
  client?: MeClient;
  sexo?: "M" | "F";
  currentWeek: number;
}) {
  const { t } = useTranslation(["atleta", "common"]);
  const dna = macro ? dnaForFamily(macro.family) : undefined;
  const groups = dna ? signatureGroups(dna) : [];
  const excluded = dna ? excludedNames(dna) : [];
  const [showWhy, setShowWhy] = useState(false);

  // Semana representativa de la fase con kg REALES (derivados de los RMs en el server; el RM nunca viaja).
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [sessErr, setSessErr] = useState(false);
  const [tries, setTries] = useState(0); // bump = reintento (re-corre el effect sin oscilar sessErr).
  useEffect(() => {
    if (!client) return;
    let on = true;
    setSessions(null);
    setSessErr(false);
    client.getMeSessions(phase.from)
      .then((v) => { if (on) setSessions(v); })
      .catch(() => { if (on) setSessErr(true); });
    return () => { on = false; };
  }, [client, phase.from, tries]);

  const barKg = barKgForSexo(sexo ?? "M");
  const inPhase = currentWeek >= phase.from && currentWeek <= phase.to;
  const left = phase.to - currentWeek;
  // Sin receta para la fase → semana vacía: se omite la sección ENTERA (sin encabezado huérfano).
  const loadedEmpty = sessions !== null && sessions.length === 0;

  return (
    <div className="ho-plan__phasedetail wl-daydetail-in">
      <div className="ho-plan__detlabel">{t("padAboutPhase")}</div>

      {dna != null && groups.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {/* El `dna.character` es léxico de COACH (espejo del rulebook §Escuelas) — NO va en la
              superficie del atleta (El Carnicero §1, lente). Los chips de abajo ya comunican el método. */}
          <div className="ho-plan__deth">{t("padWhatYouWillWork")}</div>
          {groups.map((g) => (
            <div key={g.slot} style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "baseline", marginTop: 5 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", minWidth: 80 }}>{g.label}</span>
              {g.names.map((n) => <span key={n} className="ho-plan__chip">{n}</span>)}
            </div>
          ))}
          {excluded.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "baseline", marginTop: 8 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", minWidth: 80 }}>{t("padLeavesOut")}</span>
              {excluded.map((n) => <span key={n} className="ho-plan__chip ho-plan__chip--out">{n}</span>)}
            </div>
          )}
        </div>
      )}

      {client != null && !loadedEmpty && (
        <div style={{ marginBottom: 12 }}>
          <div className="ho-plan__deth">{t("padTypicalTrainingLook")}</div>
          {sessErr ? (
            <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 4 }}>
              {t("padWeekLoadError")} <button type="button" onClick={() => setTries((t) => t + 1)} style={retryStyle}>{t("common:retry")}</button>
            </div>
          ) : sessions === null ? (
            <div role="status" aria-busy="true" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 4 }}>{t("padLoadingSessions")}</div>
          ) : (
            <>
              {sessions.map((s) => (
                <div key={s.sessionIdx} style={{ marginTop: 7 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)" }}>{t("padDayN", { n: s.sessionIdx + 1 })}</div>
                  {s.exercises.map((e, i) => (
                    <div key={`${e.movementName}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12, color: "var(--wl-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.movementName}</div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)" }}>{e.sets}×{e.reps}</div>
                      </div>
                      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13.5, color: "var(--wl-text)", fontVariantNumeric: "tabular-nums" }}>
                          {e.targetKg != null ? `${e.targetKg} kg` : e.pct == null ? "—" : null}
                          {e.pct != null && <span style={{ fontSize: e.targetKg != null ? 10 : 13.5, color: "var(--wl-accent)", fontWeight: 700, marginLeft: e.targetKg != null ? 4 : 0 }}>{e.pct}%</span>}
                        </span>
                        {e.targetKg != null && <DiscRow kg={e.targetKg} barKg={barKg} />}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", marginTop: 7, lineHeight: 1.5 }}>
                {t("padPlanWeekNote", { week: phase.from })}
              </div>
            </>
          )}
        </div>
      )}

      <button type="button" onClick={() => setShowWhy((v) => !v)} style={whyStyle} aria-expanded={showWhy}>
        {t("padWhatItMeans", { lo: phase.imrLo, hi: phase.imrHi })}
      </button>
      {showWhy && (
        <div role="status" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 5, lineHeight: 1.55 }}>
          {t("padWhatItMeansExplain")}
        </div>
      )}

      {inPhase && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 10 }}>
          {t("padInPhaseWeek", { week: currentWeek, left })}
        </div>
      )}
    </div>
  );
}
