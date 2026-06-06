import { describe, it, expect } from "vitest";
import type { PrescribedExerciseView, SetActual } from "../types";
import { setTonnage, sessionTonnage, heaviestSet, completion } from "./sessionStats";

const ex = (over: Partial<PrescribedExerciseView>): PrescribedExerciseView => ({
  movementId: "arranque", movementName: "Arranque", sets: 3, reps: 2, ...over,
});
const set = (kg: number | undefined, reps: number | undefined, done: boolean): SetActual => ({ kg, reps, done });

describe("setTonnage", () => {
  it("kg×reps cuando está hecha y tiene ambos datos", () => {
    expect(setTonnage(set(100, 2, true))).toBe(200);
  });
  it("0 si no está hecha, o falta kg o reps", () => {
    expect(setTonnage(set(100, 2, false))).toBe(0);
    expect(setTonnage(set(undefined, 2, true))).toBe(0);
    expect(setTonnage(set(100, undefined, true))).toBe(0);
  });
});

describe("sessionTonnage", () => {
  it("suma sólo series hechas con kg&reps de todos los ejercicios", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false,
        sets: [set(60, 2, true), set(60, 2, true), set(60, 2, false)] } }),
      ex({ movementId: "sentadilla", movementName: "Sentadilla", actual: { done: true, movementId: "sentadilla", movementName: "Sentadilla", substituted: false, desfasado: false,
        sets: [set(100, 5, true)] } }),
    ];
    expect(sessionTonnage(exercises)).toBe(60 * 2 + 60 * 2 + 100 * 5); // 740
  });
  it("el calentamiento (warmup) no entra: vive fuera de actual.sets", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ warmup: [{ pct: 0, kg: 20, reps: 5, label: "barra" }],
        actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false,
          sets: [set(80, 2, true)] } }),
    ];
    expect(sessionTonnage(exercises)).toBe(160);
  });
  it("sin actual → 0", () => {
    expect(sessionTonnage([ex({})])).toBe(0);
  });
});

describe("heaviestSet", () => {
  it("elige el mayor kg hecho y devuelve el movimiento real (actual)", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false, sets: [set(60, 2, true)] } }),
      ex({ movementId: "envion", movementName: "Envión", actual: { done: true, movementId: "envion", movementName: "Envión", substituted: false, desfasado: false, sets: [set(140, 1, true), set(142, 1, true)] } }),
    ];
    expect(heaviestSet(exercises)).toEqual({ movementName: "Envión", kg: 142 });
  });
  it("empate → la primera", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ movementName: "A", actual: { done: true, movementId: "a", movementName: "A", substituted: false, desfasado: false, sets: [set(100, 2, true)] } }),
      ex({ movementName: "B", actual: { done: true, movementId: "b", movementName: "B", substituted: false, desfasado: false, sets: [set(100, 2, true)] } }),
    ];
    expect(heaviestSet(exercises)).toEqual({ movementName: "A", kg: 100 });
  });
  it("null cuando ninguna serie hecha tiene kg (sustituido/limpio o no-hecho)", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: true, desfasado: false, sets: [set(undefined, 2, true)] } }),
      ex({ actual: { done: false, movementId: "envion", movementName: "Envión", substituted: false, desfasado: false, sets: [set(140, 1, false)] } }),
    ];
    expect(heaviestSet(exercises)).toBeNull();
  });
});

describe("completion", () => {
  it("cuenta ejercicios con ≥1 serie hecha / total", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ actual: { done: true, movementId: "a", movementName: "A", substituted: false, desfasado: false, sets: [set(60, 2, true), set(60, 2, false)] } }),
      ex({ actual: { done: false, movementId: "b", movementName: "B", substituted: false, desfasado: false, sets: [set(60, 2, false)] } }),
    ];
    expect(completion(exercises)).toEqual({ done: 1, total: 2 });
  });
  it("ejercicio sin actual cuenta como no hecho", () => {
    expect(completion([ex({}), ex({})])).toEqual({ done: 0, total: 2 });
  });
});
