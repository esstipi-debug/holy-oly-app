import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, beforeEach } from "vitest";
import type { MonitorSeries } from "@holy-oly/core";
import { AthleteShell } from "../AthleteShell";
import { HomeScreen } from "../HomeScreen";

vi.mock("../../../data/meClient", () => ({
  getMePlan: vi.fn(),
  getMeSeries: vi.fn(),
  getDayLog: vi.fn(),
  putDayLog: vi.fn(),
}));
import * as me from "../../../data/meClient";

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/atleta"]}>
      <Routes>
        <Route path="/atleta" element={<AthleteShell />}>
          <Route index element={<HomeScreen />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const FLAT_SERIES: MonitorSeries = {
  weeks: 5, acute: [300, 300, 300, 300, 300], hrv: [70, 70, 70, 70, 70], hrvBase: 70,
  rhr: [50, 50, 50, 50, 50], rhrBase: 50, imr: [70, 70, 70, 70, 70],
  wellness: [80, 80, 80, 80, 80], recovery: [85, 85, 85, 85, 85],
};

beforeEach(() => vi.clearAllMocks());

test("atleta nuevo: saludo sin plan, Titular sin datos, racha empieza hoy, CTA primario", async () => {
  vi.mocked(me.getMePlan).mockResolvedValue({ athlete: { nombre: "Demo Atleta", iniciales: "DA" }, plan: null });
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: null, streak: 0, days: [], today: "2026-06-03" });

  renderHome();
  expect(await screen.findByText("Hola, Demo")).toBeInTheDocument();
  expect(screen.getByText(/tu coach todavía no te asignó un plan/)).toBeInTheDocument();
  expect(screen.getByText("Sin datos aún")).toBeInTheDocument();
  expect(screen.getByText("Tu racha empieza hoy")).toBeInTheDocument();
  expect(screen.getByText(/Todavía no tenés un plan asignado/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Hacer check-in de hoy" })).toBeInTheDocument();
});

test("atleta con plan + serie + check-in hecho: saludo con semana, estado, racha, CTA listo", async () => {
  vi.mocked(me.getMePlan).mockResolvedValue({
    athlete: { nombre: "Mara V.", iniciales: "MV" },
    plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 5, currentPhase: "Fuerza", phases: [{ name: "Fuerza", from: 1, to: 12, imr: 88 }], comps: [{ name: "Nacional", week: 12 }] },
  });
  vi.mocked(me.getMeSeries).mockResolvedValue(FLAT_SERIES);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: { date: "2026-06-03", fatiga: 2, dolor: 1, estres: 2, humor: 4, motivacion: 5, sueno: 4 }, streak: 5, days: ["2026-06-03"], today: "2026-06-03" });

  renderHome();
  expect(await screen.findByText("Hola, Mara")).toBeInTheDocument();
  expect(screen.getByText(/Ruso 5D · semana 5 de 12 · Fuerza/)).toBeInTheDocument();
  expect(screen.getByText("Vas bien")).toBeInTheDocument(); // FLAT_SERIES (recovery 85, acwr 1.0) → estado "ok"
  expect(screen.queryByText("Sin datos aún")).not.toBeInTheDocument();
  expect(screen.getByText("Check-in de hoy, listo")).toBeInTheDocument();
  expect(screen.getByText("5")).toBeInTheDocument(); // streak
});

test("error de carga → mensaje honesto", async () => {
  vi.mocked(me.getMePlan).mockRejectedValue(new Error("boom"));
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: null, streak: 0, days: [], today: "2026-06-03" });
  renderHome();
  await waitFor(() => expect(screen.getByText(/No se pudo cargar/)).toBeInTheDocument());
});
