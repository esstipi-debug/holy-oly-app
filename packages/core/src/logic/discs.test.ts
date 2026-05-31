import { describe, it, expect } from "vitest";
import { perSide, DISC_COLORS } from "./discs";

describe("perSide (barra 20kg)", () => {
  it("140kg -> 25,25,10 por lado", () => { expect(perSide(140)).toEqual([25, 25, 10]); });
  it("60kg -> 20", () => { expect(perSide(60)).toEqual([20]); });
  it("barra sola o menos -> vacío", () => { expect(perSide(20)).toEqual([]); expect(perSide(24)).toEqual([]); });
  it("respeta barra de 15kg (mujer)", () => { expect(perSide(65, 15)).toEqual([25]); });
  it("solo usa 10/15/20/25", () => {
    for (const d of perSide(137.5)) expect([10,15,20,25]).toContain(d);
  });
  it("tiene colores para cada disco", () => {
    for (const d of [10,15,20,25] as const) expect(DISC_COLORS[d]).toBeTruthy();
  });
});
