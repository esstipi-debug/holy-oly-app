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

/** Chrome/Edge/Android fire this instead of letting the browser show its own install UI;
 *  capturing it is what lets us render a custom "Instalar app" button. Not in lib.dom.d.ts yet.
 *  This file has no top-level import/export, so it's already a global script — declaring the
 *  interfaces directly here (no `declare global` wrapper) is what makes TS merge them into
 *  the real DOM `WindowEventMap`. */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}
interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent;
}
