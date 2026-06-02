import { weekSignals } from "./weekSignals";
import { MACROCYCLES } from "@holy-oly/core";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 3,
  acute: [300, 1000, 340],
  hrv: [70, 62, 69], hrvBase: 70,
  rhr: [50, 56, 50], rhrBase: 50,
  imr: [70, 93, 88],
  wellness: [80, 58, 70],
  recovery: [82, 40, 71],
  compliance: [90, 60, 100], rpe: [7, 9, 7],
  bodyweight: [80.5, 81.4, 80.2], weightBand: [80, 81],
};

test("weekSignals: arma el cross-section de la semana con estado vs banda", () => {
  const rows = weekSignals(s, MACROCYCLES[0], 2);
  const acwr = rows.find((r) => r.label === "ACWR")!;
  expect(acwr.hasData).toBe(true);
  expect(acwr.state).toBe("alert"); // semana 2 = pico
  const peso = rows.find((r) => r.label === "Peso")!;
  expect(peso.state).toBe("alert"); // 81.4 fuera de [80,81]
});

test("weekSignals: dato faltante → hasData:false, sin estado (nunca falso-verde)", () => {
  const empty: MonitorSeries = { ...s, bodyweight: undefined, weightBand: undefined };
  const peso = weekSignals(empty, MACROCYCLES[0], 2).find((r) => r.label === "Peso")!;
  expect(peso.hasData).toBe(false);
  expect(peso.state).toBeUndefined();
  expect(peso.value).toBe("—");
});
