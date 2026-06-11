import { describe, it, expect } from "vitest";
import type { SessionTemplate } from "../types";
import { MACROCYCLES, phaseForWeek } from "../data/macrocycles";
import { phaseRole, hashIdx, sessionsPerWeek } from "./recipeGen";

const macro = (id: string) => MACROCYCLES.find((m) => m.id === id)!;
const phase = (macroId: string, key: string) => macro(macroId).phaseProfile.find((p) => p.key === key)!;

describe("phaseRole (clasificador de rol de fase — del dato, no de mapeos a mano)", () => {
  it("clasifica las fases ancla del catálogo", () => {
    expect(phaseRole(phase("bulgaro-6d", "dailymax"))).toBe("peaking");
    expect(phaseRole(phase("ruso-5d", "hipertrofia"))).toBe("base");
    expect(phaseRole(phase("ruso-5d", "fuerza-basica"))).toBe("fuerza");
    expect(phaseRole(phase("ruso-5d", "fuerza-potencia"))).toBe("intensidad");
    expect(phaseRole(phase("ruso-5d", "peaking"))).toBe("peaking");
    expect(phaseRole(phase("chino-5d", "descarga"))).toBe("descarga");
    expect(phaseRole(phase("chino-5d", "choque"))).toBe("peaking");
    expect(phaseRole(phase("polaco-5d", "singles"))).toBe("peaking");
    expect(phaseRole(phase("usa-master", "realizacion"))).toBe("intensidad"); // hi 92 < 95
    expect(phaseRole(phase("hibrido-4d", "transmutacion"))).toBe("fuerza");   // hi 86 < 87
    expect(phaseRole(phase("coreano-5d", "cimentacion"))).toBe("base");        // mid 73 < 74
    expect(phaseRole(phase("cubano-novicio-2d", "cimentacion"))).toBe("base");
    expect(phaseRole(phase("colombiano-5d", "realizacion"))).toBe("peaking");
    expect(phaseRole(phase("ucraniano-3d", "intensificacion"))).toBe("intensidad"); // hi 94 < 95
  });
  it("toda fase del catálogo cae en un rol", () => {
    const roles = new Set(["base", "fuerza", "intensidad", "peaking", "descarga"]);
    for (const m of MACROCYCLES) for (const p of m.phaseProfile) expect(roles.has(phaseRole(p))).toBe(true);
  });
});

describe("hashIdx (rotación determinística, D10)", () => {
  it("estable para el mismo input y distinto para inputs distintos", () => {
    const a = hashIdx(["ruso-5d", "hipertrofia", "A", "0"]);
    expect(hashIdx(["ruso-5d", "hipertrofia", "A", "0"])).toBe(a);
    expect(hashIdx(["ruso-5d", "hipertrofia", "A", "1"])).not.toBe(a);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
  });
});

describe("sessionsPerWeek (frecuencia → sesiones, D15)", () => {
  it("parsea Nd/sem y aplica los overrides nombrados", () => {
    expect(sessionsPerWeek(macro("ruso-5d"))).toBe(5);
    expect(sessionsPerWeek(macro("cubano-novicio-2d"))).toBe(2);
    expect(sessionsPerWeek(macro("usa-school"))).toBe(5);   // "4-5d/sem"
    expect(sessionsPerWeek(macro("hibrido-block"))).toBe(4); // "variable"
  });
});

describe("SessionTemplate.day/turno (D9 — shape de doble sesión)", () => {
  it("los campos opcionales compilan y ausentes = comportamiento actual", () => {
    const s: SessionTemplate = { exercises: [], day: 3, turno: "AM" };
    expect(s.day).toBe(3);
    const legacy: SessionTemplate = { exercises: [] };
    expect(legacy.day).toBeUndefined();
  });
});

// usado por los tests de arriba sin depender del generador completo
void phaseForWeek;
