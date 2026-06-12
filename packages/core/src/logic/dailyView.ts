import type { AthleteDailyView, DailyCheckin, PlannedSession, SessionActual, SessionMark } from "../types";
import { MACROCYCLES } from "../data/macrocycles";
import { defaultStartDate, weekOfDate } from "./schedule";
import { reconcileAdherence } from "./adherence";

// ── Día a día (slice lazo-diario). CRITERIO ÚNICO de la ventana/dedup/reconciliación del lazo
//    diario atleta→coach, compartido por el repo Http (apps/api) y el Local (apps/web). Antes
//    estaba duplicado a mano en ambos; si driftaba, el coach veía adherencias distintas según el
//    backend. Función PURA: el caller pasa las colecciones ya fetchadas. El ciclo JAMÁS sale por
//    acá (sigue por su endpoint redactado). Sin RPE. Sin dato → none/[] honesto. ──

/** Ventana por defecto del día a día, en semanas (≈ 2 mesociclos). */
export const DAILY_WINDOW_WEEKS = 8;

const DAY_MS = 86_400_000;

/** Inicio (inclusive) de la ventana de check-ins: `today` − `windowWeeks`*7 días, ISO UTC. */
export function dailyFromDate(today: string, windowWeeks: number = DAILY_WINDOW_WEEKS): string {
  return new Date(new Date(`${today}T00:00:00Z`).getTime() - windowWeeks * 7 * DAY_MS)
    .toISOString().slice(0, 10);
}

/** Una fila cruda de check-in diario (los 6 ítems 1..5 + peso opcional + fecha). */
export interface DailyLogRow {
  date: string;
  fatiga: number; dolor: number; estres: number; humor: number; motivacion: number; sueno: number;
  weight?: number;
}

/** Coordenada cruda de la prescripción (basta la ubicación de sesión para deduplicar). */
export interface DailyPrescriptionRow { week: number; sessionIdx: number }

/** Insumos ya fetchados para armar la vista del día a día. */
export interface DailyViewInput {
  today: string;
  windowWeeks?: number;
  /** El macro asignado del plan, o `null` si no hay plan. */
  macroId: string | null;
  /** startDate real del plan (M5) o `null`/ausente → fallback que ancla hoy a la semana actual. */
  startDate?: string | null;
  dayLogs: ReadonlyArray<DailyLogRow>;
  prescription: ReadonlyArray<DailyPrescriptionRow>;
  actuals: ReadonlyArray<SessionActual>;
  marks: ReadonlyArray<SessionMark>;
}

function totalWeeksOf(macroId: string | null): number {
  if (macroId == null) return 0;
  const macro = MACROCYCLES.find((m) => m.id === macroId);
  return macro ? (macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0) : 0;
}

/**
 * Vista coach del lazo diario: los check-ins crudos del atleta de la ventana + la adherencia
 * RECONCILIADA (atleta > coach > none) de las semanas recientes del plan.
 *
 * Los check-ins son independientes del plan (se devuelven aunque no haya plan asignado); la
 * adherencia es `[]` sin plan/macro (honesto). Mismo criterio exacto que tenían los dos repos:
 *   - ventana de check-ins: `date >= fromDate` (fromDate = today − windowWeeks*7d), orden asc.
 *   - ventana de semanas: `[max(1, currentWeek-windowWeeks+1) .. currentWeek]`.
 *   - sesiones planificadas: (week, sessionIdx) DISTINTAS dentro de la ventana, ordenadas.
 */
export function buildDailyView(input: DailyViewInput): AthleteDailyView {
  const { today, macroId, dayLogs, prescription, actuals, marks } = input;
  const windowWeeks = input.windowWeeks ?? DAILY_WINDOW_WEEKS;
  const fromDate = dailyFromDate(today, windowWeeks);

  // Check-ins crudos del atleta en la ventana (independientes del plan; orden cronológico asc).
  const checkins: DailyCheckin[] = dayLogs
    .filter((c) => c.date >= fromDate)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => ({
      date: c.date, fatiga: c.fatiga, dolor: c.dolor, estres: c.estres,
      humor: c.humor, motivacion: c.motivacion, sueno: c.sueno, weight: c.weight,
    }));

  const totalWeeks = totalWeeksOf(macroId);
  if (totalWeeks === 0) return { today, fromDate, checkins, adherence: [] };

  // La semana del plan que cae HOY ancla la ventana [fromWeek..currentWeek]. startDate real (M5)
  // o el fallback que ancla hoy a la semana de la serie (mismo criterio que el drill-down).
  const startDate = input.startDate ?? defaultStartDate(today, totalWeeks);
  const currentWeek = weekOfDate(startDate, today, totalWeeks);
  const fromWeek = Math.max(1, currentWeek - windowWeeks + 1);
  const inWindow = (week: number): boolean => week >= fromWeek && week <= currentWeek;

  // Sesiones planificadas = (week, sessionIdx) DISTINTAS de la prescripción dentro de la ventana.
  const seen = new Set<string>();
  const planned: PlannedSession[] = [];
  for (const r of prescription) {
    if (!inWindow(r.week)) continue;
    const key = `${r.week}:${r.sessionIdx}`;
    if (seen.has(key)) continue;
    seen.add(key);
    planned.push({ week: r.week, idx: r.sessionIdx });
  }
  planned.sort((a, b) => (a.week - b.week) || (a.idx - b.idx));

  const windowedActuals = actuals.filter((a) => inWindow(a.week));
  const windowedMarks = marks.filter((m) => inWindow(m.week));
  return { today, fromDate, checkins, adherence: reconcileAdherence(planned, windowedActuals, windowedMarks) };
}
