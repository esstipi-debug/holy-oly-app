/**
 * Mi Progreso · mapa de calor de calendario por día (rediseño 0110). Arma una grilla de semanas
 * (lunes-first, la última con HOY) con un dato REAL por día, conectando fuentes que ya existen —
 * sin migración ni captura nueva:
 *   · carga      → kg de trabajo del día (de SessionActual.doneAt)
 *   · bienestar  → score 0–100 del día (de los 6 ítems de DayLog)
 *   · peso       → peso del día (de DayLog.weight) vs la banda de categoría
 *   · recuperación → HRV/FC SEMANAL del macro mapeada al calendario (honesto: el dato es semanal,
 *     no inventamos diario). Fuera del macro → sin dato (gris).
 * El nivel/color y el texto de detalle por señal viven en el cliente (presentación); el core sólo
 * provee las celdas crudas + las bases. Pura y determinística (recibe "today"). NUNCA expone RPE.
 */
import { calendarWeeks, weekOfDate } from "./schedule";

const DAY = 86_400_000;
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Una celda-día del mapa. Los valores nulos = sin registro ese día (gris honesto, no se inventa). */
export interface HeatDayCell {
  iso: string;
  future: boolean;
  today: boolean;
  trained: boolean;
  kg: number;
  sessions: number;
  wellness: number | null; // 0..100 del DayLog
  bw: number | null;       // peso corporal del día
  hrv: number | null;      // HRV semanal del macro mapeada a este día
  rhr: number | null;      // FC reposo semanal
  comp?: { name: string; note: string };
}
/** Una fila = una semana calendario (7 días lunes-first). */
export interface HeatWeekRow { startIso: string; days: HeatDayCell[] }
/** Vista de /me/heatdays: la grilla + índices de ventana + bases para leer cada señal. */
export interface MeHeatDays {
  today: string;
  weeks: HeatWeekRow[];
  anchorWeekIdx: number; // fila que contiene HOY (= weeks.length-1)
  macroFromIdx: number;  // primera fila dentro del macro (-1 si no hay macro)
  macroToIdx: number;    // última fila dentro del macro (-1 si no hay macro)
  weightBand?: [number, number];
  category?: string;
  hrvBase?: number;
  rhrBase?: number;
  wellnessMean?: number;
  wellnessStd?: number;
}

export interface HeatDayInput {
  today: string;
  weeksBack?: number; // ventana "Año" (default 53)
  startDate?: string; // ancla del macro
  totalWeeks?: number;
  /** por fecha ISO → { kg de trabajo, nº de sesiones } */
  training?: Record<string, { kg: number; sessions: number }>;
  /** check-in por día: score de bienestar 0–100 + peso opcional */
  daylogs?: { date: string; wellness: number; bw: number | null }[];
  /** competencias con fecha */
  comps?: { iso: string; name: string; note: string }[];
  /** arrays SEMANALES del macro (índice = semana-1) */
  weekly?: { hrv?: number[]; rhr?: number[] };
  hrvBase?: number;
  rhrBase?: number;
  weightBand?: [number, number];
  category?: string;
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function buildMeHeatDays(input: HeatDayInput): MeHeatDays {
  const weeksBack = input.weeksBack ?? 53;
  const grid = calendarWeeks(input.today, weeksBack); // string[][], última fila contiene HOY
  const todayMs = ms(input.today);

  const training = input.training ?? {};
  const dayMap = new Map<string, { wellness: number; bw: number | null }>();
  for (const d of input.daylogs ?? []) dayMap.set(d.date, { wellness: d.wellness, bw: d.bw });
  const compMap = new Map<string, { name: string; note: string }>();
  for (const c of input.comps ?? []) compMap.set(c.iso, { name: c.name, note: c.note });

  const hasMacro = input.startDate != null && input.totalWeeks != null && input.totalWeeks > 0;
  const macroStartMs = hasMacro ? ms(input.startDate!) : 0;
  const macroEndMs = hasMacro ? macroStartMs + input.totalWeeks! * 7 * DAY : 0;

  const weeks: HeatWeekRow[] = grid.map((row) => ({
    startIso: row[0]!,
    days: row.map((iso) => {
      const dms = ms(iso);
      const future = dms > todayMs;
      const tr = training[iso];
      const dl = dayMap.get(iso);
      let hrv: number | null = null;
      let rhr: number | null = null;
      if (hasMacro && !future && dms >= macroStartMs && dms < macroEndMs) {
        const w = weekOfDate(input.startDate!, iso, input.totalWeeks!);
        const h = input.weekly?.hrv?.[w - 1];
        const r = input.weekly?.rhr?.[w - 1];
        hrv = isNum(h) ? h : null;
        rhr = isNum(r) ? r : null;
      }
      const cell: HeatDayCell = {
        iso,
        future,
        today: iso === input.today,
        trained: !future && tr != null && tr.kg > 0,
        kg: tr?.kg ?? 0,
        sessions: tr?.sessions ?? 0,
        wellness: dl ? dl.wellness : null,
        bw: dl ? dl.bw : null,
        hrv,
        rhr,
      };
      const comp = compMap.get(iso);
      if (comp) cell.comp = comp;
      return cell;
    }),
  }));

  // Índices de las filas que solapan el macro (para la ventana "Macro").
  let macroFromIdx = -1;
  let macroToIdx = -1;
  if (hasMacro) {
    weeks.forEach((wk, i) => {
      const wkStartMs = ms(wk.startIso);
      const wkEndMs = wkStartMs + 7 * DAY;
      if (wkEndMs > macroStartMs && wkStartMs < macroEndMs) {
        if (macroFromIdx < 0) macroFromIdx = i;
        macroToIdx = i;
      }
    });
  }

  // Base de bienestar (media/desvío) sobre los días registrados.
  const wvals = (input.daylogs ?? []).map((d) => d.wellness).filter(isNum);
  const wmean = wvals.length ? wvals.reduce((a, b) => a + b, 0) / wvals.length : undefined;
  const wstd =
    wvals.length > 1
      ? Math.sqrt(wvals.reduce((a, b) => a + (b - wmean!) ** 2, 0) / wvals.length)
      : undefined;

  return {
    today: input.today,
    weeks,
    anchorWeekIdx: weeks.length - 1,
    macroFromIdx,
    macroToIdx,
    ...(input.weightBand ? { weightBand: input.weightBand } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(isNum(input.hrvBase) ? { hrvBase: input.hrvBase } : {}),
    ...(isNum(input.rhrBase) ? { rhrBase: input.rhrBase } : {}),
    ...(wmean != null ? { wellnessMean: Math.round(wmean) } : {}),
    ...(wstd != null ? { wellnessStd: Math.round(wstd) } : {}),
  };
}
