import { render, screen, fireEvent } from "@testing-library/react";
import { vi, beforeEach } from "vitest";
import type { MeRecorrido, MonitorSeries } from "@holy-oly/core";

vi.mock("../../../data/meClient", () => {
  const getMeSeries = vi.fn();
  const getMeRecorrido = vi.fn();
  return { getMeSeries, getMeRecorrido, meClient: { getMeSeries, getMeRecorrido } };
});
import * as me from "../../../data/meClient";
import { ProgresoScreen } from "../ProgresoScreen";

const SERIES: MonitorSeries = {
  weeks: 5,
  acute: [300, 320, 360, 700, 380],
  hrv: [72, 71, 70, 64, 69], hrvBase: 70,
  rhr: [50, 50, 51, 55, 50], rhrBase: 50,
  imr: [70, 72, 74, 86, 80],
  wellness: [82, 80, 78, 60, 70],
  recovery: [85, 84, 80, 62, 72],
  bodyweight: [81.1, 81.0, 80.8, 80.6, 80.7],
  weightBand: [80, 81],
};

const RECORRIDO: MeRecorrido = {
  semanas: [
    { week: 1, trabajoKg: 1000, calentamientoKg: 200, sesionesHechas: 3, sesionesTotales: 5 },
    { week: 2, trabajoKg: 800, calentamientoKg: 150, sesionesHechas: 2, sesionesTotales: 5 },
    { week: 3, trabajoKg: 0, calentamientoKg: 0, sesionesHechas: 0, sesionesTotales: 5 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: recorrido vacío → la card no aparece (los tests del recorrido la sobreescriben).
  vi.mocked(me.getMeRecorrido).mockResolvedValue({ semanas: [] });
});

test("con serie: muestra los 4 gráficos en voz de atleta (sin copy de coach)", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  render(<ProgresoScreen />);
  expect(await screen.findByText("Tu carga")).toBeInTheDocument();
  expect(screen.getByText("Tu recuperación")).toBeInTheDocument();
  expect(screen.getByText("Tu bienestar")).toBeInTheDocument();
  expect(screen.getByText("Tu peso")).toBeInTheDocument();
  // coach-voiced title must NOT appear
  expect(screen.queryByText("Carga aguda vs crónica")).not.toBeInTheDocument();
});

test("la «i» de carga no enseña ACWR (regla del atleta) y no hay RPE en pantalla", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  const { container } = render(<ProgresoScreen />);
  await screen.findByText("Tu carga");
  expect(container.textContent ?? "").not.toMatch(/\brpe\b/i);
  fireEvent.click(screen.getByRole("button", { name: "Cómo se lee: Tu carga" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog.textContent ?? "").not.toMatch(/acwr/i);
});

test("sin serie: estado vacío honesto, sin gráficos", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  render(<ProgresoScreen />);
  expect(await screen.findByText(/Cuando registres/i)).toBeInTheDocument();
  expect(screen.queryByText("Tu carga")).not.toBeInTheDocument();
});

test("error de red: muestra role=alert, sin gráficos", async () => {
  vi.mocked(me.getMeSeries).mockRejectedValue(new Error("network"));
  render(<ProgresoScreen />);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText("Tu carga")).not.toBeInTheDocument();
});

test("sin bodyweight: no muestra «Tu peso»", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue({ ...SERIES, bodyweight: undefined, weightBand: undefined });
  render(<ProgresoScreen />);
  await screen.findByText("Tu carga");
  expect(screen.queryByText("Tu peso")).not.toBeInTheDocument();
});

// ── Card «Tu recorrido» (recorrido D1, altura macro) ─────────────────────────
test("con recorrido: card con total acumulado, desglose y semanas con registro (es-CL)", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  vi.mocked(me.getMeRecorrido).mockResolvedValue(RECORRIDO);
  render(<ProgresoScreen />);
  expect(await screen.findByText("Tu recorrido")).toBeInTheDocument();
  expect(screen.getByText("2.150")).toBeInTheDocument(); // 1.000+200+800+150
  expect(screen.getByText(/trabajo 1\.800 kg · calentamiento ~350 kg/)).toBeInTheDocument();
  expect(screen.getByText(/2 semanas con registro/)).toBeInTheDocument();
});

test("recorrido vacío → la card no se renderiza (sin culpa)", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  render(<ProgresoScreen />); // default: { semanas: [] }
  await screen.findByText("Tu carga");
  expect(screen.queryByText("Tu recorrido")).not.toBeInTheDocument();
});

test("recorrido sin monitoreo: la card aparece igual junto al estado vacío", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  vi.mocked(me.getMeRecorrido).mockResolvedValue(RECORRIDO);
  render(<ProgresoScreen />);
  expect(await screen.findByText(/Cuando registres/i)).toBeInTheDocument();
  expect(await screen.findByText("Tu recorrido")).toBeInTheDocument();
});

test("error del recorrido → alert con Reintentar; el retry recupera la card", async () => {
  vi.mocked(me.getMeSeries).mockResolvedValue(SERIES);
  vi.mocked(me.getMeRecorrido)
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(RECORRIDO);
  render(<ProgresoScreen />);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText("2.150")).toBeInTheDocument();
});
