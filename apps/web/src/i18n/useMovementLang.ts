import { useLocale } from "./useLocale";
import {
  resolveMovementLang,
  useMovementLangPref,
  setMovementLangPref,
  type MovementLang,
} from "./movementLang";

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
