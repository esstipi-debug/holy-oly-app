import { describe, it, expect } from "vitest";
import { MOVEMENT_BASES } from "../data/movements";
import {
  MOVEMENTS, computeComplexity, movementDisplayName, getMovement,
  getBase, variantsOf, canonicalVariant, simplerVariants, substitutesOf, movementsForRm, searchMovements,
} from "./movements";

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
    expect(computeComplexity(9, { captura: "potencia", origen: "colgado", posicion: "rodilla", flags: [] })).toBe(5); // hang power snatch (rodilla)
    expect(computeComplexity(9, { captura: "potencia", origen: "colgado", posicion: "alto", flags: [] })).toBe(4); // above-knee: even easier
    // monotonic within the hang/blocks family, and all still < the full lift from the floor (9):
    expect(computeComplexity(9, { captura: "completo", origen: "colgado", posicion: "bajo", flags: [] })).toBe(8); // below-knee hardest of the hang variants
    expect(computeComplexity(9, { captura: "completo", origen: "colgado", posicion: "alto", flags: [] })).toBe(6);
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
    expect(m!.complexity).toBe(5);
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

describe("query helpers", () => {
  it("variantsOf returns a base's variants sorted by complexity desc", () => {
    const vs = variantsOf("arranque");
    expect(vs.length).toBe(14);
    expect(vs[0]!.id).toBe("arranque"); // full from floor, complexity 9
    for (let i = 1; i < vs.length; i++) expect(vs[i - 1]!.complexity).toBeGreaterThanOrEqual(vs[i]!.complexity);
  });
  it("canonicalVariant picks the most-complex variant (split jerk for envión)", () => {
    expect(canonicalVariant("arranque")!.id).toBe("arranque");
    expect(canonicalVariant("envion")!.id).toBe("envion.tijera");
    expect(canonicalVariant("sentadilla")!.id).toBe("sentadilla");
  });
  it("simplerVariants = same base, lower complexity (lower the complexity)", () => {
    const s = simplerVariants("arranque");
    expect(s.every((m) => m.complexity < 9)).toBe(true);
    expect(s.some((m) => m.id === "arranque")).toBe(false); // excludes the full lift itself
    expect(s.length).toBe(13);
  });
  it("substitutesOf resolves substituteBases to their canonical variants", () => {
    const subs = substitutesOf("arranque").map((m) => m.id);
    expect(subs).toContain("tiron-arranque");
    expect(subs).toContain("sentadilla-overhead");
  });
  it("movementsForRm filters by the referenced RM", () => {
    expect(movementsForRm("frente").some((m) => m.baseId === "sentadilla-frente")).toBe(true);
    expect(movementsForRm("frente").every((m) => m.rmRef === "frente")).toBe(true);
  });
  it("searchMovements matches Spanish and English terms (accent-insensitive)", () => {
    expect(searchMovements("hang power snatch").some((m) => m.id === "arranque.potencia.colgado.rodilla")).toBe(true);
    expect(searchMovements("arranque potencia colgado").some((m) => m.modifiers.origen === "colgado")).toBe(true);
    expect(searchMovements("sentadilla frontal").some((m) => m.baseId === "sentadilla-frente")).toBe(true);
    expect(searchMovements("").length).toBe(0);
  });
  it("getBase returns the base definition", () => {
    expect(getBase("arranque")!.aliasEn).toBe("Snatch");
    expect(getBase("nope")).toBeUndefined();
  });
  it("simplerVariants / substitutesOf return [] for an unknown id", () => {
    expect(simplerVariants("nonexistent")).toEqual([]);
    expect(substitutesOf("nonexistent")).toEqual([]);
  });
});

describe("accesorios rmRef", () => {
  it("accesorios referencian su RM (no quedan 'none')", () => {
    expect(getMovement("sentadilla-overhead")?.rmRef).toBe("arranque");
    expect(getMovement("press-empuje")?.rmRef).toBe("envion");
    expect(getMovement("press-hombros")?.rmRef).toBe("envion");
    expect(getMovement("peso-muerto-rumano")?.rmRef).toBe("sentadilla");
    expect(getMovement("buenos-dias")?.rmRef).toBe("sentadilla");
    expect(getMovement("remo")?.rmRef).toBe("envion");
  });
});
