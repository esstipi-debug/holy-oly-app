export const KEYS = {
  roster: "ho:roster",
  seeded: "ho:seeded",
  series: (id: string) => `ho:series:${id}`,
  plan: (id: string) => `ho:plan:${id}`,
  medals: (id: string) => `ho:medals:${id}`,
  comps: (id: string) => `ho:comps:${id}`,
  sessionLog: (id: string) => `ho:sessions:${id}`,
  cycleShare: (id: string) => `ho:cycleShare:${id}`,
  cycleState: (id: string) => `ho:cycleState:${id}`,
  // Slice ciclo-visible: registro de la atleta (los MISMOS keys que lee el coach-side local).
  cycleStart: (id: string) => `ho:cycleStart:${id}`,
  cycleLen: (id: string) => `ho:cycleLen:${id}`,
  prescription: (id: string) => `holyoly:prescription:${id}`,
  // Athlete-self stores (offline `LocalMeClient`, mirroring the API's DayLog / SessionActual tables).
  dayLog: (id: string) => `ho:daylog:${id}`,
  sessionActuals: (id: string) => `ho:actuals:${id}`,
  // Registro de fechas de entreno (D1): append-only, espejo de la tabla SessionRegistro del API.
  sessionRegistros: (id: string) => `ho:registros:${id}`,
  // Historial append-only de RMs (SP5), espejo de la tabla RmUpdate del API.
  rmUpdates: (id: string) => `ho:rmupdates:${id}`,
} as const;
