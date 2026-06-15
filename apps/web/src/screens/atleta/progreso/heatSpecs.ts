/**
 * Config por señal del mapa de calor (rediseño 0110): nivel de color (0–4), texto de detalle al
 * tocar un día, y resumen de la ventana. Lee las celdas REALES de MeHeatDays. INTOCABLE: la carga
 * NUNCA muestra RPE (HR-1) — sólo tonelaje + nº de sesiones.
 */
import type { HeatDayCell, MeHeatDays } from "@holy-oly/core";

export type SignalKey = "carga" | "recuperacion" | "bienestar" | "peso";

export interface HeatSpec {
  legendLo: string;
  legendHi: string;
  /** -1 = futuro/sin dato (gris/contorno) · 0 = sin registro ese día · 1..4 = intensidad. */
  level(cell: HeatDayCell): number;
  /** Texto del panel de detalle al tocar un día (clickable sólo si level≥0 o es competencia). */
  value(cell: HeatDayCell): string;
  /** Hint cuando no hay día seleccionado: resumen honesto de la ventana visible. */
  summary(cells: HeatDayCell[]): string;
}

const t1 = (kg: number): string => (kg / 1000).toFixed(1).replace(".", ",");
const mean = (xs: number[]): number => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const past = (cells: HeatDayCell[]): HeatDayCell[] => cells.filter((d) => !d.future);

function cargaSpec(): HeatSpec {
  return {
    legendLo: "descanso",
    legendHi: "+ volumen",
    level: (d) => {
      if (d.future) return -1;
      if (!d.trained) return 0;
      if (d.comp) return 4;
      return d.kg >= 13000 ? 4 : d.kg >= 10000 ? 3 : d.kg >= 7000 ? 2 : 1;
    },
    // NUNCA RPE: sólo tonelaje + nº de sesiones (HR-1).
    value: (d) => {
      if (d.future) return "Próxima competencia";
      if (!d.trained) return "Descanso";
      return `${t1(d.kg)} t · ${d.sessions} ${d.sessions === 1 ? "sesión" : "sesiones"}`;
    },
    summary: (cells) => {
      const ds = past(cells).filter((d) => d.trained);
      const tot = ds.reduce((a, d) => a + d.kg, 0);
      return ds.length ? `${ds.length} días entrenados · ${t1(tot)} t movidas — tocá un día` : "Sin entrenos registrados en esta ventana";
    },
  };
}

function recuperacionSpec(base?: number): HeatSpec {
  const rel = (hrv: number): number => (base != null ? hrv - base : 0);
  return {
    legendLo: "− recup.",
    legendHi: "+ recup.",
    level: (d) => {
      if (d.future) return -1;
      if (d.hrv == null) return 0;
      const r = rel(d.hrv);
      return r >= 3 ? 4 : r >= 0 ? 3 : r >= -4 ? 2 : 1;
    },
    value: (d) => {
      if (d.future) return "Próxima competencia";
      if (d.hrv == null) return "Sin registro";
      return `HRV ${d.hrv} ms${d.rhr != null ? ` · FC ${d.rhr} lpm` : ""}`;
    },
    summary: (cells) => {
      const hs = past(cells).map((d) => d.hrv).filter((v): v is number => v != null);
      return hs.length ? `HRV media ${mean(hs)} ms en la ventana — tocá un día` : "Tu recuperación semanal aparece dentro del macro";
    },
  };
}

function bienestarSpec(): HeatSpec {
  return {
    legendLo: "bajo",
    legendHi: "alto",
    level: (d) => {
      if (d.future) return -1;
      if (d.wellness == null) return 0;
      return d.wellness >= 82 ? 4 : d.wellness >= 74 ? 3 : d.wellness >= 66 ? 2 : 1;
    },
    value: (d) => {
      if (d.future) return "Próxima competencia";
      if (d.wellness == null) return "Sin registro";
      return `Bienestar ${d.wellness}/100`;
    },
    summary: (cells) => {
      const ws = past(cells).map((d) => d.wellness).filter((v): v is number => v != null);
      return ws.length ? `Bienestar medio ${mean(ws)}/100 — tocá un día` : "Registrá tu día a día para ver tu bienestar";
    },
  };
}

function pesoSpec(band?: [number, number]): HeatSpec {
  const lo = band?.[0];
  const hi = band?.[1];
  return {
    legendLo: "lejos",
    legendHi: "en banda",
    level: (d) => {
      if (d.future) return -1;
      if (d.bw == null) return 0;
      if (lo == null || hi == null) return 1; // sin banda: la escala "lejos↔en banda" no aplica → nivel mínimo, sin insinuar "en banda"
      if (d.bw >= lo && d.bw <= hi) return 4;
      if (d.bw <= hi + 0.8) return 3;
      if (d.bw <= hi + 1.8) return 2;
      return 1;
    },
    value: (d) => {
      if (d.future) return "Próxima competencia";
      if (d.bw == null) return "Sin registro";
      if (lo == null || hi == null) return `${d.bw.toFixed(1)} kg`;
      const inb = d.bw >= lo && d.bw <= hi;
      return `${d.bw.toFixed(1)} kg${inb ? " · en banda" : d.bw > hi ? " · sobre banda" : " · bajo banda"}`;
    },
    summary: (cells) => {
      const ds = past(cells).filter((d) => d.bw != null);
      if (!ds.length) return "Registrá tu peso en el check-in para verlo acá";
      if (lo == null || hi == null) return `${ds.length} días con peso registrado — tocá un día`;
      const inBand = ds.filter((d) => d.bw! >= lo && d.bw! <= hi).length;
      return `${inBand} días en banda en la ventana — tocá un día`;
    },
  };
}

/** Devuelve el HeatSpec de una señal, parametrizado con las bases reales del atleta. */
export function heatSpecFor(key: SignalKey, data: MeHeatDays): HeatSpec {
  switch (key) {
    case "carga": return cargaSpec();
    case "recuperacion": return recuperacionSpec(data.hrvBase);
    case "bienestar": return bienestarSpec();
    case "peso": return pesoSpec(data.weightBand);
  }
}
