import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, test, expect, vi } from "vitest";
import type { MePlanView, SessionView, ExerciseActual } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { VictoriaScreen } from "../entreno/VictoriaScreen";

const PLAN: MePlanView = {
  athlete: { nombre: "Mara V.", iniciales: "MV", sexo: "F" },
  plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 8, currentPhase: "Fuerza", phases: [], comps: [] },
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
      { movementId: "envion", movementName: "Envión", sets: 1, reps: 1, pct: 90, targetKg: 120,
        actual: actual({ movementId: "envion", movementName: "Envión", sets: [{ kg: 120, reps: 1, done: true }] }) },
    ],
  }];
}

beforeEach(() => {
  vi.spyOn(me, "getMePlan").mockResolvedValue(PLAN);
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

test("≥1 hecho → «Sesión completada», carga total y discos visibles", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  renderVictoria();
  expect(await screen.findByText("Sesión completada")).toBeInTheDocument();
  // carga total = 64*2 + 66*2 + 120*1 = 380
  expect(screen.getByText("380")).toBeInTheDocument();
  expect(screen.getByText("Tu serie más pesada hoy")).toBeInTheDocument();
  expect(screen.getByText("2/2")).toBeInTheDocument();
});

test("0 hechos → «Sesión registrada», sin carga total ni serie más pesada", async () => {
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
  expect(screen.queryByText("Carga total del día")).not.toBeInTheDocument();
  expect(screen.queryByText("Tu serie más pesada hoy")).not.toBeInTheDocument();
  expect(screen.getByText("0/1")).toBeInTheDocument();
});

test("series hechas sin kg → sin tarjeta de serie más pesada (honesto)", async () => {
  const noKg: SessionView[] = [{
    week: 8, sessionIdx: 0,
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 1, reps: 2, pct: 80, targetKg: 64,
        actual: actual({ movementId: "arranque", movementName: "Arranque", substituted: true, sets: [{ kg: undefined, reps: 2, done: true }] }) },
    ],
  }];
  vi.spyOn(me, "getMeSessions").mockResolvedValue(noKg);
  renderVictoria();
  expect(await screen.findByText("Sesión completada")).toBeInTheDocument();
  expect(screen.queryByText("Tu serie más pesada hoy")).not.toBeInTheDocument();
});

test("ejercicio hecho pero sin kg → sin tarjeta de carga total (no «0 kg»)", async () => {
  const doneNoKg: SessionView[] = [{
    week: 8, sessionIdx: 0,
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 1, reps: 2, pct: 80, targetKg: 64,
        actual: actual({ movementId: "arranque", movementName: "Arranque", done: true, sets: [{ kg: undefined, reps: 2, done: true }] }) },
    ],
  }];
  vi.spyOn(me, "getMeSessions").mockResolvedValue(doneNoKg);
  renderVictoria();
  expect(await screen.findByText("Sesión completada")).toBeInTheDocument();
  expect(screen.queryByText("Carga total del día")).not.toBeInTheDocument();
  expect(screen.queryByText("Tu serie más pesada hoy")).not.toBeInTheDocument();
});

test("«Registrar bienestar» navega al inicio", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  renderVictoria();
  fireEvent.click(await screen.findByRole("button", { name: /registrar bienestar/i }));
  await waitFor(() => expect(screen.getByText("HOY")).toBeInTheDocument());
});

test("«Listo» navega al inicio", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  renderVictoria();
  fireEvent.click(await screen.findByRole("button", { name: /^listo$/i }));
  await waitFor(() => expect(screen.getByText("HOY")).toBeInTheDocument());
});

test("API falla → estado de error con volver al inicio", async () => {
  vi.spyOn(me, "getMeSessions").mockRejectedValue(new Error("boom"));
  renderVictoria();
  expect(await screen.findByText(/no pudimos cargar/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /volver al inicio/i }));
  await waitFor(() => expect(screen.getByText("HOY")).toBeInTheDocument());
});
