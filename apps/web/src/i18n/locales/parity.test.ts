import { describe, test, expect } from "vitest";

/**
 * Catalog parity guard (covers part of Fase 0 tooling 0.8). Scales automatically: every namespace
 * JSON under locales/ is picked up. Invariants:
 *  - `en` (a full locale) must mirror the `es-419` base key-for-key, per namespace — no missing or
 *    extra keys, so nothing leaks to a fallback at runtime.
 *  - `es-AR` is a voseo *overlay*: every key it defines must exist in the es-419 base (a subset).
 *  - `en-XA` (pseudo) deliberately has no catalog and is not checked here.
 */

const modules = import.meta.glob("./*/*.json", { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>;

/** locale -> namespace -> flattened sorted key list */
const catalogs: Record<string, Record<string, string[]>> = {};
for (const [path, mod] of Object.entries(modules)) {
  const match = /^\.\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!match) continue;
  const locale = match[1]!;
  const ns = match[2]!;
  (catalogs[locale] ??= {})[ns] = flattenKeys(mod.default);
}

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flattenKeys(v as Record<string, unknown>, key));
    } else {
      out.push(key);
    }
  }
  return out.sort();
}

const FULL_LOCALES = ["en"]; // locales expected to be complete (1:1 with es-419)

describe("locale catalog parity", () => {
  test("the es-419 base catalog exists", () => {
    expect(catalogs["es-419"]).toBeTruthy();
    expect(Object.keys(catalogs["es-419"]!).length).toBeGreaterThan(0);
  });

  for (const locale of FULL_LOCALES) {
    test(`${locale} mirrors the es-419 base key-for-key in every namespace`, () => {
      const base = catalogs["es-419"]!;
      for (const ns of Object.keys(base)) {
        expect(catalogs[locale]?.[ns], `${locale} is missing namespace "${ns}"`).toBeTruthy();
        expect(catalogs[locale]![ns], `key mismatch in ${locale}/${ns}`).toEqual(base[ns]);
      }
    });
  }

  test("es-AR is an overlay: every key it defines exists in the es-419 base", () => {
    const base = catalogs["es-419"]!;
    const overlay = catalogs["es-AR"] ?? {};
    for (const ns of Object.keys(overlay)) {
      const baseKeys = new Set(base[ns] ?? []);
      for (const key of overlay[ns]!) {
        expect(baseKeys.has(key), `es-AR/${ns} has key "${key}" not in the es-419 base`).toBe(true);
      }
    }
  });
});
