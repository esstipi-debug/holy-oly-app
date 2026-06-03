import { describe, it, expect } from "vitest";
import { MOVEMENT_BASES } from "../data/movements";
import { MOVEMENTS, computeComplexity, movementDisplayName, getMovement } from "./movements";

describe("MOVEMENT_BASES (catalog integrity)", () => {
  it("has unique base ids", () => {
    const ids = MOVEMENT_BASES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every substituteBases id refers to an existing base", () => {
    const ids = new Set(MOVEMENT_BASES.map((b) => b.id));
    for (const b of MOVEMENT_BASES) for (const s of b.substituteBases) expect(ids.has(s)).toBe(true);
  });
  it("every rmRef is one of the 5 valid values", () => {
    const valid = new Set(["arranque", "envion", "sentadilla", "frente", "none"]);
    for (const b of MOVEMENT_BASES) expect(valid.has(b.rmRef)).toBe(true);
  });
});

describe("computeComplexity", () => {
  it("applies the deltas and clamps to 1..12", () => {
    expect(computeComplexity(9, { flags: [] })).toBe(9); // full from floor
    expect(computeComplexity(9, { captura: "potencia", origen: "colgado", posicion: "rodilla", flags: [] })).toBe(6); // hang power snatch
    expect(computeComplexity(9, { captura: "potencia", origen: "colgado", posicion: "alto", flags: [] })).toBe(5);
    expect(computeComplexity(7, { tipoEnvion: "fuerza", flags: [] })).toBe(5);
    expect(computeComplexity(2, { flags: ["pausa", "tempo"] })).toBe(4);
    expect(computeComplexity(2, { captura: "potencia", flags: [] })).toBe(1); // clamp ≥1
  });
});

describe("movementDisplayName", () => {
  it("composes the Spanish name from base + modifiers", () => {
    expect(movementDisplayName("Arranque", { captura: "potencia", origen: "colgado", posicion: "rodilla", flags: [] }))
      .toBe("Arranque de potencia colgado (rodilla)");
    expect(movementDisplayName("Envión", { tipoEnvion: "tijera", flags: [] })).toBe("Envión en tijera");
    expect(movementDisplayName("Sentadilla", { flags: ["pausa"] })).toBe("Sentadilla con pausa");
    expect(movementDisplayName("Arranque", { captura: "completo", origen: "piso", flags: [] })).toBe("Arranque");
  });
});

describe("MOVEMENTS (generation)", () => {
  it("generates the full variant set (68)", () => {
    expect(MOVEMENTS.length).toBe(68);
  });
  it("the canonical full snatch from floor is id 'arranque'", () => {
    const a = getMovement("arranque");
    expect(a).toBeDefined();
    expect(a!.rmRef).toBe("arranque");
    expect(a!.complexity).toBe(9);
  });
  it("hang power snatch (rodilla) exists with the derived id/name/complexity", () => {
    const m = getMovement("arranque.potencia.colgado.rodilla");
    expect(m).toBeDefined();
    expect(m!.rmRef).toBe("arranque");
    expect(m!.complexity).toBe(6);
    expect(m!.name).toContain("potencia");
    expect(m!.name).toContain("colgado");
  });
  it("posición never appears with origen 'piso'; ids are unique", () => {
    for (const m of MOVEMENTS) if (m.modifiers.origen === "piso") expect(m.modifiers.posicion).toBeUndefined();
    const ids = MOVEMENTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MOVEMENTS) expect(m.complexity).toBeGreaterThanOrEqual(1);
  });
  it("the jerk has no bare 'envion' id (always a tipoEnvion suffix)", () => {
    expect(getMovement("envion")).toBeUndefined();
    expect(getMovement("envion.tijera")).toBeDefined();
  });
});
