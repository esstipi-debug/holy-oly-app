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
  prescription: (id: string) => `holyoly:prescription:${id}`,
  // Athlete-self stores (offline `LocalMeClient`, mirroring the API's DayLog / SessionActual tables).
  dayLog: (id: string) => `ho:daylog:${id}`,
  sessionActuals: (id: string) => `ho:actuals:${id}`,
  // Historial append-only de RMs (SP5), espejo de la tabla RmUpdate del API.
  rmUpdates: (id: string) => `ho:rmupdates:${id}`,
} as const;
