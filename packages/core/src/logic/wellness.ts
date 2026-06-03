import type { WellnessItemDef, WellnessAnswers } from "../types";

/** The 6 daily self-report items. `field` = canonical key; `label` = display name (and the
 *  existing MonitorSeries.wellnessItems key). `highBad` true ⇒ a HIGH value is bad. Copy ported
 *  verbatim from the Claude Design check-in (`data.js` checkinItems). */
export const WELLNESS_ITEMS: WellnessItemDef[] = [
  { field: "fatiga",     label: "Fatiga",     q: "¿Qué tan cansada te sentís?", lo: "Con energía", hi: "Agotada",       highBad: true },
  { field: "dolor",      label: "Dolor",      q: "¿Tenés molestias o dolor?",   lo: "Nada",        hi: "Mucho",         highBad: true },
  { field: "estres",     label: "Estrés",     q: "¿Cómo está tu cabeza hoy?",   lo: "Tranquila",   hi: "Muy estresada", highBad: true },
  { field: "humor",      label: "Humor",      q: "¿Cómo es tu ánimo?",          lo: "Bajón",       hi: "Genial",        highBad: false },
  { field: "motivacion", label: "Motivación", q: "¿Con cuántas ganas venís?",   lo: "Pocas",       hi: "A full",        highBad: false },
  { field: "sueno",      label: "Sueño",      q: "¿Cómo dormiste?",             lo: "Mal",         hi: "Like a baby",   highBad: false },
];

/** Maps a raw 1-5 answer to its "good" value 1-5 (sonrisa = buen día), inverting highBad items. */
export function goodness(val: number, highBad: boolean): number {
  return highBad ? 6 - val : val;
}

/** Composite wellness 0-100: each answered item normalized to "good" (1-5 → 0-1), averaged ×100.
 *  All-good → 100, all-bad → 0. Missing/non-finite items are skipped; no items → 0. */
export function wellnessScore(answers: Partial<WellnessAnswers>): number {
  const goods: number[] = [];
  for (const item of WELLNESS_ITEMS) {
    const v = answers[item.field];
    if (v == null || !Number.isFinite(v)) continue;
    goods.push((goodness(v, item.highBad) - 1) / 4); // 0..1
  }
  if (goods.length === 0) return 0;
  return Math.round((goods.reduce((a, b) => a + b, 0) / goods.length) * 100);
}
