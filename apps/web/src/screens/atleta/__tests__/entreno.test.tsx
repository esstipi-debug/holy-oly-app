import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, test, expect, vi, type MockInstance } from "vitest";
import type { MePlanView, PutMeSessionInput, SessionView } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { EntrenoScreen } from "../EntrenoScreen";

const PLAN_FIXTURE: MePlanView = {
  athlete: { nombre: "Mara V.", iniciales: "MV", sexo: "F" },
  plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 8, currentPhase: "Fuerza", phases: [], comps: [] },
};

const SESSION_FIXTURE: SessionView[] = [
  {
    week: 8, sessionIdx: 0,
    exercises: [
      {
        movementId: "arranque", movementName: "Arranque", sets: 3, reps: 2, pct: 80, targetKg: 64,
        warmup: [{ pct: 0, kg: 15, reps: 5, label: "barra" }, { pct: 40, kg: 26, reps: 5, label: "rampa" }],
      },
    ],
  },
];

let put: MockInstance<any>;

beforeEach(() => {
  vi.spyOn(me, "getMePlan").mockResolvedValue(PLAN_FIXTURE);
  vi.spyOn(me, "getMeSessions").mockResolvedValue(SESSION_FIXTURE);
  put = vi.spyOn(me, "putMeSession").mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

function renderEntreno() {
  return render(
    <MemoryRouter initialEntries={["/atleta/entreno/8/0"]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx" element={<EntrenoScreen />} />
        <Route path="/atleta/entreno/:week/:idx/victoria" element={<div>VICTORIA</div>} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function start() {
  renderEntreno();
  fireEvent.click(await screen.findByRole("button", { name: /iniciar entrenamiento/i }));
}

test("entrada: resumen con iniciar; tras iniciar abre el primer ejercicio (hero + calentamiento bloqueante)", async () => {
  renderEntreno();
  expect(await screen.findByRole("button", { name: /iniciar entrenamiento/i })).toBeInTheDocument();
  expect(screen.getByText("Arranque")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /iniciar entrenamiento/i }));
  // la card abierta muestra el calentamiento (valorado como volumen) y BLOQUEA las series hasta calentar
  expect(screen.getByText(/técnica \+ volumen de base/i)).toBeInTheDocument();
  expect(screen.getByText(/Calentá primero/i)).toBeInTheDocument();
  // saltar calentamiento revela las series de trabajo (nacen hechas — adherencia por defecto)
  fireEvent.click(screen.getByRole("button", { name: /saltar calentamiento/i }));
  expect(screen.getByRole("button", { name: /serie 1 de 3/i })).toBeInTheDocument();
});

test("marcar-a-medida: confirmar las 3 series → guardar → done@target, top-level done:true", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /saltar calentamiento/i }));
  // las series NACEN sin marcar (marcar-a-medida): confirmo cada una
  fireEvent.click(screen.getByRole("button", { name: /serie 1 de 3/i }));
  fireEvent.click(screen.getByRole("button", { name: /serie 2 de 3/i }));
  fireEvent.click(screen.getByRole("button", { name: /serie 3 de 3/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as PutMeSessionInput).actuals[0]!;
  expect(sent.done).toBe(true);
  expect(sent.movementId).toBe("arranque");
  expect(sent.sets).toHaveLength(3);
  expect(sent.sets!.every((s) => s.done && s.kg === 64 && s.reps === 2)).toBe(true);
});

test("modificar la serie 2 (−1 kg) → guardar → sólo esa serie cambia (independiente)", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /saltar calentamiento/i }));
  fireEvent.click(screen.getByRole("button", { name: /ajustar serie 2/i }));
  fireEvent.click(screen.getByRole("button", { name: /menos kg serie 2/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sets = (put.mock.calls[0]![2] as PutMeSessionInput).actuals[0]!.sets!;
  expect(sets[0]!.kg).toBe(64);
  expect(sets[1]!.kg).toBe(63); // 64 − 1, sólo la serie 2 (independiente)
  expect(sets[2]!.kg).toBe(64);
});

test("'no la hice (todo)' → todas las series done:false, exercise done:false", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /no la hice \(todo\)/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as PutMeSessionInput).actuals[0]!;
  expect(sent.done).toBe(false);
  expect(sent.sets!.every((s) => s.done === false)).toBe(true);
});

