import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, beforeEach } from "vitest";
import type { MonitorSeries } from "@holy-oly/core";
import { AthleteShell } from "../AthleteShell";
import { HomeScreen } from "../HomeScreen";
import type { MeClient } from "../../../data/meClient";

vi.mock("../../../data/meClient", () => {
  const getMePlan = vi.fn();
  const getMeSeries = vi.fn();
  const getDayLog = vi.fn();
  const putDayLog = vi.fn();
  const getMeSessions = vi.fn().mockResolvedValue([]);
  const putMeSession = vi.fn();
  const getMeCycle = vi.fn().mockResolvedValue({ share: "none", state: "regular" });
  const putMeCycle = vi.fn();
  const meClient = { getMePlan, getMeSeries, getDayLog, putDayLog, getMeSessions, putMeSession, getMeCycle, putMeCycle };
  return { ...meClient, meClient };
});
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

test("atleta nuevo: saludo sin plan, Titular sin datos, CTA primario", async () => {
  vi.mocked(me.getMePlan).mockResolvedValue({ athlete: { nombre: "Demo Atleta", iniciales: "DA", sexo: "M" }, plan: null });
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: null, streak: 0, days: [], today: "2026-06-03" });

  renderHome();
  expect(await screen.findByText("Hola, Demo")).toBeInTheDocument();
  expect(screen.getByText(/tu coach todavía no te asignó un plan/)).toBeInTheDocument();
  expect(screen.getByText("Sin datos aún")).toBeInTheDocument();
  expect(screen.getByText(/Todavía no tenés un plan asignado/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Hacer check-in de hoy" })).toBeInTheDocument();
});

test("atleta con plan + serie + check-in hecho: saludo con semana, estado, CTA listo", async () => {
  vi.mocked(me.getMePlan).mockResolvedValue({
    athlete: { nombre: "Mara V.", iniciales: "MV", sexo: "F" },
    plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 5, currentPhase: "Fuerza", phases: [{ name: "Fuerza", from: 1, to: 12, imr: 88, imrLo: 80, imrHi: 88, volRel: 70, focus: "fuerza" }], comps: [{ name: "Nacional", week: 12 }] },
  });
  vi.mocked(me.getMeSeries).mockResolvedValue(FLAT_SERIES);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: { date: "2026-06-03", fatiga: 2, dolor: 1, estres: 2, humor: 4, motivacion: 5, sueno: 4 }, streak: 5, days: ["2026-06-03"], today: "2026-06-03" });

  renderHome();
  expect(await screen.findByText("Hola, Mara")).toBeInTheDocument();
  expect(screen.getByText(/Ruso 5D · semana 5 de 12 · Fuerza/)).toBeInTheDocument();
  expect(screen.getByText("Vas bien")).toBeInTheDocument(); // FLAT_SERIES (recovery 85, acwr 1.0) → estado "ok"
  expect(screen.queryByText("Sin datos aún")).not.toBeInTheDocument();
  expect(screen.getByText("Check-in de hoy, listo")).toBeInTheDocument();
});

test("error de carga → mensaje honesto", async () => {
  vi.mocked(me.getMePlan).mockRejectedValue(new Error("boom"));
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: null, streak: 0, days: [], today: "2026-06-03" });
  renderHome();
  await waitFor(() => expect(screen.getByText(/No se pudo cargar/)).toBeInTheDocument());
});

// ── T1b: HomeScreen reusable in the coach toggle ────────────────────────────
// The toggle renders the athlete Home OUTSIDE the AthleteShell/Outlet, scoped to a specific
// athlete via an injected client. So HomeScreen must (a) read from an injected MeClient, not the
// module singleton, (b) render without an Outlet context, (c) drop the navigation-only SemanaCard
// in preview (where navigating into the entreno route doesn't apply).

test("usa el cliente inyectado, no el módulo global (rinde sin AthleteShell)", async () => {
  const fake: MeClient = {
    getMePlan: vi.fn().mockResolvedValue({ athlete: { nombre: "Caro F.", iniciales: "CF", sexo: "F" }, plan: null }),
    getMeSeries: vi.fn().mockResolvedValue(undefined),
    getDayLog: vi.fn().mockResolvedValue({ entry: null, streak: 0, days: [], today: "2026-06-07" }),
    putDayLog: vi.fn(),
    getMeSessions: vi.fn().mockResolvedValue([]),
    getMeHeat: vi.fn().mockResolvedValue([]),
    getMeRecorrido: vi.fn().mockResolvedValue({ semanas: [] }),
    putMeSession: vi.fn(),
    getMeCycle: vi.fn().mockResolvedValue({ share: "none", state: "regular" }),
    putMeCycle: vi.fn(),
  };
  // No <AthleteShell>/<Outlet> wrapper — proves HomeScreen tolerates a missing Outlet context.
  render(<MemoryRouter><HomeScreen client={fake} preview /></MemoryRouter>);
  expect(await screen.findByText("Hola, Caro")).toBeInTheDocument();
  expect(fake.getMePlan).toHaveBeenCalled();
  expect(me.getMePlan).not.toHaveBeenCalled(); // el módulo global no se tocó
});

test("preview oculta la SemanaCard; sin preview la muestra", async () => {
  vi.mocked(me.getMePlan).mockResolvedValue({
    athlete: { nombre: "Kevin A.", iniciales: "KV", sexo: "M" },
    plan: { macroName: "Ruso 5D", totalWeeks: 16, currentWeek: 3, currentPhase: "Base", phases: [{ name: "Base", from: 1, to: 16, imr: 80, imrLo: 70, imrHi: 80, volRel: 90, focus: "base" }], comps: [] },
  });
  vi.mocked(me.getMeSeries).mockResolvedValue(undefined);
  vi.mocked(me.getDayLog).mockResolvedValue({ entry: null, streak: 0, days: [], today: "2026-06-07" });
  vi.mocked(me.getMeSessions).mockResolvedValue([
    { week: 3, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64 }] },
  ] as never);

  const { unmount } = render(<MemoryRouter><HomeScreen /></MemoryRouter>);
  expect(await screen.findByText("Tu semana")).toBeInTheDocument();
  unmount();

  render(<MemoryRouter><HomeScreen preview /></MemoryRouter>);
  expect(await screen.findByText("Hola, Kevin")).toBeInTheDocument();
  expect(screen.queryByText("Tu semana")).not.toBeInTheDocument();
});
