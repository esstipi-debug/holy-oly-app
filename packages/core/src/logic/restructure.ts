import type { Competencia } from "../types";

/**
 * Curva de volumen relativo por semana (1..weeks). `baseAt(w)` da el volumen base
 * del macro. Antes de CADA competencia se baja el volumen (taper); con varias
 * competencias el taper se repite. Después de la última, semanas ligeras.
 */
export function volumeCurve(
  weeks: number,
  comps: Competencia[],
  baseAt: (w: number) => number
): number[] {
  const last = comps.reduce((m, c) => Math.max(m, c.week), 0);
  const out: number[] = [];
  for (let w = 1; w <= weeks; w++) {
    let v = baseAt(w);
    for (const c of comps) {
      const dd = c.week - w;
      if (dd >= 0 && dd <= 3) {
        const cap = dd <= 1 ? 26 : dd <= 2 ? 40 : 56;
        if (cap < v) v = cap;
      }
    }
    if (last && w > last) v = Math.min(v, Math.round(baseAt(w) * 0.55));
    out.push(v);
  }
  return out;
}

export function isTaperWeek(w: number, comps: Competencia[]): boolean {
  return comps.some((c) => w >= c.week - 2 && w <= c.week);
}
