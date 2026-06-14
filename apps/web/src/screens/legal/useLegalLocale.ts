import { useState, useCallback } from "react";

/**
 * Idioma de los documentos legales. Base de i18n reutilizable (hoy la consumen sólo las páginas
 * legales; cuando se internacionalice toda la app, este hook + la convención `*.en.tsx` se reusan).
 *
 * Comportamiento: AUTOMÁTICO por idioma del navegador en la primera visita; si el usuario elige
 * manualmente, esa preferencia se recuerda (localStorage) y prevalece sobre la detección.
 */
export type Lang = "es" | "en";

const KEY = "ho:legalLang";

/** Detecta el idioma preferido del visitante. Inglés para `en-*`; español (por defecto) para el resto. */
export function detectLang(): Lang {
  if (typeof navigator !== "undefined" && /^en\b/i.test(navigator.language || "")) return "en";
  return "es";
}

function stored(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "es" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

/** [idioma, setIdioma] — inicia en la preferencia guardada o, si no hay, en la detectada. */
export function useLegalLocale(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(() => stored() ?? detectLang());
  const set = useCallback((l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* almacenamiento no disponible — la elección dura la sesión */
    }
  }, []);
  return [lang, set];
}
