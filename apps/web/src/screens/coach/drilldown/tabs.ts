/** Las 3 secciones del Drilldown. La tab activa vive en el search param `?tab=` (URL-as-state):
 *  se deriva de la URL en cada render — sin estado espejo — y se valida acá para que un valor
 *  desconocido (deep-link viejo, hash demo, edición a mano) caiga a Resumen sin romper. */
export const TABS = [
  ["resumen", "Resumen"],
  ["monitor", "Monitor"],
  ["plan", "Plan"],
] as const;

export type TabKey = (typeof TABS)[number][0];

const TAB_KEYS: readonly string[] = TABS.map((t) => t[0]);

/** Valida `?tab=` contra las tabs conocidas; default seguro = "resumen". */
export function toTab(value: string | null | undefined): TabKey {
  return value != null && TAB_KEYS.includes(value) ? (value as TabKey) : "resumen";
}
