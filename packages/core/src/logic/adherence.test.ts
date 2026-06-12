import { describe, it, expect } from "vitest";
import type { SessionActual, SessionMark } from "../types";
import { reconcileAdherence } from "./adherence";

/** Helper: a planned session coordinate. */
const at = (week: number, idx: number) => ({ week, idx });

/** Helper: a single-exercise actual row at (week, sessionIdx, order). */
function actual(week: number, sessionIdx: number, order: number, done: boolean): SessionActual {
  return { week, sessionIdx, order, movementId: "arranque", done };
}

describe("reconcileAdherence — el atleta gana sobre el coach", () => {
  it("actuals con todo hecho → done, source 'athlete' (aunque el coach no marcó nada)", () => {
    // Arrange
    const sessions = [at(1, 0)];
    const actuals: SessionActual[] = [actual(1, 0, 0, true), actual(1, 0, 1, true)];
    const marks: SessionMark[] = [];

    // Act
    const result = reconcileAdherence(sessions, actuals, marks);

    // Assert
    expect(result).toEqual([{ week: 1, idx: 0, status: "done", source: "athlete" }]);
  });

  it("algunos ejercicios hechos y otros no → partial, source 'athlete'", () => {
    // Arrange
    const sessions = [at(1, 0)];
    const actuals: SessionActual[] = [actual(1, 0, 0, true), actual(1, 0, 1, false)];

    // Act
    const result = reconcileAdherence(sessions, actuals, []);

    // Assert
    expect(result[0]).toMatchObject({ status: "partial", source: "athlete" });
  });

  it("todos los ejercicios marcados no-hecho → skipped, source 'athlete'", () => {
    // Arrange
    const sessions = [at(1, 0)];
    const actuals: SessionActual[] = [actual(1, 0, 0, false), actual(1, 0, 1, false)];

    // Act
    const result = reconcileAdherence(sessions, actuals, []);

    // Assert
    expect(result[0]).toMatchObject({ status: "skipped", source: "athlete" });
  });

  it("divergencia: el coach dijo 'done' pero el atleta no hizo nada → gana el atleta (skipped/athlete)", () => {
    // Arrange — el coach marcó done; el atleta registró la sesión como no-hecha.
    const sessions = [at(2, 1)];
    const actuals: SessionActual[] = [actual(2, 1, 0, false)];
    const marks: SessionMark[] = [{ week: 2, idx: 1, status: "done" }];

    // Act
    const result = reconcileAdherence(sessions, actuals, marks);

    // Assert — la verdad registrada por el atleta manda sobre el toggle manual del coach.
    expect(result[0]).toMatchObject({ status: "skipped", source: "athlete" });
  });

  it("divergencia inversa: el coach dijo 'missed' pero el atleta SÍ entrenó → gana el atleta (done/athlete)", () => {
    // Arrange
    const sessions = [at(2, 0)];
    const actuals: SessionActual[] = [actual(2, 0, 0, true)];
    const marks: SessionMark[] = [{ week: 2, idx: 0, status: "missed" }];

    // Act
    const result = reconcileAdherence(sessions, actuals, marks);

    // Assert
    expect(result[0]).toMatchObject({ status: "done", source: "athlete" });
  });
});

describe("reconcileAdherence — fallback al mark del coach", () => {
  it("sin actuals, coach marcó 'done' → done, source 'coach'", () => {
    // Arrange
    const sessions = [at(1, 0)];
    const marks: SessionMark[] = [{ week: 1, idx: 0, status: "done" }];

    // Act
    const result = reconcileAdherence(sessions, [], marks);

    // Assert
    expect(result[0]).toEqual({ week: 1, idx: 0, status: "done", source: "coach" });
  });

  it("sin actuals, coach marcó 'missed' → skipped, source 'coach'", () => {
    // Arrange
    const sessions = [at(1, 0)];
    const marks: SessionMark[] = [{ week: 1, idx: 0, status: "missed" }];

    // Act
    const result = reconcileAdherence(sessions, [], marks);

    // Assert
    expect(result[0]).toMatchObject({ status: "skipped", source: "coach" });
  });
});

describe("reconcileAdherence — sin dato → none (jamás inventar)", () => {
  it("ni actuals ni mark → none, source 'none'", () => {
    // Arrange
    const sessions = [at(1, 0)];

    // Act
    const result = reconcileAdherence(sessions, [], []);

    // Assert
    expect(result[0]).toEqual({ week: 1, idx: 0, status: "none", source: "none" });
  });

  it("preserva el orden y la cardinalidad de las sesiones planificadas", () => {
    // Arrange — 3 sesiones; sólo la del medio tiene dato (del atleta).
    const sessions = [at(1, 0), at(1, 1), at(2, 0)];
    const actuals: SessionActual[] = [actual(1, 1, 0, true)];
    const marks: SessionMark[] = [{ week: 2, idx: 0, status: "done" }];

    // Act
    const result = reconcileAdherence(sessions, actuals, marks);

    // Assert
    expect(result).toEqual([
      { week: 1, idx: 0, status: "none", source: "none" },
      { week: 1, idx: 1, status: "done", source: "athlete" },
      { week: 2, idx: 0, status: "done", source: "coach" },
    ]);
  });

  it("ignora actuals/marks de sesiones no incluidas en la lista planificada", () => {
    // Arrange — hay un actual de (9,9) que no corresponde a ninguna sesión pedida.
    const sessions = [at(1, 0)];
    const actuals: SessionActual[] = [actual(9, 9, 0, true)];

    // Act
    const result = reconcileAdherence(sessions, actuals, []);

    // Assert
    expect(result).toEqual([{ week: 1, idx: 0, status: "none", source: "none" }]);
  });
});