// W4/D5 (verificado en W8): error de carga ≠ día vacío — un fallo de API no puede disfrazarse
// de "no hay sesión"; rinde role="alert" + Reintentar, y el retry re-dispara el fetch.
test("error de carga → alert con Reintentar; el retry recupera la sesión", async () => {
  vi.spyOn(me, "getMeSessions").mockRejectedValueOnce(new Error("network"));
  renderEntreno();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("No se pudo cargar la sesión.");
  expect(screen.queryByText("No hay sesión para este día.")).not.toBeInTheDocument();
  // el retry vuelve a pedir (el spy del beforeEach resuelve la fixture) → renderiza el resumen
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("button", { name: /iniciar entrenamiento/i })).toBeInTheDocument();
  expect(screen.getByText("Arranque")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("0 filas → 'No hay sesión para este día.' sin alert (vacío honesto)", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue([]);
  renderEntreno();
  expect(await screen.findByText("No hay sesión para este día.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
});

// ── Secuencia de días (2026-06-13): anular / bloqueo / reactivar ──────────────
const exFor = (): SessionView["exercises"] => [
  { movementId: "arranque", movementName: "Arranque", sets: 3, reps: 2, pct: 80, targetKg: 64, warmup: [] },
];

test("anular: confirma → llama anularMeSession y vuelve al inicio", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const anular = vi.spyOn(me, "anularMeSession").mockResolvedValue(undefined);
  renderEntreno(); // 8/0 = día 1, desbloqueado
  fireEvent.click(await screen.findByRole("button", { name: /anular este entreno/i }));
  await waitFor(() => expect(anular).toHaveBeenCalledWith(8, 0));
  await waitFor(() => expect(screen.getByText("HOY")).toBeInTheDocument());
});

test("día bloqueado (día anterior pendiente): muestra 🔒 y no deja iniciar", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue([
    { week: 8, sessionIdx: 0, day: 1, exercises: exFor() },
    { week: 8, sessionIdx: 1, day: 2, exercises: exFor() },
  ]);
  render(
    <MemoryRouter initialEntries={["/atleta/entreno/8/1"]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx" element={<EntrenoScreen />} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/completa el día anterior/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /iniciar entrenamiento/i })).not.toBeInTheDocument();
});

test("día anulado: ofrece reactivar → llama desanularMeSession", async () => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue([
    { week: 8, sessionIdx: 0, day: 1, anulado: true, exercises: exFor() },
  ]);
  const des = vi.spyOn(me, "desanularMeSession").mockResolvedValue(undefined);
  renderEntreno(); // 8/0
  fireEvent.click(await screen.findByRole("button", { name: /reactivar este entreno/i }));
  await waitFor(() => expect(des).toHaveBeenCalledWith(8, 0));
});

test("sustituir → kg de las series se limpia → cargar kg en serie 1 → guardar → movementId correcto", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /cambiar movimiento de Arranque/i }));
  // simplerVariants("arranque")[0] = "arranque.colgado.bajo" → "Arranque desde colgado (bajo)"
  fireEvent.click(await screen.findByRole("button", { name: /Arranque desde colgado \(bajo\)/i }));
  // sustituido → sin gate de calentamiento: las series aparecen directo (kg en blanco)
  fireEvent.click(screen.getByRole("button", { name: /ajustar serie 1/i }));
  fireEvent.click(screen.getByRole("button", { name: /más kg serie 1/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as PutMeSessionInput).actuals[0]!;
  expect(sent.movementId).toBe("arranque.colgado.bajo");
  expect(sent.prescribedMovementId).toBe("arranque");
  expect(sent.sets![0]!.kg).toBe(1); // de — (limpio) a 1 con un "+"
});
