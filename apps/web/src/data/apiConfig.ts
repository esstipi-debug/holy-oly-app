/**
 * How the front talks to the backend.
 *
 * - Standalone demo (no env): API_ENABLED=false → LocalRepository (localStorage), no auth.
 * - Split-origin: set VITE_API_URL to the API's absolute URL → API mode, absolute fetches.
 * - Same-origin (the production single-service deploy): set VITE_API_ENABLED=true and leave
 *   VITE_API_URL empty → API mode with RELATIVE fetches (the cookie travels same-site).
 */
const url = import.meta.env.VITE_API_URL;

export const API_ENABLED: boolean = Boolean(url) || import.meta.env.VITE_API_ENABLED === "true";

/** Base prefix for API fetches: the configured URL, or "" for same-origin relative requests. */
export const API_BASE: string = url ?? "";
