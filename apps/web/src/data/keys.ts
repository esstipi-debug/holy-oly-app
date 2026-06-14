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
  // PR-L2: acto de consentimiento informado (opt-in explícito). Presente ⇒ la atleta activó el módulo.
  cycleConsented: (id: string) => `ho:cycleConsented:${id}`,
  prescription: (id: string) => `holyoly:prescription:${id}`,
  // Athlete-self stores (offline `LocalMeClient`, mirroring the API's DayLog / SessionActual tables).
  dayLog: (id: string) => `ho:daylog:${id}`,
  sessionActuals: (id: string) => `ho:actuals:${id}`,
  // Registro de fechas de entreno (D1): append-only, espejo de la tabla SessionRegistro del API.
  sessionRegistros: (id: string) => `ho:registros:${id}`,
  // Historial append-only de RMs (SP5), espejo de la tabla RmUpdate del API.
  rmUpdates: (id: string) => `ho:rmupdates:${id}`,
  // Historial de macrociclos cerrados (slice macro-history), espejo de la tabla MacroHistory del API.
  macroHistory: (id: string) => `ho:macrohistory:${id}`,
  // Competencias compartidas del coach (slice 2026-06-14): catálogo del coach (demo offline).
  competitions: "ho:competitions",
} as const;
