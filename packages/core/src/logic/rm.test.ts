import { describe, it, expect } from "vitest";
import { prCandidates, rmVigencia, RM_LIFTS } from "./rm";
import type { RM, RmUpdate, SessionActual } from "../types";

const RMS: RM = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
const base = { week: 1, sessionIdx: 0, order: 0, done: true } as const;

describe("prCandidates", () => {
  it("set hecho con kg > RM del rmRef → candidato (con nombre del movimiento)", () => {
    const out = prCandidates([{ ...base, movementId: "arranque", actualKg: 85 }], RMS);
    expect(out).toEqual([{ lift: "arranque", movementId: "arranque", movementName: "Arranque", kg: 85, week: 1, sessionIdx: 0 }]);
  });

  it("estricto: igualar el RM NO es PR (auto-resuelve al confirmar)", () => {
    expect(prCandidates([{ ...base, movementId: "arranque", actualKg: 80 }], RMS)).toEqual([]);
  });

  it("la variante cuenta contra el RM de su lift base (arranque.potencia ≥ RM arranque)", () => {
    const out = prCandidates([{ ...base, movementId: "arranque.potencia", actualKg: 82 }], RMS);
    expect(out).toHaveLength(1);
    expect(out[0]!.lift).toBe("arranque");
    expect(out[0]!.movementName).toMatch(/potencia/i);
  });

  it("ignora no-hechos, sin kg, y movimientos desconocidos", () => {
    expect(prCandidates([
      { ...base, movementId: "arranque", actualKg: 95, done: false },
      { ...base, movementId: "arranque" }, // sin actualKg
      { ...base, movementId: "movimiento-inventado", actualKg: 999 },
    ], RMS)).toEqual([]);
  });

  it("por lift devuelve sólo el de mayor kg; empate → el más reciente (semana mayor)", () => {
    const out = prCandidates([
      { ...base, movementId: "arranque", actualKg: 85 },
      { ...base, week: 2, movementId: "arranque.potencia", actualKg: 88 },
      { ...base, week: 3, movementId: "arranque", actualKg: 88 },
    ], RMS);
    expect(out).toHaveLength(1);
    expect(out[0]!.kg).toBe(88);
    expect(out[0]!.week).toBe(3);
  });

  it("≤ 4 candidatos, en orden estable de lifts (arranque, envion, sentadilla, frente)", () => {
    const out = prCandidates([
      { ...base, movementId: "sentadilla", actualKg: 150 },
      { ...base, movementId: "arranque", actualKg: 85 },
      // OJO dominio: "envion" a secas NO existe en el catálogo (siempre lleva tipo) → tijera.
      { ...base, movementId: "envion.tijera", actualKg: 105 },
      { ...base, movementId: "sentadilla-frente", actualKg: 115 },
    ], RMS);
    expect(out.map((c) => c.lift)).toEqual(["arranque", "envion", "sentadilla", "frente"]);
  });
});

describe("rmVigencia", () => {
  const H = (lift: RmUpdate["lift"], setAt: string): RmUpdate => ({ lift, kg: 100, setAt, reason: "manual" });

  it("toma la última RmUpdate por lift", () => {
    const v = rmVigencia([H("arranque", "2026-05-01"), H("arranque", "2026-06-01")], undefined, "2026-06-10");
    expect(v.arranque).toEqual({ setAt: "2026-06-01", weeksAgo: 1 });
  });

  it("sin historial cae a fallbackDate (planes pre-SP5 → startDate)", () => {
    const v = rmVigencia([], "2026-04-01", "2026-06-10");
    for (const lift of RM_LIFTS) expect(v[lift]).toEqual({ setAt: "2026-04-01", weeksAgo: 10 });
  });

  it("sin historial ni fallback → {} (sin-dato honesto, nunca inventar)", () => {
    const v = rmVigencia([], undefined, "2026-06-10");
    for (const lift of RM_LIFTS) expect(v[lift]).toEqual({});
  });

  it("weeksAgo = floor(días/7), nunca negativo (setAt futuro → 0)", () => {
    expect(rmVigencia([H("envion", "2026-06-04")], undefined, "2026-06-10").envion.weeksAgo).toBe(0);
    expect(rmVigencia([H("envion", "2026-06-03")], undefined, "2026-06-10").envion.weeksAgo).toBe(1);
    expect(rmVigencia([H("envion", "2026-07-01")], undefined, "2026-06-10").envion.weeksAgo).toBe(0);
  });

  it("mezcla: un lift con historial, el resto al fallback", () => {
    const v = rmVigencia([H("frente", "2026-06-08")], "2026-04-01", "2026-06-10");
    expect(v.frente).toEqual({ setAt: "2026-06-08", weeksAgo: 0 });
    expect(v.arranque).toEqual({ setAt: "2026-04-01", weeksAgo: 10 });
  });
});
