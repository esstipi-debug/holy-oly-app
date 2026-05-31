export const KEYS = {
  roster: "ho:roster",
  seeded: "ho:seeded",
  series: (id: string) => `ho:series:${id}`,
  plan: (id: string) => `ho:plan:${id}`,
  medals: (id: string) => `ho:medals:${id}`,
  comps: (id: string) => `ho:comps:${id}`,
  cycleShare: (id: string) => `ho:cycleShare:${id}`,
  cycleState: (id: string) => `ho:cycleState:${id}`,
} as const;
