import type { Macrocycle, SchoolDNA, SlotKind } from "@holy-oly/core";
import { ALL_RECIPES, instantiatePrescription, programmableName } from "@holy-oly/core";

/**
 * Lectura de composición de un macro para la pantalla del coach: traduce el ADN de la escuela
 * (data, packages/core/data/schools.ts) en lo que un coach curioso quiere ver — qué movimientos
 * lo definen, qué deja fuera a propósito y dónde paran los porcentajes. Puro y presentacional;
 * los nombres salen de la librería oficial (`programmableName`), jamás un id crudo.
 */

/** Orden de presentación de los slots: el gesto de competencia primero, accesorio al final. */
export const SLOT_ORDER: readonly SlotKind[] = [
  "olimpico", "complejo", "tiron", "rodilla", "empuje", "bisagra", "metabolico",
];

export const SLOT_LABEL: Record<SlotKind, string> = {
  olimpico: "Levantamientos",
  complejo: "Complejos",
  tiron: "Tirones",
  rodilla: "Sentadillas",
  empuje: "Empujes / jerk",
  bisagra: "Cadena posterior",
  metabolico: "Accesorio funcional",
};

/** id legible: la librería resuelve variantes y complejos; si no la conoce, humaniza el id
 *  (separa por punto/guion y capitaliza) — nunca se filtra un id crudo a la UI. */
export function displayName(id: string): string {
  const n = programmableName(id);
  if (n !== id) return n;
  return id.replace(/[.\-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface SignatureGroup { slot: SlotKind; label: string; names: string[] }

/** Movimientos firma de la escuela agrupados por slot (orden gesto→accesorio); cada grupo con
 *  sus nombres ordenados por preferencia de rotación (weight desc). Los slots vacíos se omiten. */
export function signatureGroups(dna: SchoolDNA): SignatureGroup[] {
  const groups: SignatureGroup[] = [];
  for (const slot of SLOT_ORDER) {
    const items = dna.repertoire[slot];
    if (!items || items.length === 0) continue;
    const names = [...items].sort((a, b) => b.weight - a.weight).map((it) => displayName(it.id));
    groups.push({ slot, label: SLOT_LABEL[slot], names });
  }
  return groups;
}

/** Lo que la escuela DEJA FUERA a propósito (forbidden) → nombres legibles. */
export function excludedNames(dna: SchoolDNA): string[] {
  return dna.forbidden.map(displayName);
}

/** Carácter de dosis en una línea: dónde del corredor paran los % y cuándo aparecen los singles. */
export function intensitySignature(dna: SchoolDNA): string {
  const bias = dna.dosage.mainBias === "high"
    ? "Trabaja en el techo del corredor de cada fase"
    : dna.dosage.mainBias === "low"
      ? "Porcentajes moderados — calidad y velocidad por serie"
      : "Porcentajes medios del corredor de cada fase";
  const sp = dna.dosage.singlesPhases;
  if (sp.length === 0) return bias;
  const early = sp.includes("base") || sp.includes("fuerza");
  return bias + (early ? " · singles pesados desde temprano" : " · singles en el pico");
}

export interface TypicalExercise { name: string; sets: number; reps: number; pct?: number }
export interface TypicalSession { day: number; exercises: TypicalExercise[] }

/**
 * La semana representativa de una fase — su PRIMERA semana, sesión por sesión, con cada ejercicio
 * y su % (los kg nacen recién al asignar, derivados de los RMs del atleta). Toda semana de una
 * fase comparte plantilla, así que la primera la representa. Sin receta sesión-por-sesión → null
 * (empty-state honesto; jamás se inventa una sesión). Fase inexistente → null.
 */
export function typicalWeek(macro: Macrocycle, phaseKey: string): TypicalSession[] | null {
  const phase = macro.phaseProfile.find((p) => p.key === phaseKey);
  if (!phase) return null;
  const totalWeeks = macro.phaseProfile[macro.phaseProfile.length - 1]?.weeks[1] ?? 0;
  const rows = instantiatePrescription(ALL_RECIPES, macro, totalWeeks);
  const week = phase.weeks[0];
  const byDay = new Map<number, TypicalExercise[]>();
  for (const r of rows.filter((r) => r.week === week).sort((a, b) => a.order - b.order)) {
    if (!byDay.has(r.sessionIdx)) byDay.set(r.sessionIdx, []);
    byDay.get(r.sessionIdx)!.push({
      name: programmableName(r.movementId), sets: r.sets, reps: r.reps,
      ...(r.pct != null ? { pct: r.pct } : {}),
    });
  }
  if (byDay.size === 0) return null;
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, exercises]) => ({ day, exercises }));
}

/** ¿El macro tiene receta sesión-por-sesión? (gate de la sección «Semana tipo» — evita un
 *  encabezado huérfano cuando un programa sólo tiene el reparto de fases). */
export function hasTypicalWeek(macro: Macrocycle): boolean {
  return ALL_RECIPES.some((r) => r.macroId === macro.id);
}
