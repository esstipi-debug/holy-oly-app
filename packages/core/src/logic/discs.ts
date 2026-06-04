export type Disc = 10 | 15 | 20 | 25;
export const DISCS: readonly Disc[] = [25, 20, 15, 10];

// [fill, edge, light] — colores IWF. El kg es la verdad; los discos son aproximados.
export const DISC_COLORS: Record<Disc, [string, string, string]> = {
  10: ["#3eb24a", "#2c8a37", "#7fd07f"],
  15: ["#f3c200", "#c79c00", "#ffe46b"],
  20: ["#2f6fa8", "#1d4f7e", "#6fa3cf"],
  25: ["#d5232b", "#a4161d", "#ec6b6f"],
};

/** Peso de la barra según sexo del atleta (IWF: hombre 20 kg, mujer 15 kg). */
export function barKgForSexo(sexo: "M" | "F"): number {
  return sexo === "F" ? 15 : 20;
}

/** Discos por lado para `totalKg` con barra `barKg` (20 hombre, 15 mujer). Aproximado. */
export function perSide(totalKg: number, barKg = 20): Disc[] {
  let r = (totalKg - barKg) / 2;
  const out: Disc[] = [];
  if (r < 5) return out;
  for (const p of DISCS) while (r >= p) { out.push(p); r -= p; }
  return out;
}
