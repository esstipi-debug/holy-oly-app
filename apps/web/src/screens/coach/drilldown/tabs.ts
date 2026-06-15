/** Las 2 secciones del Drilldown: Plan (la superficie de trabajo, default) y Monitor (las señales).
 *  La tab activa vive en el search param `?tab=` (URL-as-state): se deriva de la URL en cada render
 *  — sin estado espejo — y se valida acá para que un valor desconocido (deep-link viejo, hash demo,
 *  edición a mano, o la ya-removida "resumen") caiga a Plan sin romper. */
export const TABS = [
  ["plan", "Plan"],
  ["monitor", "Monitor"],
] as const;

export type TabKey = (typeof TABS)[number][0];

const TAB_KEYS: readonly string[] = TABS.map((t) => t[0]);

/** Valida `?tab=` contra las tabs conocidas; default seguro = "plan". */
export function toTab(value: string | null | undefined): TabKey {
  return value != null && TAB_KEYS.includes(value) ? (value as TabKey) : "plan";
}
