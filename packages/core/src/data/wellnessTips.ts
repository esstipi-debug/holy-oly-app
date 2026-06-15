/**
 * Tips de "Mi estado de hoy" — píldoras de bienestar para el atleta, elegidas por su estado de
 * recuperación + el ítem más flojo del check-in del día. Contenido PARAFRASEADO de protocolos de
 * divulgación científica (Huberman Lab y col. — sueño/luz/NSDR/respiración/recuperación); son
 * HECHOS/protocolos en palabras propias, con atribución genérica (no se copia texto de nadie).
 * Advisory: complementan una señal, NUNCA prescriben ni cambian el plan. Sin RPE, sin diagnóstico.
 */
import { WELLNESS_ITEMS, goodness } from "../logic/wellness";
import type { WellnessAnswers } from "../types";

export type TipState = "ok" | "warn" | "alert";
export type WellnessItemField = "fatiga" | "dolor" | "estres" | "humor" | "motivacion" | "sueno";

export interface WellnessTip {
  id: string;
  topic: string;
  title: string;
  body: string;
  source: string;
  /** Estados de recuperación en los que el tip aplica. */
  states: readonly TipState[];
  /** Ítems del check-in que el tip atiende; `[]` = general por estado. */
  items: readonly WellnessItemField[];
}

const SRC = "Basado en divulgación de Huberman Lab y col.";
const ALL: readonly TipState[] = ["ok", "warn", "alert"];

export const WELLNESS_TIPS: readonly WellnessTip[] = [
  // ── Sueño ──
  {
    id: "sueno-higiene", topic: "Sueño", states: ["warn", "alert", "ok"], items: ["sueno"],
    title: "Prepará el descanso desde temprano",
    body: "Bajá las pantallas y la luz fuerte una hora antes de dormir, y dejá el cuarto fresco (~18-19 °C). Lo que más ordena el sueño es acostarte y levantarte a horarios parecidos.",
    source: SRC,
  },
  {
    id: "sueno-nsdr", topic: "Recuperación", states: ["warn", "alert"], items: ["sueno", "fatiga"],
    title: "Si dormiste poco, recuperá a la tarde",
    body: "10-20 minutos de descanso profundo sin dormir (NSDR / yoga nidra) por la tarde ayudan a reponer parte del descanso que faltó, sin sustituir al sueño nocturno.",
    source: SRC,
  },
  // ── Estrés ──
  {
    id: "estres-suspiro", topic: "Estrés", states: ALL, items: ["estres"],
    title: "Suspiro fisiológico para bajar un cambio",
    body: "Dos inhalaciones cortas seguidas por la nariz y después una exhalación larga por la boca. Repetí 3-4 veces: baja las pulsaciones en segundos.",
    source: SRC,
  },
  {
    id: "estres-luz", topic: "Luz y ánimo", states: ["warn", "alert"], items: ["estres", "humor"],
    title: "Luz natural a la mañana",
    body: "Unos 10-30 minutos de luz natural temprano ayudan a ordenar tu reloj interno y suavizan la sensación de estrés a lo largo del día.",
    source: SRC,
  },
  // ── Fatiga / energía ──
  {
    id: "fatiga-estimulos", topic: "Energía", states: ALL, items: ["fatiga", "motivacion"],
    title: "No apiles estímulos todos los días",
    body: "Cafeína fuerte + pre-entreno + música intensa en cada sesión, a la larga, aplana tu motivación de base. Reservá esos estímulos para los días que de verdad los necesitás.",
    source: SRC,
  },
  // ── Dolor ──
  {
    id: "dolor-frio", topic: "Recuperación", states: ["warn", "alert"], items: ["dolor"],
    title: "Frío para molestias, pero no pegado al entreno",
    body: "El frío suave puede aliviar, pero dejalo varias horas separado del entreno de volumen: justo después frena parte de la adaptación que buscás.",
    source: SRC,
  },
  {
    id: "dolor-coach", topic: "Cuidado", states: ["alert"], items: ["dolor"],
    title: "Dolor que no afloja → avisá",
    body: "Si el dolor es localizado o no cede, contáselo a tu coach antes de cargar fuerte. Cuidarte hoy es entrenar mejor mañana.",
    source: SRC,
  },
  // ── Humor / ánimo ──
  {
    id: "humor-movimiento", topic: "Ánimo", states: ["warn", "alert"], items: ["humor"],
    title: "Movete un poco para levantar el ánimo",
    body: "Luz natural y algo de movimiento suave (aunque sea una caminata corta) levantan el ánimo más que quedarte quieto.",
    source: SRC,
  },
  // ── Motivación ──
  {
    id: "motivacion-arranca", topic: "Motivación", states: ALL, items: ["motivacion"],
    title: "La motivación viene después de arrancar",
    body: "No esperes tener ganas antes de empezar: hacé la primera serie liviana y dejá que el cuerpo entre en ritmo. Casi siempre el resto viene solo.",
    source: SRC,
  },
  // ── Generales por estado (items: []) ──
  {
    id: "gen-ok", topic: "Sostener", states: ["ok"], items: [],
    title: "Vas en tu rango — sostenelo",
    body: "Buen día para seguir el plan como viene. Mantené el sueño y la luz de la mañana constantes para que esta racha se sostenga.",
    source: SRC,
  },
  // Generales por estado: dan el CÓMO concreto (el recuadro de estado ya dice el QUÉ) — nunca lo repiten.
  {
    id: "gen-warn", topic: "Sueño", states: ["warn"], items: [],
    title: "Cómo dormir mejor esta noche",
    body: "Bajá la luz y las pantallas una hora antes de acostarte y dejá el cuarto fresco (~18-19 °C). Sostener el horario es lo que más mejora tu recuperación.",
    source: SRC,
  },
  {
    id: "gen-alert", topic: "Bajar un cambio", states: ["alert"], items: [],
    title: "Reseteá el sistema nervioso",
    body: "Suspiro fisiológico: dos inhalaciones cortas por la nariz y una exhalación larga por la boca, 3-4 veces. Si podés, sumá 10-20 min de descanso profundo (NSDR) a la tarde.",
    source: SRC,
  },
  {
    id: "gen-descanso-series", topic: "Recuperación", states: ["ok"], items: [],
    title: "El descanso largo entre series rinde",
    body: "En trabajo pesado, descansar 3-5 minutos entre series no es perder tiempo: te deja mover más kilos con mejor técnica.",
    source: SRC,
  },
] as const;

