/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Holy Oly API. When set, the app uses HttpRepository (Fase 2). */
  readonly VITE_API_URL?: string;
  /** Same-origin API mode flag (production single-service deploy). See apiConfig.ts. */
  readonly VITE_API_ENABLED?: string;
  /** "true" → hash routing for the `file://` single-file demo build. See app/routerMode.ts. */
  readonly VITE_HASH_ROUTER?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
