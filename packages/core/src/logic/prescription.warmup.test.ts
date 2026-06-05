import { describe, it, expect } from "vitest";
import type { PrescriptionRow, RM } from "../types";
import { buildSessionViews } from "./prescription";

const RMS: RM = { arranque: 92, envion: 116, sentadilla: 150, frente: 130 };

describe("buildSessionViews · warmup", () => {
  it("adjunta el warmup del 1er movimiento (con barra) usando barKg", () => {
    const rows: PrescriptionRow[] = [
      { week: 1, sessionIdx: 0, order: 0, movementId: "arranque", sets: 5, reps: 2, pct: 62 },
    ];
    const v = buildSessionViews(rows, RMS, 15)[0]!.exercises[0]!;
    expect(v.warmup![0]).toEqual({ pct: 0, kg: 15, reps: 5, label: "barra" });
  });
  it("ejercicio sin pct → warmup []", () => {
    const rows: PrescriptionRow[] = [
      { week: 1, sessionIdx: 0, order: 0, movementId: "sentadilla", sets: 5, reps: 5, kgOverride: 100 },
    ];
    const v = buildSessionViews(rows, RMS, 20)[0]!.exercises[0]!;
    expect(v.warmup).toEqual([]);
  });
  it("barKg default 20 cuando no se pasa", () => {
    const rows: PrescriptionRow[] = [
      { week: 1, sessionIdx: 0, order: 0, movementId: "arranque", sets: 5, reps: 2, pct: 62 },
    ];
    const v = buildSessionViews(rows, RMS)[0]!.exercises[0]!;
    expect(v.warmup![0]!.kg).toBe(20);
  });
});
