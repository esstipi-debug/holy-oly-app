/** Agrupación ÚNICA de sesiones por día real (spec 2026-06-12 D8). Acá muere la suposición
 *  «sesión i = día i»: day ausente = comportamiento histórico. Genérico: sirve SessionView
 *  (web/api) y SessionTemplate (generador) por igual. */
export interface DaySession<T> { session: T; turno?: "AM" | "PM" }
export interface DayGroup<T> { day: number; sesiones: DaySession<T>[] }

export function sessionsByDay<T extends { sessionIdx: number; day?: number; turno?: "AM" | "PM" }>(
  sessions: readonly T[],
): DayGroup<T>[] {
  const by = new Map<number, DaySession<T>[]>();
  for (const s of sessions) {
    const day = s.day ?? s.sessionIdx + 1;
    if (!by.has(day)) by.set(day, []);
    by.get(day)!.push(s.turno ? { session: s, turno: s.turno } : { session: s });
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([day, sesiones]) => ({ day, sesiones }));
}
