import type { Estado } from "../types";

export function acwrState(v: number): Estado {
  return v > 1.5 ? "alert" : v > 1.3 || v < 0.8 ? "warn" : "ok";
}

/** Media móvil de 4 semanas (incluye la semana actual). */
export function chronic(acute: number[]): number[] {
  return acute.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - 3); j <= i; j++) { sum += acute[j]!; n++; }
    return sum / n;
  });
}

export function acwr(acute: number[]): number[] {
  const ch = chronic(acute);
  return acute.map((a, i) => a / ch[i]!);
}

/** El IMR está fuera de la banda esperada de la fase (margen ±2). */
export function imrBandState(imr: number, band: [number, number]): Estado {
  return imr > band[1] + 2 || imr < band[0] - 2 ? "warn" : "ok";
}
