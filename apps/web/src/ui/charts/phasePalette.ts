/** Paleta NEUTRA de fases (categórica, NO semáforo — no colisiona con STATUS verde/amarillo/rojo).
 *  El color de una fase es decisión de render (`phaseProfile` no trae color); se asigna por ORDEN
 *  de la fase en el perfil. Compartida por MacroTimeline (cinta) y PlanCalendar (chips). */
export const PHASE_RAMP = ["#6f86ff", "#22b8cf", "#a78bfa", "#94a3b8"];

/** Color neutro de la fase número `i` (0-based, índice en `macro.phaseProfile`). `i<0` → primer color. */
export function phaseColor(i: number): string {
  return PHASE_RAMP[Math.max(0, i) % PHASE_RAMP.length]!;
}
