import { describe, test, expect } from "vitest";
import { buildMeHeatDays } from "./heatDays";

// "today" fijo: miércoles 2026-06-10 (UTC). calendarWeeks es lunes-first.
const TODAY = "2026-06-10";

describe("buildMeHeatDays", () => {
  test("arma weeksBack filas de 7 días, última fila contiene HOY", () => {
    const h = buildMeHeatDays({ today: TODAY, weeksBack: 12 });
    expect(h.weeks).toHaveLength(12);
    expect(h.weeks.every((w) => w.days.length === 7)).toBe(true);
    expect(h.anchorWeekIdx).toBe(11);
    const lastRow = h.weeks[11]!;
    expect(lastRow.days.some((d) => d.iso === TODAY && d.today)).toBe(true);
  });

  test("marca futuro los días posteriores a HOY (sin dato)", () => {
    const h = buildMeHeatDays({ today: TODAY, weeksBack: 2 });
    const all = h.weeks.flatMap((w) => w.days);
    const future = all.filter((d) => d.iso > TODAY);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((d) => d.future && !d.trained && d.kg === 0)).toBe(true);
  });

  test("conecta carga por día (kg + sesiones) sólo en días pasados con entreno", () => {
    const h = buildMeHeatDays({
      today: TODAY,
      weeksBack: 2,
      training: { [TODAY]: { kg: 8200, sessions: 1 }, "2099-01-01": { kg: 999, sessions: 1 } },
    });
    const cell = h.weeks.flatMap((w) => w.days).find((d) => d.iso === TODAY)!;
    expect(cell.trained).toBe(true);
    expect(cell.kg).toBe(8200);
    expect(cell.sessions).toBe(1);
  });

  test("conecta bienestar y peso desde DayLog por fecha", () => {
    const h = buildMeHeatDays({
      today: TODAY,
      weeksBack: 2,
      daylogs: [{ date: TODAY, wellness: 78, bw: 72.4 }],
    });
    const cell = h.weeks.flatMap((w) => w.days).find((d) => d.iso === TODAY)!;
    expect(cell.wellness).toBe(78);
    expect(cell.bw).toBe(72.4);
    // un día sin registro queda en null (gris honesto)
    const other = h.weeks.flatMap((w) => w.days).find((d) => d.iso !== TODAY && !d.future)!;
    expect(other.wellness).toBeNull();
    expect(other.bw).toBeNull();
  });

  test("HRV/FC semanal sólo se mapea DENTRO del macro; fuera queda en null", () => {
    // macro arranca el lunes 2026-06-08, 2 semanas. weekly hrv index = semana-1.
    const h = buildMeHeatDays({
      today: TODAY,
      weeksBack: 8,
      startDate: "2026-06-08",
      totalWeeks: 2,
      weekly: { hrv: [70, 74], rhr: [52, 50] },
    });
    const all = h.weeks.flatMap((w) => w.days);
    const inMacro = all.find((d) => d.iso === "2026-06-09")!; // semana 1 del macro
    expect(inMacro.hrv).toBe(70);
    expect(inMacro.rhr).toBe(52);
    const preMacro = all.find((d) => d.iso === "2026-05-01")!; // muy anterior al macro
    expect(preMacro.hrv).toBeNull();
    expect(preMacro.rhr).toBeNull();
  });

  test("marca días de competencia con su nombre", () => {
    const h = buildMeHeatDays({
      today: TODAY,
      weeksBack: 2,
      comps: [{ iso: TODAY, name: "Nacional 73 kg", note: "S12" }],
    });
    const cell = h.weeks.flatMap((w) => w.days).find((d) => d.iso === TODAY)!;
    expect(cell.comp).toEqual({ name: "Nacional 73 kg", note: "S12" });
  });

  test("expone índices del macro y bases de bienestar", () => {
    const h = buildMeHeatDays({
      today: TODAY,
      weeksBack: 8,
      startDate: "2026-06-01",
      totalWeeks: 2,
      daylogs: [
        { date: "2026-06-08", wellness: 70, bw: 73 },
        { date: "2026-06-09", wellness: 80, bw: 72.8 },
      ],
      weightBand: [70, 73],
      category: "73 kg",
    });
    expect(h.macroFromIdx).toBeGreaterThanOrEqual(0);
    expect(h.macroToIdx).toBeGreaterThanOrEqual(h.macroFromIdx);
    expect(h.weightBand).toEqual([70, 73]);
    expect(h.category).toBe("73 kg");
    expect(h.wellnessMean).toBe(75);
  });

  test("sin macro → índices en -1 y sin HRV", () => {
    const h = buildMeHeatDays({ today: TODAY, weeksBack: 4 });
    expect(h.macroFromIdx).toBe(-1);
    expect(h.macroToIdx).toBe(-1);
    expect(h.weeks.flatMap((w) => w.days).every((d) => d.hrv === null)).toBe(true);
  });
});
