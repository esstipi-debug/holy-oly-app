import { type ComponentProps } from "react";
import type { Competencia, Macrocycle, Plan, SessionLog } from "@holy-oly/core";
import { PlanCalendar } from "../calendar/PlanCalendar";
import { SessionAdherence } from "../sessions/SessionAdherence";
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
  sessionError: boolean;
  today: string;
  sexo: "M" | "F";
  /** Mapea kg derivado → discos lazy; lo provee el shell (memoizado por id). */
  loadHeat: CalProps["loadHeat"];
  loadWeek: CalProps["loadWeek"];
  /** Abre el WeekDetailSheet del shell. */
  onWeekClick: (week: number) => void;
  /** Optimistic toggle del shell (compartido con WeekDetailSheet). */
  onToggle: (week: number, idx: number) => void;
  /** RmSection lo dispara: el shell bumpea rmsStamp (remonta calendario+sesiones) y refetchea plan. */
  onRmsChange: () => void;
  /** Remount key parent-owned: un RM guardado tira el kg cacheado de calendario y sesiones. */
  rmsStamp: number;
};

/** Plan: las superficies de planificación y edición. PlanCalendar y SessionsSection se remontan por
 *  `rmsStamp` cuando se guarda un RM (su kg derivado queda obsoleto). RmSection/PrilepinSection
 *  requieren plan. Superficie coach-only — kg manda, discos vía DiscRow canónico, jamás RPE. */
export function PlanTab({
  athleteId, macro, plan, maxWeek, startDate, hoyWeek, perWeek, comps, sessionLog,
  sessionError, today, sexo, loadHeat, loadWeek, onWeekClick, onToggle, onRmsChange, rmsStamp,
}: Props) {
  return (
    <div>
      {macro && (
        <PlanCalendar
          key={`cal-${rmsStamp}`}
          macro={macro}
          weeks={maxWeek}
          startDate={startDate}
          hoyWeek={hoyWeek}
          comps={comps}
          marks={sessionLog}
          perWeek={perWeek}
          onWeekClick={onWeekClick}
          loadHeat={loadHeat}
          loadWeek={loadWeek}
          sexo={sexo}
          today={today}
        />
      )}

      {macro && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>Planificación · sesiones</div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>tocá: · → ✓ → ✗</span>
          </div>
          {sessionError && <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-danger)", marginTop: 6 }}>No se pudo guardar la sesión. Reintentá.</div>}
          <div style={{ marginTop: 8 }}>
            <SessionAdherence marks={sessionLog} weeks={maxWeek} perWeek={perWeek} onToggle={onToggle} />
          </div>
        </div>
      )}

      <SessionsSection key={`ses-${rmsStamp}`} athleteId={athleteId} hoyWeek={hoyWeek} totalWeeks={maxWeek} />

      {plan && <RmSection athleteId={athleteId} plan={plan} today={today} onRmsChange={onRmsChange} />}

      {/* Vista Prilepin (preview): el motor genera la semana del lift desde los datos reales —
          read-only, coach-only (% + zonas), NO reemplaza el plan de recetas. Requiere plan (RM). */}
      {plan && <PrilepinSection athleteId={athleteId} hoyWeek={hoyWeek} sexo={sexo} />}
    </div>
  );
}
