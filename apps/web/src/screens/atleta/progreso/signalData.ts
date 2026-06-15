/**
 * Mi Progreso (rediseño) — derivación PURA del "hero" de cada señal (valor grande + delta vs tu
 * normal + mini-stats + read-line) desde `MonitorSeries`. Sin JSX: la copy estática (name/sub/explain)
 * y el chart viven en la capa React; acá solo va la matemática, blindada contra NaN/Infinity.
 *
 * Guards (del audit de conectividad 2026-06-14): no existen pctVs/mean/std en core → se crean acá
 * con la disciplina de `recoveryScore`/`weekSignals.fin()`: base<=0 o no-finito → SIN delta (nunca
 * "Infinity%"); <2 muestras → sin delta ni banda; weeks<4 → no afirmar "4 sem"; max de [] → undefined;
 * opcionales (bodyweight) con `?.`. NUNCA se toca `series.rpe` (intocable: el atleta no ve RPE).
 */
import { chronic, type MonitorSeries, type CellState } from "@holy-oly/core";

export type SignalKey = "carga" | "recuperacion" | "bienestar" | "peso";
export type DeltaDir = "up" | "down" | "flat";

export interface SignalDelta {
  dir: DeltaDir;
  text: string;        // "+8%", "En banda", "—"
  note: string;        // "vs tu tendencia"
  state: CellState;    // colorea el chip
}
export interface SignalStat {
  label: string;
  value: string;       // "72 ms", "—"
  sub?: string;        // "+4% vs normal"
  state?: CellState;
}
export interface SignalDisplay {
  big: string;         // valor grande del hero, o "—"
  unit: string;
  delta: SignalDelta | null;
  stats: SignalStat[];
  read: string;        // caption derivada, honesta (no narrativa inventada)
}

/* ── helpers numéricos guardados ── */
const isNum = (v: number | undefined): v is number => v != null && Number.isFinite(v);

function lastFin(arr: readonly number[] | undefined): number | undefined {
  if (!arr || arr.length === 0) return undefined;
  const v = arr[arr.length - 1];
  return isNum(v) ? v : undefined;
}
function maxFin(arr: readonly number[] | undefined): number | undefined {
  const v = (arr ?? []).filter(isNum);
  return v.length ? Math.max(...v) : undefined;
}
function mean(arr: readonly number[] | undefined): number | undefined {
  const v = (arr ?? []).filter(isNum);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
}
/** Desvío estándar — `undefined` con <2 muestras (sin banda, no una de ancho 0). */
function std(arr: readonly number[] | undefined): number | undefined {
  const v = (arr ?? []).filter(isNum);
  if (v.length < 2) return undefined;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}
/** % de `value` vs `base`. base<=0 o no-finito → undefined (jamás Infinity%/NaN%). */
function pctVs(value: number | undefined, base: number | undefined): number | undefined {
  if (!isNum(value) || !isNum(base) || base <= 0) return undefined;
  return ((value - base) / base) * 100;
}
const pct = (n: number): string => `${n >= 0 ? "+" : ""}${Math.round(n)}%`;
const dirOf = (n: number | undefined): DeltaDir => (n == null ? "flat" : n > 0 ? "up" : n < 0 ? "down" : "flat");

/* ── CARGA: carga aguda semanal vs tu tendencia (chronic, media móvil 4 sem) ── */
export function cargaDisplay(s: MonitorSeries): SignalDisplay {
  const ult = lastFin(s.acute);
  const trend = lastFin(chronic(s.acute));
  const peak = maxFin(s.acute);
  // delta sólo con ≥2 semanas (necesita una tendencia real para comparar).
  const d = s.weeks >= 2 ? pctVs(ult, trend) : undefined;
  const trendLabel = s.weeks >= 4 ? "Tendencia (4 sem)" : "Tu tendencia";
  return {
    big: isNum(ult) ? String(Math.round(ult)) : "—",
    unit: "AU",
    delta: d == null ? null : { dir: dirOf(d), text: pct(d), note: "vs tu tendencia", state: "none" },
    stats: [
      { label: "Última", value: isNum(ult) ? `${Math.round(ult)} AU` : "—" },
      { label: trendLabel, value: isNum(trend) ? `${Math.round(trend)} AU` : "—" },
      { label: "Tu pico", value: isNum(peak) ? `${Math.round(peak)} AU` : "—" },
    ],
    read:
      d == null
        ? "Tu primera lectura de carga — a medida que sumes semanas vas a ver tu tendencia."
        : d >= 12
          ? "Tu carga viene por encima de tu tendencia: cuidá el descanso si se sostiene."
          : d <= -12
            ? "Tu carga bajó respecto a tu tendencia — típico de una bajada o taper."
            : "Tu carga viene en línea con tu tendencia.",
  };
}

