/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Holy Oly API. When set, the app uses HttpRepository (Fase 2). */
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
