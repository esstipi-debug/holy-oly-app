import type { Macrocycle, MacrocycleFamily, MacrocycleLevel } from "@holy-oly/core";

/** Filter chips (a leading "Todos" + the catalog's own dimensions). */
export const FAMILIES: (MacrocycleFamily | "Todos")[] = [
  "Todos", "Búlgaro", "Coreano", "Chino", "Cubano", "Polaco", "Ruso", "Ucraniano", "Colombiano", "Híbrido", "USA",
];
export const DAYS = ["Todos", "2d", "3d", "4d", "5d", "6d"] as const;

export interface MacroFilters {
  family: string; // a MacrocycleFamily or "Todos"
  days: string;   // "2d".."6d" or "Todos"
  query: string;
}

const norm = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Days match by the digit in the program's `frequency` (e.g. "5d/sem" matches "5d"). */
function matchesDays(m: Macrocycle, days: string): boolean {
  if (days === "Todos") return true;
  return m.frequency.includes(days.replace("d", ""));
}

/** Pure catalog filter: family AND days AND free text (name/family, accent-insensitive). */
export function macroFilter(list: Macrocycle[], { family, days, query }: MacroFilters): Macrocycle[] {
  const q = norm(query.trim());
  return list.filter(
    (m) =>
      (family === "Todos" || m.family === family) &&
      matchesDays(m, days) &&
      (q === "" || norm(m.name).includes(q) || norm(m.family).includes(q)),
  );
}

/** Recovery demand, derived from the load profile (ports the mockup's `rec`). */
export function deriveRecovery(m: Macrocycle): number {
  return Math.max(1, Math.min(5, 6 - Math.max(m.intensity, m.volume)));
}

/** One-word focus label, derived from the load profile (ports the mockup's `focusW`). */
export function focusTag(m: Macrocycle): string {
  if (m.volume >= 5) return "volumen";
  if (m.peaks && m.intensity >= 5) return "peaking";
  if (m.intensity >= 5) return "intensidad";
  if (m.intensity >= 4) return "fuerza";
  return "técnico";
}

const LEVEL_LABEL: Record<MacrocycleLevel, string> = {
  beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado", elite: "Elite",
};
export function levelLabel(level: MacrocycleLevel): string {
  return LEVEL_LABEL[level];
}
