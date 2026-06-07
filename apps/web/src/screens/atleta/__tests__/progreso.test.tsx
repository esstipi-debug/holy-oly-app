import { render, screen, fireEvent } from "@testing-library/react";
import { vi, beforeEach } from "vitest";
import type { MonitorSeries } from "@holy-oly/core";

vi.mock("../../../data/meClient", () => {
  const getMeSeries = vi.fn();
  return { getMeSeries, meClient: { getMeSeries } };
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

beforeEach(() => vi.clearAllMocks());

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
