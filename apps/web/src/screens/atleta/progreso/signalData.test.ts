import { describe, it, expect } from "vitest";
import type { MonitorSeries } from "@holy-oly/core";
import { cargaDisplay, recuperacionDisplay, bienestarDisplay, pesoDisplay, type SignalDisplay } from "./signalData";

/** Factory: MonitorSeries con todos los arrays paralelos a `weeks`, sobreescribible. */
function series(over: Partial<MonitorSeries> & { weeks: number }): MonitorSeries {
  const n = over.weeks;
  const fill = (v: number) => Array.from({ length: n }, () => v);
  return {
    acute: fill(1000),
    hrv: fill(70),
    hrvBase: 70,
    rhr: fill(50),
    rhrBase: 50,
    imr: fill(100),
    wellness: fill(75),
    recovery: fill(80),
    ...over, // `over` trae weeks (requerido) + cualquier override
  };
}

/** Ningún campo de display puede contener NaN/Infinity/-Infinity/undefined renderizado. */
function assertNoGarbage(d: SignalDisplay | null) {
  const json = JSON.stringify(d);
  expect(json).not.toMatch(/NaN|Infinity|undefinedAU|undefined ms|undefined kg/);
}

describe("signalData — guards (sin NaN/Infinity en ningún estado real o degenerado)", () => {
  it("carga: serie completa → hero + delta + tendencia 4 sem", () => {
    const d = cargaDisplay(series({ weeks: 6, acute: [800, 900, 1000, 1100, 1200, 1300] }));
    expect(d.big).toBe("1300");
    expect(d.unit).toBe("AU");
    expect(d.delta).not.toBeNull();
    expect(d.stats.find((s) => s.label === "Tendencia (4 sem)")).toBeTruthy();
    assertNoGarbage(d);
  });

  it("carga: 1 sola semana → SIN delta (no compara contra sí misma) + read de primera lectura", () => {
    const d = cargaDisplay(series({ weeks: 1, acute: [1000] }));
    expect(d.big).toBe("1000");
    expect(d.delta).toBeNull();
    expect(d.read).toMatch(/primera/i);
    assertNoGarbage(d);
  });

  it("carga: 2–3 semanas → la etiqueta dice 'Tu tendencia', NO miente '4 sem'", () => {
    const d = cargaDisplay(series({ weeks: 3, acute: [900, 1000, 1100] }));
    expect(d.stats.find((s) => s.label === "Tu tendencia")).toBeTruthy();
    expect(d.stats.find((s) => s.label === "Tendencia (4 sem)")).toBeFalsy();
    assertNoGarbage(d);
  });

  it("carga: serie vacía (weeks:0, acute:[]) → '—' sin -Infinity ni crash", () => {
    const d = cargaDisplay(series({ weeks: 0, acute: [], hrv: [], rhr: [], imr: [], wellness: [], recovery: [] }));
    expect(d.big).toBe("—");
    expect(d.delta).toBeNull();
    expect(d.stats.every((s) => s.value === "—")).toBe(true);
    assertNoGarbage(d);
  });

  it("recuperación: hrvBase=0 → delta NULL (jamás 'Infinity%')", () => {
    const d = recuperacionDisplay(series({ weeks: 4, hrv: [70, 70, 70, 72], hrvBase: 0 }));
    expect(d.delta).toBeNull();
    assertNoGarbage(d);
  });

  it("recuperación: serie completa → HRV hero + delta + estado", () => {
    const d = recuperacionDisplay(series({ weeks: 4, hrv: [68, 70, 72, 74], rhr: [52, 51, 50, 49] }));
    expect(d.big).toBe("74");
    expect(d.unit).toBe("ms");
    expect(d.delta).not.toBeNull();
    expect(["ok", "warn"]).toContain(d.delta!.state);
    assertNoGarbage(d);
  });

  it("bienestar: 1 semana → diff null; serie completa → diff presente", () => {
    const one = bienestarDisplay(series({ weeks: 1, wellness: [80] }));
    expect(one.delta).toBeNull();
    assertNoGarbage(one);
    const many = bienestarDisplay(series({ weeks: 5, wellness: [70, 72, 74, 76, 82] }));
    expect(many.delta).not.toBeNull();
    expect(many.big).toBe("82");
    assertNoGarbage(many);
  });

  it("peso: sin bodyweight → null (slide ausente, como hoy)", () => {
    expect(pesoDisplay(series({ weeks: 5 }))).toBeNull();
  });

  it("peso: bodyweight dentro de banda → 'En banda' ok", () => {
    const d = pesoDisplay(series({ weeks: 3, bodyweight: [82.0, 81.5, 81.0], weightBand: [80, 82] }))!;
    expect(d.big).toBe("81.0");
    expect(d.delta!.text).toBe("En banda");
    expect(d.delta!.state).toBe("ok");
    assertNoGarbage(d);
  });

  it("peso: bodyweight fuera de banda → 'Fuera' alert", () => {
    const d = pesoDisplay(series({ weeks: 2, bodyweight: [84, 83.5], weightBand: [80, 82] }))!;
    expect(d.delta!.text).toBe("Fuera");
    expect(d.delta!.state).toBe("alert");
    assertNoGarbage(d);
  });

  it("peso: bodyweight presente pero SIN banda → sin delta, margen '—'", () => {
    const d = pesoDisplay(series({ weeks: 2, bodyweight: [80, 81] }))!;
    expect(d.delta).toBeNull();
    expect(d.stats.find((s) => s.label === "Margen al límite")!.value).toBe("—");
    assertNoGarbage(d);
  });

  it("barrido: todo estado degenerado (1 semana, valores 0, banda invertida) sin basura", () => {
    const degen = series({ weeks: 1, acute: [0], hrv: [0], rhr: [0], wellness: [0], recovery: [0], bodyweight: [0], weightBand: [82, 80] });
    assertNoGarbage(cargaDisplay(degen));
    assertNoGarbage(recuperacionDisplay(degen));
    assertNoGarbage(bienestarDisplay(degen));
    assertNoGarbage(pesoDisplay(degen));
  });
});
