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

test("≥1 hecho → «Sesión completada» y carga total; SIN «serie más pesada» (no lleva a cuidarse)", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(sessions());
  renderVictoria();
  expect(await screen.findByText("Sesión completada")).toBeInTheDocument();
  // carga total = 64*2 + 66*2 + 120*1 = 380
  expect(screen.getByText("380")).toBeInTheDocument();
  // El hito «serie más pesada» se quitó: celebra el PR/ego, no la recuperación (directiva owner).
  expect(screen.queryByText("Tu serie más pesada hoy")).not.toBeInTheDocument();
  expect(screen.getByText("2/2")).toBeInTheDocument();
  // única sesión de la semana → semana == día → la línea micro se omite (no repite el número)
  expect(screen.queryByText(/llevás/)).not.toBeInTheDocument();
});

test("otra sesión hecha en la semana → línea micro «Con esta, llevás X kg en la semana.»", async () => {
  const views: SessionView[] = [
    ...sessions(), // día 0: 380 kg
    {
      week: 8, sessionIdx: 1,
      exercises: [
        { movementId: "sentadilla", movementName: "Sentadilla", sets: 5, reps: 5, pct: 75, targetKg: 124,
          actual: actual({ movementId: "sentadilla", movementName: "Sentadilla", sets: [{ kg: 100, reps: 1, done: true }] }) },
      ],
    },
  ];
  vi.spyOn(me, "getMeSessions").mockResolvedValue(views);
  renderVictoria();
  expect(await screen.findByText("Sesión completada")).toBeInTheDocument();
  // semana = 380 (día 0) + 100 (día 1) = 480 > 380 del día → la línea aparece, SIN «~» (cero calentamiento)
  expect(screen.getByText("Con esta, llevás 480 kg en la semana.")).toBeInTheDocument();
});

test("acumulado semanal con calentamiento → «Con esta, llevás ~X kg…» (rampa estimada, regla 06-11)", async () => {
  const views: SessionView[] = [
    ...sessions(), // día 0: 380 kg de trabajo, sin rampa
    {
      week: 8, sessionIdx: 1,
      exercises: [
        { movementId: "sentadilla", movementName: "Sentadilla", sets: 5, reps: 5, pct: 75, targetKg: 124,
          warmup: [{ pct: 0, kg: 20, reps: 5, label: "barra" }],
          actual: actual({ movementId: "sentadilla", movementName: "Sentadilla", sets: [{ kg: 100, reps: 1, done: true }] }) },
      ],
    },
  ];
  vi.spyOn(me, "getMeSessions").mockResolvedValue(views);
  renderVictoria();
  expect(await screen.findByText("Sesión completada")).toBeInTheDocument();
  // semana = 380 + 100 de trabajo + 100 de rampa prescrita del ejercicio hecho = ~580
  expect(screen.getByText("Con esta, llevás ~580 kg en la semana.")).toBeInTheDocument();
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
