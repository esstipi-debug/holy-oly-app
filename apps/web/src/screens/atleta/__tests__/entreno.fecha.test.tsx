import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, test, expect, vi, type MockInstance } from "vitest";
import type { MePlanView, PutMeSessionInput, SessionView } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { FechaOcupadaError } from "../../../data/meClient";
import { EntrenoScreen } from "../EntrenoScreen";

// HOY/AYER anclados a un solo instante (UTC, igual que el HOY de EntrenoScreen) para evitar
// flake de medianoche. EntrenoScreen captura su HOY al evaluar el módulo con esta misma fórmula.
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const NOW = Date.now();
const HOY = iso(NOW);
const AYER = iso(NOW - 86_400_000);

const PLAN_FIXTURE: MePlanView = {
  athlete: { nombre: "Mara V.", iniciales: "MV", sexo: "F" },
  plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 9, currentPhase: "Fuerza", startDate: "2026-04-13", phases: [], comps: [] },
};

// 4 sesiones de la semana 9. Las construye cada test (la sesión 0 lleva la fecha que arma el caso).
const exercisesFor = (): SessionView["exercises"] => [
  { movementId: "arranque", movementName: "Arranque", sets: 3, reps: 2, pct: 80, targetKg: 64, warmup: [] },
];

function weekViews(overrides: Partial<Record<number, Partial<SessionView>>> = {}): SessionView[] {
  return [0, 1, 2, 3].map((sessionIdx) => ({
    week: 9,
    sessionIdx,
    day: sessionIdx + 1,
    exercises: exercisesFor(),
    ...overrides[sessionIdx],
  }));
}

let put: MockInstance<any>;

beforeEach(() => {
  vi.spyOn(me, "getMePlan").mockResolvedValue(PLAN_FIXTURE);
  put = vi.spyOn(me, "putMeSession").mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

// Entra a la sesión `idx` de la semana 9.
function renderEntreno(idx: number) {
  return render(
    <MemoryRouter initialEntries={[`/atleta/entreno/9/${idx}`]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx" element={<EntrenoScreen />} />
        <Route path="/atleta/entreno/:week/:idx/victoria" element={<div>VICTORIA</div>} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Maneja todo el flujo del player hasta el guardado: iniciar → Fin · Guardar.
async function startAndSave(idx: number) {
  renderEntreno(idx);
  fireEvent.click(await screen.findByRole("button", { name: /iniciar entrenamiento/i }));
  fireEvent.click(await screen.findByRole("button", { name: /guardar entreno/i }));
}

test("hoy ocupada por otra sesión → FechaSheet aparece al entrar (D5)", async () => {
  // La sesión 0 (día 1) ya tiene HOY; entramos a la sesión 3 (día 4, distinto) → conflicto upfront.
  vi.spyOn(me, "getMeSessions").mockResolvedValue(weekViews({ 0: { fecha: HOY } }));
  renderEntreno(3);
  expect(await screen.findByText(/ya registraste un entreno hoy/i)).toBeInTheDocument();
});

test("hoy libre → sin sheet; guarda con {fecha: hoy}", async () => {
  // Ninguna otra sesión ocupa HOY → camino feliz, cero fricción.
  vi.spyOn(me, "getMeSessions").mockResolvedValue(weekViews());
  await startAndSave(0);
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect(put).toHaveBeenCalledWith(9, 0, expect.objectContaining({ fecha: HOY }));
  // El camino feliz nunca abrió el sheet de conflicto.
  expect(screen.queryByText(/ya registraste un entreno hoy/i)).not.toBeInTheDocument();
});

test("409 del server → abre FechaSheet y reintenta con la fecha elegida", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(weekViews());
  put.mockRejectedValueOnce(new FechaOcupadaError({ week: 9, sessionIdx: 0, fecha: HOY })).mockResolvedValue(undefined);
  await startAndSave(0);
  // 1er guardado con HOY → rechazo 409 → reabre el sheet de conflicto.
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect((put.mock.calls[0]![2] as PutMeSessionInput).fecha).toBe(HOY);
  expect(await screen.findByText(/ya registraste un entreno hoy/i)).toBeInTheDocument();
  // Elegimos Ayer en el sheet → reintentamos el guardado → la última llamada lleva AYER.
  fireEvent.click(screen.getByRole("button", { name: /ayer/i }));
  fireEvent.click(await screen.findByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
  expect((put.mock.calls[1]![2] as PutMeSessionInput).fecha).toBe(AYER);
});

test("edición de sesión registrada conserva su fecha (D12)", async () => {
  // La sesión 0 ya tiene su fecha registrada (entreno pasado) → editar la conserva, no usa HOY.
  vi.spyOn(me, "getMeSessions").mockResolvedValue(weekViews({ 0: { fecha: "2026-06-09" } }));
  await startAndSave(0);
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect((put.mock.calls[0]![2] as PutMeSessionInput).fecha).toBe("2026-06-09");
  // Sin conflicto: su propia fecha gana antes que cualquier chequeo de HOY.
  expect(screen.queryByText(/ya registraste un entreno hoy/i)).not.toBeInTheDocument();
});
