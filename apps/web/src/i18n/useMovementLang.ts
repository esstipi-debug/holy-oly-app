import { useCallback } from "react";
import { useLocale } from "./useLocale";
import {
  resolveMovementLang,
  useMovementLangPref,
  setMovementLangPref,
  type MovementLang,
} from "./movementLang";
import { composeMovementName } from "./movementName";

/**
 * Movement-name nomenclature language bound to the active UI locale. `resolved` ("es" | "en") is
 * what the Fase 2 movement display builder consumes; `pref`/`setPref` drive the Cuenta toggle.
 */
export function useMovementLang(): {
  pref: MovementLang;
  setPref: (p: MovementLang) => void;
  resolved: "es" | "en";
} {
  const { lang } = useLocale();
  const pref = useMovementLangPref();
  return { pref, setPref: setMovementLangPref, resolved: resolveMovementLang(pref, lang) };
}

/**
 * Resolver de nombre de movimiento/complejo ligado al idioma de nomenclatura activo. Devuelve una
 * función `(id) => string` que proyecta el id programable al nombre localizado (ES del core / EN
 * compuesto). Reemplaza el `movementName` horneado y a `programmableName` en la capa de display.
 */
export function useMovementName(): (id: string) => string {
  const { resolved } = useMovementLang();
  return useCallback((id: string) => composeMovementName(id, resolved), [resolved]);
}
