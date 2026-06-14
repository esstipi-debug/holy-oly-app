import { useSyncExternalStore } from "react";
import type { Lang } from "./config";

/**
 * Movement-name nomenclature language — INDEPENDENT of the UI language. A coach/athlete can keep
 * the UI in Spanish but read movement names in English (snatch, C&J) or vice versa. "auto" follows
 * the UI locale. The actual name rendering (base + composed modifiers) honors this in the Fase 2
 * core display builder; this module is the preference + reactive store + resolver.
 */
export type MovementLang = "auto" | "es" | "en";

export const MOVEMENT_LANG_KEY = "ho:movlang";
export const MOVEMENT_LANGS: readonly MovementLang[] = ["auto", "es", "en"];

/** Resolve the preference against the active UI language. "auto" → en for an English UI, else es. */
export function resolveMovementLang(pref: MovementLang, uiLang: Lang): "es" | "en" {
  if (pref === "es" || pref === "en") return pref;
  return uiLang === "en" ? "en" : "es";
}

function readStored(): MovementLang {
  try {
    const v = localStorage.getItem(MOVEMENT_LANG_KEY);
    return v === "es" || v === "en" || v === "auto" ? v : "auto";
  } catch {
    return "auto";
  }
}

let pref: MovementLang = readStored();
const listeners = new Set<() => void>();

export function getMovementLangPref(): MovementLang {
  return pref;
}

export function setMovementLangPref(next: MovementLang): void {
  pref = next;
  try {
    localStorage.setItem(MOVEMENT_LANG_KEY, next);
  } catch {
    /* storage unavailable — the choice lasts the session */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Subscribe a component to the movement-language preference (concurrent-safe). */
export function useMovementLangPref(): MovementLang {
  return useSyncExternalStore(subscribe, getMovementLangPref, getMovementLangPref);
}
