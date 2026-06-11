// @vitest-environment node
// (sin DOM a propósito: bajo jsdom import.meta.url es http:// y no se puede leer el archivo)
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Guard de regresión del espejo D1: los tokens :root de theme.css y las constantes de status.ts
// son la MISMA paleta declarada dos veces (CSS no puede importar TS ni viceversa). Si alguien
// cambia un lado y no el otro, este test revienta antes de que el drift llegue a una pantalla.
// (Texto crudo vía fs: el import `theme.css?raw` no entrega el contenido bajo este vitest.)
import { STATUS, GOLD } from "../status";

const css = readFileSync(fileURLToPath(new URL("../../styles/theme.css", import.meta.url)), "utf8");

/** Primera declaración `--name:#hex;` del CSS (la de :root va antes que cualquier skin). */
function tokenOf(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!m) throw new Error(`token --${name} no encontrado en theme.css`);
  return m[1]!;
}

it("sanity: theme.css se leyó con contenido real", () => {
  expect(css).toContain(":root");
});

describe("espejo theme.css :root ↔ ui/status.ts (D1)", () => {
  it("--ok coincide EXACTO con STATUS.ok", () => {
    expect(tokenOf("ok")).toBe(STATUS.ok);
  });

  it("--warn coincide EXACTO con STATUS.warn", () => {
    expect(tokenOf("warn")).toBe(STATUS.warn);
  });

  it("--alert coincide EXACTO con STATUS.alert", () => {
    expect(tokenOf("alert")).toBe(STATUS.alert);
  });

  it("--gold coincide EXACTO con GOLD", () => {
    expect(tokenOf("gold")).toBe(GOLD);
  });
});
