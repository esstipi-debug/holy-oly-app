import { describe, it, expect } from "vitest";
import { competenciaForPico, weeksUntil } from "./competitions";
import { weekOfDate } from "./schedule";

describe("competenciaForPico", () => {
  const comp = { name: "Nacional Absoluto", date: "2026-09-15" };

  it("ancla la fila Competencia a la semana derivada del startDate", () => {
    const start = "2026-06-15";
    const c = competenciaForPico(comp, start, 16);
    expect(c).not.toBeNull();
    expect(c!.name).toBe("Nacional Absoluto");
    expect(c!.date).toBe("2026-09-15");
    expect(c!.week).toBe(weekOfDate(start, "2026-09-15", 16));
  });

  it("devuelve null sin startDate (atleta sin plan anclado)", () => {
    expect(competenciaForPico(comp, undefined, 16)).toBeNull();
  });

  it("devuelve null cuando el macro no tiene semanas", () => {
    expect(competenciaForPico(comp, "2026-06-15", 0)).toBeNull();
  });

  it("clampea la semana al total del macro si la fecha cae más allá", () => {
    const c = competenciaForPico({ name: "X", date: "2027-01-01" }, "2026-01-05", 12);
    expect(c!.week).toBe(12);
  });
});

describe("weeksUntil", () => {
  it("cuenta hacia arriba las semanas que faltan", () => {
    expect(weeksUntil("2026-06-14", "2026-09-15")).toBe(14);
  });
  it("es negativo para compes pasadas", () => {
    expect(weeksUntil("2026-06-14", "2025-11-01")).toBeLessThan(0);
  });
  it("0 el mismo día, 1 dentro de la próxima semana", () => {
    expect(weeksUntil("2026-06-14", "2026-06-14")).toBe(0);
    expect(weeksUntil("2026-06-14", "2026-06-18")).toBe(1);
  });
});
