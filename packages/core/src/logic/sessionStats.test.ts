import { describe, it, expect } from "vitest";
import type { PrescribedExerciseView, SessionView, SetActual } from "../types";
import { setTonnage, sessionTonnage, heaviestSet, completion, warmupTonnage, weekDoneSummary } from "./sessionStats";

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

describe("warmupTonnage (decisión owner 2026-06-11: la rampa cuenta como volumen visible)", () => {
  const W = [
    { pct: 0, kg: 20, reps: 5, label: "barra" as const },
    { pct: 50, kg: 51, reps: 5, label: "rampa" as const },
  ]; // 20×5 + 51×5 = 355
  it("suma kg×reps de la rampa PRESCRITA de los ejercicios hechos", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ warmup: W, actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false, sets: [set(80, 2, true)] } }),
    ];
    expect(warmupTonnage(exercises)).toBe(355);
  });
  it("ejercicio NO hecho → su rampa no suma (no se movió)", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ warmup: W, actual: { done: false, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false, sets: [set(80, 2, false)] } }),
      ex({ warmup: W }), // sin actual
    ];
    expect(warmupTonnage(exercises)).toBe(0);
  });
  it("sustituido en vivo → su rampa no se mostró → no suma (honestidad del 'movido')", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ warmup: W, actual: { done: true, movementId: "sentadilla", movementName: "Sentadilla trasera", substituted: true, desfasado: false, sets: [set(80, 2, true)] } }),
    ];
    expect(warmupTonnage(exercises)).toBe(0);
  });
  it("regresión guarda Carnicero: sessionTonnage (trabajo) JAMÁS incluye la rampa", () => {
    const exercises: PrescribedExerciseView[] = [
      ex({ warmup: W, actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false, sets: [set(80, 2, true)] } }),
    ];
    expect(sessionTonnage(exercises)).toBe(160);
    expect(sessionTonnage(exercises) + warmupTonnage(exercises)).toBe(515);
  });
});

describe("weekDoneSummary (recorrido: lo HECHO de la semana, D2)", () => {
  const W = [
    { pct: 0, kg: 20, reps: 5, label: "barra" as const },
    { pct: 50, kg: 51, reps: 5, label: "rampa" as const },
  ]; // 20×5 + 51×5 = 355
  it("2 sesiones: 1 hecha con warmup + 1 sin actuals → trabajo+rampa separados, 1/2 sesiones", () => {
    const views: SessionView[] = [
      {
        week: 8, sessionIdx: 0,
        exercises: [
          ex({ warmup: W, actual: { done: true, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false,
            sets: [set(60, 2, true), set(60, 2, true)] } }),
        ],
      },
      { week: 8, sessionIdx: 1, exercises: [ex({ movementId: "sentadilla", movementName: "Sentadilla" })] },
    ];
    expect(weekDoneSummary(views)).toEqual({
      trabajoKg: 240,          // 60×2 + 60×2
      calentamientoKg: 355,    // rampa prescrita del ejercicio hecho
      totalKg: 595,
      sesionesHechas: 1,       // sesión hecha = ≥1 ejercicio con ≥1 serie hecha
      sesionesTotales: 2,
    });
  });
  it("sesión con series marcadas NO hechas no cuenta como hecha (ni suma kg)", () => {
    const views: SessionView[] = [
      {
        week: 8, sessionIdx: 0,
        exercises: [
          ex({ warmup: W, actual: { done: false, movementId: "arranque", movementName: "Arranque", substituted: false, desfasado: false,
            sets: [set(60, 2, false)] } }),
        ],
      },
    ];
    expect(weekDoneSummary(views)).toEqual({ trabajoKg: 0, calentamientoKg: 0, totalKg: 0, sesionesHechas: 0, sesionesTotales: 1 });
  });
  it("semana vacía → ceros", () => {
    expect(weekDoneSummary([])).toEqual({ trabajoKg: 0, calentamientoKg: 0, totalKg: 0, sesionesHechas: 0, sesionesTotales: 0 });
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
