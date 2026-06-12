import { describe, it, expect } from "vitest";
import type { SessionActual, SessionMark } from "../types";
import { DAILY_WINDOW_WEEKS, dailyFromDate, buildDailyView, type DailyLogRow } from "./dailyView";

// ── Fixtures ──────────────────────────────────────────────────────────────────
// ruso-5d es 16 semanas (su phaseProfile cierra en la semana 16). startDate = HOY ancla la
// semana 1 a HOY → ventana del día a día = [max(1, 1-8+1)=1 .. currentWeek=1].
const RUSO = "ruso-5d";
const TODAY = "2026-03-15";

const log = (date: string, over: Partial<DailyLogRow> = {}): DailyLogRow => ({
  date, fatiga: 2, dolor: 1, estres: 2, humor: 4, motivacion: 5, sueno: 4, ...over,
});
const actual = (week: number, sessionIdx: number, order: number, done: boolean): SessionActual => ({
  week, sessionIdx, order, movementId: "arranque", done,
});

function baseInput(over: Partial<Parameters<typeof buildDailyView>[0]> = {}) {
  return {
    today: TODAY, macroId: RUSO, startDate: TODAY,
    dayLogs: [] as DailyLogRow[], prescription: [] as { week: number; sessionIdx: number }[],
    actuals: [] as SessionActual[], marks: [] as SessionMark[], ...over,
  };
}

describe("dailyFromDate", () => {
  it("resta windowWeeks*7 días en UTC (mismo cálculo que el isoMinusDays previo)", () => {
    // Arrange + Act
    const from = dailyFromDate(TODAY, DAILY_WINDOW_WEEKS); // 8 semanas = 56 días antes
    // Assert: 2026-03-15 − 56 días = 2026-01-18
    expect(from).toBe("2026-01-18");
  });

  it("usa DAILY_WINDOW_WEEKS por defecto", () => {
    expect(dailyFromDate(TODAY)).toBe(dailyFromDate(TODAY, DAILY_WINDOW_WEEKS));
  });
});

describe("buildDailyView — check-ins (independientes del plan)", () => {
  it("filtra por fromDate y ordena ascendente por fecha", () => {
    // Arrange: tres logs, uno justo fuera de la ventana (fromDate exclusivo-por-debajo).
    const fromDate = dailyFromDate(TODAY); // 2026-01-18
    const input = baseInput({
      macroId: null, // sin macro → adherencia vacía, pero check-ins igual presentes
      dayLogs: [
        log("2026-03-10", { weight: 61 }),
        log("2026-01-17"),               // 1 día ANTES de fromDate → excluido
        log(fromDate, { weight: 60 }),   // == fromDate → incluido (inclusive)
        log("2026-02-01"),
      ],
    });

    // Act
    const view = buildDailyView(input);

    // Assert: tres dentro de ventana, orden cronológico ascendente.
    expect(view.fromDate).toBe(fromDate);
    expect(view.checkins.map((c) => c.date)).toEqual([fromDate, "2026-02-01", "2026-03-10"]);
    expect(view.checkins.find((c) => c.date === "2026-03-10")?.weight).toBe(61);
    expect(view.checkins.find((c) => c.date === fromDate)?.weight).toBe(60);
  });

  it("check-ins presentes aunque NO haya plan; adherencia vacía honesta", () => {
    // Arrange
    const input = baseInput({
      macroId: null,
      dayLogs: [log("2026-03-12", { weight: 62 })],
      prescription: [{ week: 1, sessionIdx: 0 }], // existe pero sin macro no se usa
    });

    // Act
    const view = buildDailyView(input);

    // Assert
    expect(view.checkins).toHaveLength(1);
    expect(view.adherence).toEqual([]);
  });

  it("macro inexistente (totalWeeks 0) → adherencia vacía, check-ins igual", () => {
    // Arrange
    const input = baseInput({
      macroId: "no-existe-este-macro",
      dayLogs: [log("2026-03-12")],
      prescription: [{ week: 1, sessionIdx: 0 }],
    });

    // Act
    const view = buildDailyView(input);

    // Assert
    expect(view.checkins).toHaveLength(1);
    expect(view.adherence).toEqual([]);
  });

  it("weight ausente queda undefined (no se inventa)", () => {
    const view = buildDailyView(baseInput({ macroId: null, dayLogs: [log("2026-03-12")] }));
    expect(view.checkins[0]?.weight).toBeUndefined();
  });
});

