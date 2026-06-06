import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, test, expect, vi, type MockInstance } from "vitest";
import type { ExerciseActualInput, MePlanView, SessionView } from "@holy-oly/core";
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

test("entrada: resumen con iniciar; tras iniciar entra al reproductor", async () => {
  renderEntreno();
  expect(await screen.findByRole("button", { name: /iniciar entrenamiento/i })).toBeInTheDocument();
  expect(screen.getByText("Arranque")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /iniciar entrenamiento/i }));
  expect(screen.getByText("Movimiento 1/1")).toBeInTheDocument();
  expect(screen.getByText("Serie 1/3")).toBeInTheDocument();
  expect(screen.getByText(/Calentamiento/)).toBeInTheDocument();
});

test("guardar sin modificar → sets de 3 series done@target, top-level done:true", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent.done).toBe(true);
  expect(sent.movementId).toBe("arranque");
  expect(sent.sets).toHaveLength(3);
  expect(sent.sets!.every((s) => s.done && s.kg === 64 && s.reps === 2)).toBe(true);
});

test("modificar la serie 2 (kg=60) → guardar → sólo esa serie cambia (independiente)", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /modificar serie 2/i }));
  fireEvent.change(screen.getByLabelText(/kg serie 2/i), { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: /listo serie 2/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sets = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!.sets!;
  expect(sets[0]!.kg).toBe(64);
  expect(sets[1]!.kg).toBe(60); // sólo la 2
  expect(sets[2]!.kg).toBe(64);
});

test("'no la hice (todo)' → todas las series done:false, exercise done:false", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /no la hice \(todo\)/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent.done).toBe(false);
  expect(sent.sets!.every((s) => s.done === false)).toBe(true);
});

test("sustituir → kg de las series se limpia → cargar kg en serie 1 → guardar → movementId correcto", async () => {
  await start();
  fireEvent.click(screen.getByRole("button", { name: /cambiar movimiento de Arranque/i }));
  // simplerVariants("arranque")[0] = "arranque.colgado.bajo" → "Arranque colgado (bajo)"
  fireEvent.click(await screen.findByRole("button", { name: /Arranque colgado \(bajo\)/i }));
  fireEvent.click(screen.getByRole("button", { name: /modificar serie 1/i }));
  fireEvent.change(screen.getByLabelText(/kg serie 1/i), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: /listo serie 1/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent.movementId).toBe("arranque.colgado.bajo");
  expect(sent.prescribedMovementId).toBe("arranque");
  expect(sent.sets![0]!.kg).toBe(50);
});
