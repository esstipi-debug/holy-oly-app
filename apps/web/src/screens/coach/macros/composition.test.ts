import { describe, it, expect } from "vitest";
import { dnaForFamily, MACROCYCLES } from "@holy-oly/core";
import { signatureGroups, excludedNames, intensitySignature, displayName, typicalWeek, hasTypicalWeek } from "./composition";

const bulgaro = dnaForFamily("Búlgaro")!;
const ruso = dnaForFamily("Ruso")!;
const bulgaroMacro = MACROCYCLES.find((m) => m.id === "bulgaro-6d")!;

describe("displayName", () => {
  it("resuelve variantes de la librería a su nombre, jamás el id crudo", () => {
    expect(displayName("arranque")).not.toMatch(/[a-z]-[a-z]|\./);
    expect(displayName("arranque").length).toBeGreaterThan(0);
  });
  it("humaniza un id desconocido (sin dejar guiones/puntos crudos)", () => {
    expect(displayName("press-banca")).not.toMatch(/-/);
  });
});

describe("signatureGroups", () => {
  it("Búlgaro: sólo levantamientos y sentadillas, en ese orden (gesto → pierna)", () => {
    const groups = signatureGroups(bulgaro);
    expect(groups.map((g) => g.slot)).toEqual(["olimpico", "rodilla"]);
    expect(groups[0]!.label).toBe("Levantamientos");
    expect(groups[0]!.names).toHaveLength(2);
    expect(groups[0]!.names.some((n) => /arranque/i.test(n))).toBe(true);
  });

  it("Ruso: incluye un grupo de Complejos y pone los levantamientos primero", () => {
    const groups = signatureGroups(ruso);
    expect(groups[0]!.slot).toBe("olimpico");
    expect(groups.some((g) => g.slot === "complejo" && g.label === "Complejos")).toBe(true);
  });

  it("ordena los nombres por preferencia de rotación (weight desc)", () => {
    // El arranque (weight 4) precede a cargada-envión (weight 3) en el repertorio ruso.
    const oly = signatureGroups(ruso).find((g) => g.slot === "olimpico")!;
    expect(oly.names[0]).toMatch(/arranque/i);
  });
});

describe("excludedNames", () => {
  it("Búlgaro deja fuera todo lo que no sea gesto+sentadilla (lista no vacía, nombres legibles)", () => {
    const ex = excludedNames(bulgaro);
    expect(ex).toHaveLength(bulgaro.forbidden.length);
    expect(ex.length).toBeGreaterThan(5);
    expect(ex.every((n) => n.length > 0 && !/[a-z]-[a-z]/.test(n))).toBe(true);
  });

  it("Ruso no excluye nada → lista vacía", () => {
    expect(excludedNames(ruso)).toEqual([]);
  });
});

describe("intensitySignature", () => {
  it("Búlgaro (bias alto + singles desde la base) → techo + singles tempranos", () => {
    const s = intensitySignature(bulgaro);
    expect(s).toMatch(/techo/i);
    expect(s).toMatch(/singles pesados desde temprano/i);
  });

  it("Ruso (bias medio + singles sólo en pico) → medios + singles en el pico", () => {
    const s = intensitySignature(ruso);
    expect(s).toMatch(/medios/i);
    expect(s).toMatch(/singles en el pico/i);
  });
});

describe("typicalWeek", () => {
  it("Búlgaro: 6 sesiones, cada ejercicio con nombre y % (daily max ≥ 90%)", () => {
    const sessions = typicalWeek(bulgaroMacro, "dailymax");
    expect(sessions).not.toBeNull();
    expect(sessions!).toHaveLength(6);
    const allEx = sessions!.flatMap((s) => s.exercises);
    expect(allEx.length).toBeGreaterThan(0);
    expect(allEx.every((e) => e.name.length > 0)).toBe(true);
    expect(allEx.every((e) => e.pct != null && e.pct >= 90)).toBe(true);
  });

  it("las sesiones vienen ordenadas por día (sessionIdx) y sus ejercicios por orden", () => {
    const sessions = typicalWeek(bulgaroMacro, "dailymax")!;
    expect(sessions.map((s) => s.day)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("fase inexistente → null (sin-dato honesto)", () => {
    expect(typicalWeek(bulgaroMacro, "no-existe")).toBeNull();
  });
});

describe("hasTypicalWeek", () => {
  it("Búlgaro 6D tiene receta sesión-por-sesión", () => {
    expect(hasTypicalWeek(bulgaroMacro)).toBe(true);
  });
  it("un macro sin receta (id desconocido) → false", () => {
    expect(hasTypicalWeek({ ...bulgaroMacro, id: "no-recipe-xyz" })).toBe(false);
  });
});