describe("buildDailyView — ventana de semanas (límites)", () => {
  // startDate anclado para que HOY caiga en una semana avanzada → la ventana corta semanas viejas.
  // currentWeek = 10 si startDate = HOY − 9 semanas. fromWeek = max(1, 10-8+1) = 3.
  const START_W10 = "2026-01-11"; // 2026-03-15 − 63 días (9 semanas) → semana 10
  const w10Input = (over: Partial<Parameters<typeof buildDailyView>[0]> = {}) =>
    baseInput({ startDate: START_W10, ...over });

  it("incluye la sesión de la semana JUSTO dentro de la ventana (fromWeek=3)", () => {
    // Arrange: prescripción en semana 3 (límite inferior inclusivo).
    const input = w10Input({
      prescription: [{ week: 3, sessionIdx: 0 }],
      actuals: [actual(3, 0, 0, true)],
    });

    // Act
    const view = buildDailyView(input);

    // Assert: la sesión entra y se reconcilia.
    expect(view.adherence).toHaveLength(1);
    expect(view.adherence[0]).toMatchObject({ week: 3, idx: 0, status: "done", source: "athlete" });
  });

  it("excluye la sesión de la semana JUSTO fuera de la ventana (semana 2 < fromWeek=3)", () => {
    // Arrange
    const input = w10Input({
      prescription: [{ week: 2, sessionIdx: 0 }, { week: 3, sessionIdx: 0 }],
      actuals: [actual(2, 0, 0, true), actual(3, 0, 0, true)],
    });

    // Act
    const view = buildDailyView(input);

    // Assert: sólo la semana 3 sobrevive; la 2 quedó fuera.
    expect(view.adherence.map((a) => a.week)).toEqual([3]);
  });

  it("excluye semanas FUTURAS (más allá de currentWeek)", () => {
    // Arrange: sesión en semana 11 (currentWeek=10) → fuera por arriba.
    const input = w10Input({
      prescription: [{ week: 10, sessionIdx: 0 }, { week: 11, sessionIdx: 0 }],
      actuals: [actual(10, 0, 0, true), actual(11, 0, 0, true)],
    });

    // Act
    const view = buildDailyView(input);

    // Assert
    expect(view.adherence.map((a) => a.week)).toEqual([10]);
  });
});

describe("buildDailyView — dedup de sesiones planificadas", () => {
  it("colapsa filas de la misma (week, sessionIdx) en UNA sesión y ordena", () => {
    // Arrange: dos ejercicios en la sesión (1,0), uno en (1,1), desordenados.
    const input = baseInput({
      prescription: [
        { week: 1, sessionIdx: 1 },
        { week: 1, sessionIdx: 0 },
        { week: 1, sessionIdx: 0 }, // duplicado de (1,0) — mismo slot
      ],
    });

    // Act
    const view = buildDailyView(input);

    // Assert: (1,0) y (1,1) distintos, ordenados por (week, idx).
    expect(view.adherence.map((a) => `${a.week}:${a.idx}`)).toEqual(["1:0", "1:1"]);
  });
});

describe("buildDailyView — delegación a reconcileAdherence (atleta > coach > none)", () => {
  it("el actual del atleta GANA sobre el mark del coach (divergencia)", () => {
    // Arrange: el coach marca (1,0) done; el atleta registra la misma sesión como NO hecha.
    const input = baseInput({
      prescription: [{ week: 1, sessionIdx: 0 }],
      marks: [{ week: 1, idx: 0, status: "done" }],
      actuals: [actual(1, 0, 0, false)],
    });

    // Act
    const view = buildDailyView(input);

    // Assert: la verdad del atleta manda.
    expect(view.adherence[0]).toMatchObject({ status: "skipped", source: "athlete" });
  });

  it("sin actuals cae al mark del coach; sesión sin dato → none/none", () => {
    // Arrange
    const input = baseInput({
      prescription: [{ week: 1, sessionIdx: 0 }, { week: 1, sessionIdx: 1 }],
      marks: [{ week: 1, idx: 0, status: "done" }],
    });

    // Act
    const view = buildDailyView(input);

    // Assert
    expect(view.adherence.find((a) => a.idx === 0)).toMatchObject({ status: "done", source: "coach" });
    expect(view.adherence.find((a) => a.idx === 1)).toMatchObject({ status: "none", source: "none" });
  });
});

describe("buildDailyView — el ciclo JAMÁS sale por acá", () => {
  it("el output no contiene ningún campo de ciclo ni RPE", () => {
    // Arrange: input con todo poblado.
    const input = baseInput({
      dayLogs: [log("2026-03-12", { weight: 61 })],
      prescription: [{ week: 1, sessionIdx: 0 }],
      actuals: [actual(1, 0, 0, true)],
      marks: [{ week: 1, idx: 0, status: "done" }],
    });

    // Act
    const view = buildDailyView(input);

    // Assert: serializado, ni ciclo ni rpe. Y las claves de nivel superior son exactamente las 4.
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/luteal|cycle|ciclo|fase|fertil|menstru/i);
    expect(json).not.toMatch(/rpe/i);
    expect(Object.keys(view).sort()).toEqual(["adherence", "checkins", "fromDate", "today"]);
  });
});