/* ── RECUPERACIÓN: HRV (hero) + FC reposo vs tu normal (bases almacenadas) ── */
export function recuperacionDisplay(s: MonitorSeries): SignalDisplay {
  const hrv = lastFin(s.hrv);
  const rhr = lastFin(s.rhr);
  const dHrv = pctVs(hrv, s.hrvBase);
  const dRhr = pctVs(rhr, s.rhrBase);
  const okHrv = isNum(hrv) && hrv >= s.hrvBase - 5;
  const okRhr = isNum(rhr) && rhr <= s.rhrBase + 3;
  const state: CellState = !isNum(hrv) || !isNum(rhr) ? "none" : okHrv && okRhr ? "ok" : "warn";
  return {
    big: isNum(hrv) ? String(Math.round(hrv)) : "—",
    unit: "ms",
    delta:
      dHrv == null ? null : { dir: dirOf(dHrv), text: pct(dHrv), note: "HRV vs tu normal", state },
    stats: [
      { label: "HRV", value: isNum(hrv) ? `${Math.round(hrv)} ms` : "—", sub: dHrv == null ? undefined : `${pct(dHrv)} vs normal`, state: isNum(hrv) ? (okHrv ? "ok" : "warn") : "none" },
      { label: "FC reposo", value: isNum(rhr) ? `${Math.round(rhr)} lpm` : "—", sub: dRhr == null ? undefined : `${pct(dRhr)} vs normal`, state: isNum(rhr) ? (okRhr ? "ok" : "warn") : "none" },
      { label: "Estado", value: state === "none" ? "—" : state === "ok" ? "En tu banda" : "Vigilar", state },
    ],
    read:
      state === "none"
        ? "Cuando registres HRV y FC en reposo, vas a ver cómo venís recuperando."
        : state === "ok"
          ? "Te mantenés en tu banda normal: venís recuperando bien."
          : "HRV o FC fuera de tu normal — buen momento para aflojar.",
  };
}

/* ── BIENESTAR: score 0–100 (hero) vs tu normal (media de la serie) ── */
export function bienestarDisplay(s: MonitorSeries): SignalDisplay {
  const score = lastFin(s.wellness);
  const m = mean(s.wellness);
  const sd = std(s.wellness);
  const peak = maxFin(s.wellness);
  // delta = diferencia absoluta vs tu normal, sólo con ≥2 semanas.
  const diff = s.weeks >= 2 && isNum(score) && isNum(m) ? score - m : undefined;
  const dState: CellState = !isNum(score) || !isNum(m) || sd == null ? "none" : score >= m - sd ? "ok" : score >= m - 2 * sd ? "warn" : "alert";
  const normalStat = isNum(m)
    ? sd != null
      ? `${Math.round(m)} ± ${Math.round(sd)}`
      : String(Math.round(m))
    : "—";
  return {
    big: isNum(score) ? String(Math.round(score)) : "—",
    unit: "/100",
    delta:
      diff == null
        ? null
        : { dir: dirOf(diff), text: `${diff >= 0 ? "+" : ""}${Math.round(diff)}`, note: "vs tu normal", state: diff >= 0 ? "ok" : "warn" },
    stats: [
      { label: "Score", value: isNum(score) ? `${Math.round(score)}/100` : "—", state: dState },
      { label: "Tu normal", value: normalStat },
      { label: "Pico de la fase", value: isNum(peak) ? `${Math.round(peak)}/100` : "—" },
    ],
    read:
      diff == null
        ? "Tu primera lectura de bienestar — con más días vas a ver tu tendencia."
        : diff >= 0
          ? "Tu bienestar está sobre tu normal."
          : "Tu bienestar está por debajo de tu normal — atención al descanso.",
  };
}

/* ── PESO: peso corporal (hero) vs la banda de tu categoría. null sin bodyweight (slide ausente) ── */
export function pesoDisplay(s: MonitorSeries): SignalDisplay | null {
  const wt = lastFin(s.bodyweight);
  if (!isNum(wt)) return null; // sin peso → no hay slide Peso (igual que el gate hasWeight de hoy)
  const band = s.weightBand;
  const hasBand = band != null && isNum(band[0]) && isNum(band[1]) && band[0]! <= band[1]!;
  const inBand = hasBand && wt >= band![0]! && wt <= band![1]!;
  const margin = hasBand ? band![1]! - wt : undefined;
  const wState: CellState = !hasBand ? "none" : inBand ? "ok" : "alert";
  return {
    big: wt.toFixed(1),
    unit: "kg",
    delta: !hasBand
      ? null
      : { dir: "flat", text: inBand ? "En banda" : "Fuera", note: "tu categoría", state: inBand ? "ok" : "alert" },
    stats: [
      { label: "Peso", value: `${wt.toFixed(1)} kg`, state: wState },
      { label: "Banda", value: hasBand ? `${band![0]}–${band![1]} kg` : "—" },
      { label: "Margen al límite", value: margin == null ? "—" : `${margin.toFixed(1)} kg`, state: margin == null ? "none" : margin >= 0 ? "ok" : "alert" },
    ],
    read: !hasBand
      ? "Registrá tu categoría para ver el peso contra su banda."
      : inBand
        ? "Estás dentro de la banda de tu categoría."
        : wt > band![1]!
          ? "Estás por encima de la banda de tu categoría."
          : "Estás por debajo de la banda de tu categoría.",
  };
}
