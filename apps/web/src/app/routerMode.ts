/**
 * Build flag: when true the app uses hash routing (`/#/path`) instead of history routing.
 *
 * The single-file portable demo (T6) opens via `file://`, where the History API can't do deep
 * links or reloads — only hash routing works. `.env.singlefile` sets `VITE_HASH_ROUTER=true` for
 * `vite build --mode singlefile`; it's unset everywhere else, so dev and the Render deploy keep
 * clean history URLs (Render serves the SPA with a fallback, so it never needs the hash).
 */
export function isHashRouting(env: { VITE_HASH_ROUTER?: string } = import.meta.env): boolean {
  return env.VITE_HASH_ROUTER === "true";
}
