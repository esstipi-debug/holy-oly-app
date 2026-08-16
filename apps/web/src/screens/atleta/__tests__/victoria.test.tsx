import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, test, expect, vi } from "vitest";
import type { MePlanView, SessionView, ExerciseActual, MeRecorrido } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { VictoriaScreen } from "../entreno/VictoriaScreen";

const PLAN: MePlanView = {
  athlete: { nombre: "Mara V.", iniciales: "MV", sexo: "F" },
  plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 8, currentPhase: "Fuerza", currentPhaseKey: "fuerza", phases: [], comps: [] },
};

const actual = (over: Partial<ExerciseActual> & Pick<ExerciseActual, "movementId" | "movementName">): ExerciseActual => ({
  done: true, substituted: false, desfasado: false, ...over,
});

function sessions(): SessionView[] {
  return [{
    week: 8, sessionIdx: 0,
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 2, reps: 2, pct: 80, targetKg: 64,
        actual: actual({ movementId: "arranque", movementName: "Arranque", sets: [{ kg: 64, reps: 2, done: true }, { kg: 66, reps: 2, done: true }] }) },
      { movementId: "cargada-envion", movementName: "Envión", sets: 1, reps: 1, pct: 90, targetKg: 120,
        actual: actual({ movementId: "cargada-envion", movementName: "Envión", sets: [{ kg: 120, reps: 1, done: true }] }) },
    ],
  }];
}

const RECORRIDO: MeRecorrido = { semanas: [] };

beforeEach(() => {
  vi.spyOn(me, "getMePlan").mockResolvedValue(PLAN);
  vi.spyOn(me, "getMeRecorrido").mockResolvedValue(RECORRIDO);
});
afterEach(() => vi.restoreAllMocks());

function renderVictoria() {
  return render(
    <MemoryRouter initialEntries={["/atleta/entreno/8/0/victoria"]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx/victoria" element={<VictoriaScreen />} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("≥1 hecho → celebración «¡Entreno guardado!» con los lifts + nivel; SIN «serie más pesada»; SIN RPE", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  const { container } = renderVictoria();
  expect(await screen.findByText("¡Entreno guardado!")).toBeInTheDocument();
  // los movimientos aparecen (hex + resumen)
  expect(screen.getAllByText(/Arranque/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Env/).length).toBeGreaterThan(0);
  // gamificación: nivel visible (recorrido vacío → Nivel 1)
  expect(screen.getAllByText(/Nivel/).length).toBeGreaterThan(0);
  // intocables: nunca «serie más pesada» (no lleva a cuidarse) ni RPE en superficie del atleta
  expect(screen.queryByText(/serie más pesada/i)).not.toBeInTheDocument();
  expect((container.textContent ?? "")).not.toMatch(/\brpe\b/i);
});

test("0 hechos → «Sesión registrada» sobria (sin celebración)", async () => {
  const all0: SessionView[] = [{
    week: 8, sessionIdx: 0,
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 1, reps: 2, pct: 80, targetKg: 64,
        actual: actual({ movementId: "arranque", movementName: "Arranque", done: false, sets: [{ kg: 64, reps: 2, done: false }] }) },
    ],
  }];
  vi.spyOn(me, "getMeSessions").mockResolvedValue(all0);
  renderVictoria();
  expect(await screen.findByText("Sesión registrada")).toBeInTheDocument();
  expect(screen.queryByText("¡Entreno guardado!")).not.toBeInTheDocument();
});

test("semana cerrada → abre en la celebración de Semana, con rotador para volver al Día", async () => {
  // recorrido marca la semana 8 con el plan cumplido → tier semana disponible
  vi.spyOn(me, "getMeRecorrido").mockResolvedValue({
    semanas: [{ week: 8, sesionesHechas: 5, sesionesTotales: 5, trabajoKg: 12000, calentamientoKg: 1000 }],
  });
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  renderVictoria();
  // abre en el mayor alcance logrado (Semana)
  expect(await screen.findByText("¡Semana cerrada!")).toBeInTheDocument();
  // el rotador permite volver al Día
  fireEvent.click(screen.getByRole("tab", { name: /Día/ }));
  expect(screen.getByText("¡Entreno guardado!")).toBeInTheDocument();
});

test("«Reclamar» navega al inicio", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  renderVictoria();
  fireEvent.click(await screen.findByRole("button", { name: /reclamar/i }));
  await waitFor(() => expect(screen.getByText("HOY")).toBeInTheDocument());
});

test("«Registrar bienestar» navega al inicio", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  renderVictoria();
  fireEvent.click(await screen.findByRole("button", { name: /registrar bienestar/i }));
  await waitFor(() => expect(screen.getByText("HOY")).toBeInTheDocument());
});

test("meta muestra day/turno del view (Día 1 · PM)", async () => {
  const views: SessionView[] = [{
    week: 8, sessionIdx: 0, day: 1, turno: "PM", fecha: "2026-06-12",
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 2, reps: 2, pct: 80, targetKg: 64,
        actual: actual({ movementId: "arranque", movementName: "Arranque", sets: [{ kg: 64, reps: 2, done: true }] }) },
    ],
  }];
  vi.spyOn(me, "getMeSessions").mockResolvedValue(views);
  renderVictoria();
  expect(await screen.findByText(/Día 1 · PM/)).toBeInTheDocument();
});

test("API falla → estado de error con volver al inicio", async () => {
  vi.spyOn(me, "getMeSessions").mockRejectedValue(new Error("boom"));
  renderVictoria();
  expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /volver al inicio/i }));
  await waitFor(() => expect(screen.getByText("HOY")).toBeInTheDocument());
});
