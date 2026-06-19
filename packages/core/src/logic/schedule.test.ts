import { describe, it, expect } from "vitest";
import { weekOfDate, dateOfWeek, defaultStartDate, sessionsPerWeek, computeStreak, calendarWeeks, mondayOf, anchorPlanToComp, availableWeeksToComp } from "./schedule";

describe("availableWeeksToComp", () => {
  const start = "2026-01-05"; // un lunes
  it("misma semana → 1", () => {
    expect(availableWeeksToComp(start, "2026-01-05")).toBe(1);
    expect(availableWeeksToComp(start, "2026-01-11")).toBe(1); // +6 días, misma semana
  });
  it("cuenta semanas calendario inclusive", () => {
    expect(availableWeeksToComp(start, "2026-01-12")).toBe(2); // +1 semana
    expect(availableWeeksToComp(start, "2026-02-16")).toBe(7); // +6 semanas (42 días)
  });
  it("normaliza la fecha de compe a su lunes", () => {
    expect(availableWeeksToComp(start, "2026-02-18")).toBe(7); // miércoles de la 7ª semana
  });
});

describe("weekOfDate", () => {
  const start = "2026-01-05"; // a Monday

  it("maps the start date and the rest of week 1 to week 1", () => {
    expect(weekOfDate(start, "2026-01-05", 16)).toBe(1);
    expect(weekOfDate(start, "2026-01-11", 16)).toBe(1); // +6 days, still week 1
  });

  it("rolls to the next week after 7 days", () => {
    expect(weekOfDate(start, "2026-01-12", 16)).toBe(2); // +7 days
    expect(weekOfDate(start, "2026-01-19", 16)).toBe(3); // +14 days
  });

  it("clamps to [1, totalWeeks]", () => {
    expect(weekOfDate(start, "2025-12-01", 16)).toBe(1); // before start
    expect(weekOfDate(start, "2027-01-05", 16)).toBe(16); // far past the macro
  });
});

describe("dateOfWeek", () => {
  it("returns the ISO date of a week's start", () => {
    expect(dateOfWeek("2026-01-05", 1)).toBe("2026-01-05");
    expect(dateOfWeek("2026-01-05", 3)).toBe("2026-01-19");
  });
});

describe("defaultStartDate", () => {
  it("anchors today to the current week (today − (currentWeek−1) weeks)", () => {
    expect(defaultStartDate("2026-04-06", 12)).toBe("2026-01-19");
  });

  it("round-trips: today maps back to the current week", () => {
    const sd = defaultStartDate("2026-04-06", 12);
    expect(weekOfDate(sd, "2026-04-06", 16)).toBe(12);
  });
});

describe("sessionsPerWeek", () => {
  it("reads the first integer of a frequency string", () => {
    expect(sessionsPerWeek("5d/sem")).toBe(5);
    expect(sessionsPerWeek("3d/sem")).toBe(3);
    expect(sessionsPerWeek("4-5d/sem")).toBe(4); // first integer
  });

  it("returns 0 when no count is present", () => {
    expect(sessionsPerWeek("var")).toBe(0);
    expect(sessionsPerWeek("")).toBe(0);
  });
});

describe("computeStreak", () => {
  it("counts the consecutive run ending today", () => {
    expect(computeStreak(["2026-06-01", "2026-06-02", "2026-06-03"], "2026-06-03")).toBe(3);
  });
  it("stays alive when the last log was yesterday (today not yet logged)", () => {
    expect(computeStreak(["2026-06-01", "2026-06-02"], "2026-06-03")).toBe(2);
  });
  it("is broken (0) when the last log is older than yesterday", () => {
    expect(computeStreak(["2026-05-30", "2026-05-31"], "2026-06-03")).toBe(0);
  });
  it("stops at the first gap", () => {
    expect(computeStreak(["2026-05-31", "2026-06-02", "2026-06-03"], "2026-06-03")).toBe(2);
  });
  it("ignores duplicates and unsorted input", () => {
    expect(computeStreak(["2026-06-03", "2026-06-02", "2026-06-03"], "2026-06-03")).toBe(2);
  });
  it("empty history → 0", () => expect(computeStreak([], "2026-06-03")).toBe(0));
});

describe("mondayOf", () => {
  it("devuelve el lunes de la semana calendario", () => {
    expect(mondayOf("2026-09-19")).toBe("2026-09-14"); // sábado → su lunes
    expect(mondayOf("2026-09-14")).toBe("2026-09-14"); // ya es lunes
    expect(mondayOf("2026-09-20")).toBe("2026-09-14"); // domingo → su lunes
  });
});

describe("anchorPlanToComp", () => {
  // Oráculo: compe sáb 2026-09-19, ancla en la semana 16 de 16 → start = lun 14 sep − 15 sem = 1 jun.
  it("coloca la compe exactamente en la semana ancla (contando hacia atrás)", () => {
    const a = anchorPlanToComp("2026-09-19", 16, 16, "2026-06-10");
    expect(a.startDate).toBe("2026-06-01");
    expect(weekOfDate(a.startDate, "2026-09-19", 16)).toBe(16); // la compe cae en su semana
  });

  it("hoy dentro del rango → recortado: entrás en la semana X (acumulación salteada)", () => {
    const a = anchorPlanToComp("2026-09-19", 16, 16, "2026-06-10");
    expect(a.status).toBe("recortado");
    expect(a.entryWeek).toBe(2); // 10 jun cae en la semana 2 de un plan que arrancó el 1 jun
  });

  it("hoy == inicio calculado → completo", () => {
    const a = anchorPlanToComp("2026-09-19", 16, 16, "2026-06-01");
    expect(a.status).toBe("completo");
    expect(a.entryWeek).toBe(1);
  });

  it("ancla en el pico (no la última semana): compe en peakWeek y quedan semanas después", () => {
    const a = anchorPlanToComp("2026-09-19", 14, 16, "2026-06-10");
    expect(a.startDate).toBe("2026-06-15"); // lun 14 sep − 13 semanas
    expect(weekOfDate(a.startDate, "2026-09-19", 16)).toBe(14);
    expect(a.status).toBe("futuro"); // el 10 jun todavía no empezó
    expect(a.daysToStart).toBe(5);
  });

  it("compe en el pasado → pasada (la UI bloquea)", () => {
    expect(anchorPlanToComp("2026-06-01", 16, 16, "2026-06-10").status).toBe("pasada");
  });

  it("clampa anchorWeek a [1, totalWeeks]", () => {
    const a = anchorPlanToComp("2026-09-19", 99, 16, "2026-06-10");
    expect(weekOfDate(a.startDate, "2026-09-19", 16)).toBe(16);
  });
});

describe("calendarWeeks", () => {
  it("returns `weeks` Monday-first rows of 7 ISO dates", () => {
    const grid = calendarWeeks("2026-06-03", 8); // 2026-06-03 is a Wednesday
    expect(grid).toHaveLength(8);
    grid.forEach((row) => expect(row).toHaveLength(7));
    // the last row contains today, Monday-first
    const last = grid[grid.length - 1]!;
    expect(last).toContain("2026-06-03");
    expect(last[0]).toBe("2026-06-01"); // Monday of that week
    expect(last[6]).toBe("2026-06-07"); // Sunday
  });
});
