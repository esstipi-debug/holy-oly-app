/**
 * Best-effort IP → país (ISO-3166 alpha-2). Resuelve el país en el ALTA y devuelve solo el código
 * de dos letras; la IP NUNCA se persiste (es dato personal). Diseñado para no romper ni demorar de
 * más el signup: cualquier error/timeout/IP privada → null. Pensado para correrse FUERA de la
 * transacción de DB (hace una llamada de red), pasando el resultado ya resuelto a la provisión.
 *
 * Requiere `trustProxy` en Fastify para que `req.ip` sea la IP real del cliente (X-Forwarded-For)
 * detrás del proxy de Render — si no, la IP es la del balanceador y no geolocaliza al usuario.
 *
 * Proveedor configurable por `GEOIP_LOOKUP_URL` (placeholder `{ip}`). Default: ip-api.com (free, sin
 * key). Se puede desactivar con `GEOIP_DISABLED=true`.
 */

const TIMEOUT_MS = 1500;

// Rangos no enrutables públicamente (loopback, privadas RFC1918, link-local, ULA IPv6). Sin geo.
const PRIVATE_IPV4 = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/** ¿La IP es pública (geolocalizable)? Normaliza IPv6-mapped IPv4 (`::ffff:1.2.3.4`). */
export function isPublicIp(ip: string | undefined | null): ip is string {
  if (!ip) return false;
  const v = ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
  if (v === "::1" || v === "localhost" || v === "") return false;
  // IPv6 privadas/loopback: ::1 (arriba), fc00::/7 (fc/fd), fe80::/10 (link-local).
  if (/^(fc|fd|fe80:)/i.test(v)) return false;
  return !PRIVATE_IPV4.test(v);
}

/** Normaliza el código de país a alpha-2 mayúsculas, o null si no es válido. */
export function normalizeCountry(raw: unknown): string | null {
  const cc = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return /^[A-Z]{2}$/.test(cc) ? cc : null;
}

/**
 * Resuelve el país de una IP. Best-effort: null ante cualquier problema. Nunca lanza.
 * No golpea la red bajo NODE_ENV=test ni para IPs privadas → suite rápida y determinista.
 */
export async function countryFromIp(ip: string | undefined | null): Promise<string | null> {
  if (process.env.NODE_ENV === "test") return null;
  if (process.env.GEOIP_DISABLED === "true") return null;
  if (!isPublicIp(ip)) return null;

  const template = process.env.GEOIP_LOOKUP_URL ?? "http://ip-api.com/json/{ip}?fields=status,countryCode";
  const url = template.replace("{ip}", encodeURIComponent(ip));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const body = (await res.json()) as { countryCode?: unknown; country_code?: unknown; country?: unknown };
    return normalizeCountry(body.countryCode ?? body.country_code ?? body.country);
  } catch {
    return null;
  }
}
