import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach } from "vitest";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import type { Atleta, Plan, MonitorSeries, Competencia, SessionLog, WeekHeat, SessionView } from "@holy-oly/core";
import { Drilldown } from "../Drilldown";

afterEach(() => localStorage.clear());

function renderAt(id: string, search = "") {
  const repo = new LocalRepository(new MemStorage());
  return render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={[`/coach/a/${id}${search}`]}>
        <Routes><Route path="/coach/a/:id" element={<Drilldown />} /></Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

test("por default abre Plan: Calendario visible, Monitor oculto (Mara)", async () => {
  renderAt("mv");
  await waitFor(() => expect(screen.getByText("Mara V.")).toBeInTheDocument());
  expect(await screen.findByText("Calendario")).toBeInTheDocument();          // Plan = default (Resumen eliminado)
  expect(screen.queryByText("ACWR")).not.toBeInTheDocument();                 // Monitor oculto
});

test("tab Monitor: 4 señales coach-only (ACWR · Carga · IMR · Peso); Bienestar/Cumplimiento/Recuperación fuera (Mara)", async () => {
  const { container } = renderAt("mv");
  await waitFor(() => expect(screen.getByText("Mara V.")).toBeInTheDocument());
  // los charts viven en Monitor, no en el Plan por default
  expect(screen.queryByText("ACWR")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Monitor" }));
  expect(await screen.findByText("ACWR")).toBeInTheDocument();
  expect(screen.getByText("Carga aguda vs crónica")).toBeInTheDocument();
  expect(screen.getByText("IMR vs fase")).toBeInTheDocument();
  expect(screen.getByText("Peso vs categoría")).toBeInTheDocument();
  // Quedaron fuera del Monitor: Recuperación (sin datos HRV/FC), Bienestar y Cumplimiento.
  expect(screen.queryByText(/Recuperación/)).toBeNull();
  expect(screen.queryByText("Bienestar")).toBeNull();
  expect(screen.queryByText("Cumplimiento")).toBeNull();
  // Medallas desactivadas por el owner (2026-06-12): el palmarés no se renderiza.
  expect(screen.queryByText(/Palmar/)).toBeNull();
  expect(screen.queryByText("Nacional Absoluto")).toBeNull();
  expect(container.querySelectorAll("svg").length).toBeGreaterThan(3);
});

test("tab Plan: Secciones (Calendario abierto · RM y Prilepin colapsados), no los charts", async () => {
  renderAt("mv");
  await waitFor(() => expect(screen.getByText("Mara V.")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Plan" }));
  // Calendario abierto: la Section se ve directo (sin el colapso viejo "📅 Calendario del plan")
  expect(await screen.findByText("Calendario")).toBeInTheDocument();
  expect(screen.queryByText("📅 Calendario del plan")).not.toBeInTheDocument();
  // RM y Prilepin arrancan colapsados: header presente con aria-expanded=false (el expand/lazy-mount
  // lo cubre Section.test). Su contenido no está montado todavía.
  expect(screen.getByRole("button", { name: /RM y referencias/ })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: /Prilepin/ })).toHaveAttribute("aria-expanded", "false");
  // no los charts del Monitor
  expect(screen.queryByText("ACWR")).not.toBeInTheDocument();
});

test("deep-link ?tab=monitor abre Monitor directo", async () => {
  renderAt("mv", "?tab=monitor");
  expect(await screen.findByText("ACWR")).toBeInTheDocument();
});

test("?tab= inválido (incluida la vieja 'resumen') cae a Plan (default, sin romper)", async () => {
  renderAt("mv", "?tab=resumen");
  await waitFor(() => expect(screen.getByText("Mara V.")).toBeInTheDocument());
  expect(await screen.findByText("Calendario")).toBeInTheDocument();          // default = Plan
  expect(screen.queryByText("ACWR")).not.toBeInTheDocument();
});

test("el botón 'volver' lleva de vuelta a Atletas (/coach)", async () => {
  const repo = new LocalRepository(new MemStorage());
  render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={["/coach/a/mv"]}>
        <Routes>
          <Route path="/coach" element={<div>ATLETAS-ROSTER</div>} />
          <Route path="/coach/a/:id" element={<Drilldown />} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
  const back = await screen.findByRole("button", { name: "Volver a Atletas" });
  fireEvent.click(back);
  await waitFor(() => expect(screen.getByText("ATLETAS-ROSTER")).toBeInTheDocument());
});

test("'ver como atleta' (demo) swaps the coach body for the athlete preview, and back", async () => {
  renderAt("mv");
  await waitFor(() => expect(screen.getByText("Mara V.")).toBeInTheDocument());
  // ir a Monitor para tener los charts del coach a la vista (?tab=monitor queda en la URL)
  fireEvent.click(screen.getByRole("button", { name: "Monitor" }));
  expect(await screen.findByText("ACWR")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Atleta" }));
  await waitFor(() => expect(screen.getByTestId("atleta-preview")).toBeInTheDocument());
  expect(screen.queryByText("ACWR")).not.toBeInTheDocument(); // coach charts swapped out
  fireEvent.click(screen.getByRole("button", { name: "Coach" }));
  await waitFor(() => expect(screen.getByText("ACWR")).toBeInTheDocument()); // vuelve a Monitor
});

test("'ver como atleta' muestra la Home COMPLETA del atleta (saludo) + la sesión con discos", async () => {
  // The preview's LocalMeClient reads the GLOBAL localStorage; seed it there (not MemStorage) so
  // the toggle finds the seeded athlete. Isolated by clearing before and after.
  localStorage.clear();
  const repo = new LocalRepository(); // global localStorage
  repo.init();
  render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={["/coach/a/kv"]}>
        <Routes><Route path="/coach/a/:id" element={<Drilldown />} /></Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
  await waitFor(() => expect(screen.getByText("Kevin A.")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Atleta" }));
  // Full athlete home (greeting) AND the money-shot prescription with discs both render.
  expect(await screen.findByText("Hola, Kevin")).toBeInTheDocument();
  expect(screen.getByTestId("atleta-preview")).toBeInTheDocument();
});

test("no-data athlete (Tomás): sin series → NO hay tab Monitor, se ve Plan directo", async () => {
  renderAt("tl");
  await waitFor(() => expect(screen.getByText("Tomás L.")).toBeInTheDocument());
  // Monitor depende de datos (MonitorSeries). Tomás no tiene → sin tab strip, sin Monitor ni su empty-state.
  expect(screen.queryByRole("button", { name: "Monitor" })).not.toBeInTheDocument();
  expect(screen.queryByText(/sin datos de monitoreo/i)).not.toBeInTheDocument();
});

test("shows an error state when the athlete fails to load", async () => {
  class FailingRepo extends LocalRepository {
    async getAthlete(): Promise<Atleta | undefined> { throw new Error("boom"); }
  }
  render(
    <RepositoryProvider repo={new FailingRepo(new MemStorage())}>
      <MemoryRouter initialEntries={["/coach/a/mv"]}>
        <Routes><Route path="/coach/a/:id" element={<Drilldown />} /></Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
  expect(await screen.findByText(/no se pudo cargar el atleta/i)).toBeInTheDocument();
});

test("atleta real con plan pero SIN Athlete.macroId: el drill-down muestra el macro (no 'sin macro')", async () => {
  // Regresión: savePlan escribe Plan.macroId pero NUNCA Athlete.macroId (esa columna sólo la llena el
  // seed). Un atleta real recién asignado tiene athlete.macroId vacío + un plan con macroId válido →
  // el macro debe derivarse del PLAN. Antes el drill-down leía athlete.macroId y mostraba "sin macro".
  const RMS = { arranque: 120, envion: 150, sentadilla: 180, frente: 160 };
  class AssignedNoAthleteMacroRepo extends LocalRepository {
    async getAthlete(): Promise<Atleta> {
      return { id: "np", nombre: "Nahuel P.", iniciales: "NP", nivel: "intermediate", compite: true, sexo: "M" }; // sin macroId
    }
    async getSeries(): Promise<MonitorSeries | undefined> { return undefined; } // atleta real: sin Monitor → Plan directo
    async getComps(): Promise<Competencia[]> { return []; }
    async getSessionLog(): Promise<SessionLog> { return []; }
    async getPlan(): Promise<Plan> {
      return { atletaId: "np", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-06", rms: RMS, comps: [] };
    }
    async getPlanHeat(): Promise<WeekHeat[]> { return []; }
    async getPrescriptionWeek(): Promise<SessionView[]> { return []; }
  }
  render(
    <RepositoryProvider repo={new AssignedNoAthleteMacroRepo(new MemStorage())}>
      <MemoryRouter initialEntries={["/coach/a/np"]}>
        <Routes><Route path="/coach/a/:id" element={<Drilldown />} /></Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
  await waitFor(() => expect(screen.getByText("Nahuel P.")).toBeInTheDocument());
  // El macro se reconoce desde plan.macroId → Calendario visible, sin el empty-state de onboarding.
  expect(await screen.findByText("Calendario")).toBeInTheDocument();
  expect(screen.queryByText("Todavía sin macro asignado")).not.toBeInTheDocument();
});