/** El ítem "peor" del check-in (menor `goodness` → más lejos de un buen día). null sin entrada. */
export function lowestWellnessItem(answers: Partial<WellnessAnswers> | null | undefined): WellnessItemField | null {
  if (!answers) return null;
  let worst: { field: WellnessItemField; good: number } | null = null;
  for (const item of WELLNESS_ITEMS) {
    const v = answers[item.field];
    if (v == null || !Number.isFinite(v)) continue;
    const good = goodness(Math.max(1, Math.min(5, v)), item.highBad);
    if (worst === null || good < worst.good) worst = { field: item.field as WellnessItemField, good };
  }
  return worst ? worst.field : null;
}

/**
 * Elige el tip más relevante para el estado + ítem más flojo. Prioriza: (1) match de ítem Y estado,
 * (2) match de ítem en cualquier estado, (3) general por estado, (4) nada. `seed` (p.ej. derivado de
 * la fecha) varía el tip día a día de forma DETERMINÍSTICA. null si no aplica (estado sin datos).
 */
export function pickWellnessTip(opts: { state: TipState; item?: WellnessItemField | null; seed?: number }): WellnessTip | null {
  const { state, item, seed = 0 } = opts;
  const pick = (cands: readonly WellnessTip[]): WellnessTip | null =>
    cands.length === 0 ? null : (cands[((seed % cands.length) + cands.length) % cands.length] ?? null);

  if (item) {
    const itemAndState = WELLNESS_TIPS.filter((t) => t.items.includes(item) && t.states.includes(state));
    if (itemAndState.length) return pick(itemAndState);
    const itemAny = WELLNESS_TIPS.filter((t) => t.items.includes(item));
    if (itemAny.length) return pick(itemAny);
  }
  const stateGeneral = WELLNESS_TIPS.filter((t) => t.items.length === 0 && t.states.includes(state));
  return pick(stateGeneral);
}
