// Per-route rate-limit configs (A1). Applied via each route's `config.rateLimit` and enforced
// only when @fastify/rate-limit is registered (see buildServer: on in prod/dev, off under test).
// Keyed by source IP by the plugin; complemented by per-account lockout (lockout.ts) for the
// distributed / shared-NAT cases that IP limits miss.

export const LOGIN_RATE_LIMIT = { max: 10, timeWindow: "1 minute" } as const;
export const SIGNUP_RATE_LIMIT = { max: 10, timeWindow: "1 minute" } as const;
export const ACCEPT_RATE_LIMIT = { max: 5, timeWindow: "1 minute" } as const;
export const ROTATE_RATE_LIMIT = { max: 3, timeWindow: "1 minute" } as const;
