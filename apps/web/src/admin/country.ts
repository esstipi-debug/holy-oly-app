/** Helpers de país (puros). Código ISO alpha-2 → bandera emoji + nombre en español, vía Intl. */

/** Bandera emoji desde el código (regional indicator symbols). "" si el código no es válido. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  const cc = code.toUpperCase();
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

let regionNames: Intl.DisplayNames | null | undefined;
function names(): Intl.DisplayNames | null {
  if (regionNames !== undefined) return regionNames;
  try {
    regionNames = new Intl.DisplayNames(["es"], { type: "region" });
  } catch {
    regionNames = null;
  }
  return regionNames;
}

/** Nombre del país en español ("AR" → "Argentina"), o el código si no se puede resolver. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "—";
  const cc = code.toUpperCase();
  try {
    return names()?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** Etiqueta lista para UI: "🇦🇷 Argentina", o "—" si no hay país. */
export function countryLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const flag = countryFlag(code);
  return `${flag ? `${flag} ` : ""}${countryName(code)}`;
}
