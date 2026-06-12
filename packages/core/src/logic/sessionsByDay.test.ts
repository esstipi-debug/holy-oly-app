import { describe, expect, it } from "vitest";
import { sessionsByDay } from "./sessionsByDay";

// Helper: builds only the keys that are defined (avoids undefined-vs-absent key mismatch in toEqual)
const s = (sessionIdx: number, day?: number, turno?: "AM" | "PM") => {
  const obj: { sessionIdx: number; day?: number; turno?: "AM" | "PM" } = { sessionIdx };
  if (day !== undefined) obj.day = day;
  if (turno !== undefined) obj.turno = turno;
  return obj;
};

describe("sessionsByDay (D8: agrupación única por día real)", () => {
  it("sin day → legacy: sesión n = día n, un grupo por sesión", () => {
    expect(sessionsByDay([s(0), s(1), s(2)])).toEqual([
      { day: 1, sesiones: [{ session: s(0) }] },
      { day: 2, sesiones: [{ session: s(1) }] },
      { day: 3, sesiones: [{ session: s(2) }] },
    ]);
  });
  it("día doble: AM y PM caen en el mismo grupo, orden estable, días ordenados", () => {
    const grouped = sessionsByDay([s(0, 1, "AM"), s(1, 1, "PM"), s(2, 2)]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toEqual({
      day: 1,
      sesiones: [{ session: s(0, 1, "AM"), turno: "AM" }, { session: s(1, 1, "PM"), turno: "PM" }],
    });
    expect(grouped[1]!.day).toBe(2);
  });
});
