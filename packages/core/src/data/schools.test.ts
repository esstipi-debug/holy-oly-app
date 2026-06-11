import { describe, it, expect } from "vitest";
import { SCHOOL_DNA, dnaForFamily } from "./schools";
import { MACROCYCLES, MACROCYCLE_FAMILIES } from "./macrocycles";
import { getMovement, getBase } from "../logic/movements";
import { getComplex, isComplexId } from "../logic/complexes";
import { phaseRole, archetypesFor } from "../logic/recipeGen";

/** baseIds que un id de repertorio toca (variante → su base; complejo → las bases de sus eslabones). */
function baseIdsOf(id: string): string[] {
  if (isComplexId(id)) {
    const cx = getComplex(id);
    return cx ? cx.links.map((l) => getMovement(l.movementId)!.baseId) : [];
  }
  const mv = getMovement(id);
  return mv ? [mv.baseId] : [];
}

describe("SCHOOL_DNA (integridad de las 10 familias)", () => {
  it("cubre exactamente las 10 familias del catálogo", () => {
    expect(SCHOOL_DNA.map((d) => d.family).sort()).toEqual([...MACROCYCLE_FAMILIES].sort());
    for (const f of MACROCYCLE_FAMILIES) expect(dnaForFamily(f)).toBeDefined();
  });
  it("todo id de repertorio resuelve (variante de la librería o complejo)", () => {
    for (const dna of SCHOOL_DNA)
      for (const items of Object.values(dna.repertoire))
        for (const item of items!) {
          const ok = isComplexId(item.id) ? getComplex(item.id) != null : getMovement(item.id) != null;
          expect(ok, `${dna.family}: ${item.id} debe resolver`).toBe(true);
          expect(item.weight).toBeGreaterThanOrEqual(1);
        }
  });
  it("forbidden ∩ repertorio = ∅ (por baseId, incluyendo eslabones de complejos)", () => {
    for (const dna of SCHOOL_DNA) {
      const forbidden = new Set(dna.forbidden);
      for (const f of dna.forbidden) expect(getBase(f), `${dna.family}: forbidden ${f} debe ser baseId real`).toBeDefined();
      for (const items of Object.values(dna.repertoire))
        for (const item of items!)
          for (const b of baseIdsOf(item.id))
            expect(forbidden.has(b), `${dna.family}: ${item.id} toca base prohibida ${b}`).toBe(false);
    }
  });
  it("el generador sólo programa kg derivables: cero rmRef 'none' en repertorios", () => {
    for (const dna of SCHOOL_DNA)
      for (const items of Object.values(dna.repertoire))
        for (const item of items!) {
          if (isComplexId(item.id)) continue; // integridad de cx ya garantiza rmRef ≠ none
          expect(getMovement(item.id)!.rmRef, `${dna.family}: ${item.id}`).not.toBe("none");
        }
  });
  it("arquetipos cubren (con fallback) todos los roles que los macros de la familia producen", () => {
    for (const m of MACROCYCLES) {
      const dna = dnaForFamily(m.family)!;
      for (const p of m.phaseProfile) {
        const role = phaseRole(p);
        const archetypes = archetypesFor(dna, role);
        expect(archetypes.length, `${m.id}/${p.key} (rol ${role}) sin arquetipos en ${m.family}`).toBeGreaterThan(0);
      }
    }
  });
  it("presupuestos > 0, técnicos ≤ 3, fuentes citadas, carácter presente", () => {
    for (const dna of SCHOOL_DNA) {
      for (const v of Object.values(dna.sncBudget)) expect(v).toBeGreaterThan(0);
      expect(dna.tecnicosMax).toBeLessThanOrEqual(3);
      expect(dna.sources.length).toBeGreaterThanOrEqual(1);
      expect(dna.character.length).toBeGreaterThan(10);
      expect([1, 2]).toContain(dna.sessionsPerDay);
    }
  });
  it("todo slot usado por un arquetipo tiene repertorio en esa escuela", () => {
    for (const dna of SCHOOL_DNA)
      for (const archetypes of Object.values(dna.archetypes))
        for (const a of archetypes!)
          for (const slot of a.slots)
            expect(dna.repertoire[slot]?.length ?? 0, `${dna.family}/${a.key}: slot ${slot} sin repertorio`).toBeGreaterThan(0);
  });
});
