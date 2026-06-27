import { type ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Competencia, Macrocycle, Plan, SessionLog } from "@holy-oly/core";
import { Section } from "../../../ui/Section";
import { PlanCalendar } from "../calendar/PlanCalendar";
import { SessionsSection } from "../sessions/SessionsSection";
import { RmSection } from "../rm/RmSection";
import { PrilepinSection } from "../prilepin/PrilepinSection";

type CalProps = ComponentProps<typeof PlanCalendar>;

type Props = {
  athleteId: string;
  macro?: Macrocycle;
  plan?: Plan;
  maxWeek: number;
  startDate: string;
  hoyWeek: number;
  perWeek: number;
  comps: Competencia[];
  sessionLog: SessionLog;
  today: string;
  sexo: "M" | "F";
  /** Mapea kg derivado → discos lazy; lo provee el shell (memoizado por id). */
  loadHeat: CalProps["loadHeat"];
  loadWeek: CalProps["loadWeek"];
  /** RmSection lo dispara: el shell bumpea rmsStamp (remonta calendario+sesiones) y refetchea plan. */
  onRmsChange: () => void;
  /** Remount key parent-owned: un RM guardado tira el kg cacheado de calendario y sesiones. */
  rmsStamp: number;
};

/** Plan: las superficies de planificación y edición, en `Section`s con jerarquía pareja.
 *  Calendario y Sesiones abiertos; RM y Prilepin colapsados (lazy-mount → su fetch se difiere hasta
 *  abrir). PlanCalendar y SessionsSection se remontan por `rmsStamp` cuando se guarda un RM (su kg
 *  derivado queda obsoleto). Superficie coach-only — kg manda, discos vía DiscRow canónico, jamás RPE. */
export function PlanTab({
  athleteId, macro, plan, maxWeek, startDate, hoyWeek, perWeek, comps, sessionLog,
  today, sexo, loadHeat, loadWeek, onRmsChange, rmsStamp,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation("coach");
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Sin macro asignado: cerrar el lazo de onboarding. Los RM se cargan al asignar un macro
          (AssignSheet en el catálogo), no en el drill-down → CTA directo a /coach/macros. */}
      {!macro && (
        <div style={{ padding: "16px 14px", borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, color: "var(--wl-text)" }}>{t("noMacro")}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 6, lineHeight: 1.5 }}>
            {t("noMacroSub")}
          </div>
          <button type="button" onClick={() => navigate(`/coach/macros?atleta=${encodeURIComponent(athleteId)}`)}
            style={{ marginTop: 12, padding: "10px 16px", borderRadius: 10, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
            {t("assignMacro")}
          </button>
        </div>
      )}

      {macro && (
        <Section title={t("secCalendar")} eyebrow={t("secCalendarEyebrow", { weeks: maxWeek, hoy: hoyWeek })}>
          <PlanCalendar
            key={`cal-${rmsStamp}`}
            macro={macro}
            startDate={startDate}
            hoyWeek={hoyWeek}
            comps={comps}
            marks={sessionLog}
            perWeek={perWeek}
            loadHeat={loadHeat}
            loadWeek={loadWeek}
            sexo={sexo}
            today={today}
          />
        </Section>
      )}

      {macro && (
        <Section title={t("secSessions")}>
          <SessionsSection key={`ses-${rmsStamp}`} athleteId={athleteId} hoyWeek={hoyWeek} totalWeeks={maxWeek} />
        </Section>
      )}

      {plan && (
        <Section title={t("secRm")} collapsible defaultOpen={false}>
          <RmSection athleteId={athleteId} plan={plan} today={today} onRmsChange={onRmsChange} />
        </Section>
      )}

      {/* Vista Prilepin (preview): el motor genera la semana del lift desde los datos reales —
          read-only, coach-only (% + zonas), NO reemplaza el plan de recetas. Requiere plan (RM). */}
      {plan && (
        <Section title={t("secPrilepin")} collapsible defaultOpen={false}>
          <PrilepinSection athleteId={athleteId} hoyWeek={hoyWeek} sexo={sexo} />
        </Section>
      )}
    </div>
  );
}
