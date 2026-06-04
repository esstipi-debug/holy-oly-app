import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, vi, type MockInstance } from "vitest";
import type { ExerciseActualInput, MePlanView, SessionView } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { EntrenoScreen } from "../EntrenoScreen";

// simplerVariants("arranque")[0] = "arranque.colgado.bajo" (complexity 8, hang below knee)
// name: "Arranque colgado (bajo)"

const PLAN_FIXTURE: MePlanView = {
  athlete: { nombre: "Mara V.", iniciales: "MV", sexo: "F" },
  plan: { macroName: "Ruso 5D", totalWeeks: 12, currentWeek: 8, currentPhase: "Fuerza", phases: [], comps: [] },
};

const SESSION_FIXTURE: SessionView[] = [
  {
    week: 8,
    sessionIdx: 0,
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 5, reps: 2, pct: 80, targetKg: 64 },
    ],
  },
];

let getPlan: MockInstance<any>;
let getSessions: MockInstance<any>;
let put: MockInstance<any>;

beforeEach(() => {
  getPlan = vi.spyOn(me, "getMePlan").mockResolvedValue(PLAN_FIXTURE);
  getSessions = vi.spyOn(me, "getMeSessions").mockResolvedValue(SESSION_FIXTURE);
  put = vi.spyOn(me, "putMeSession").mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

function renderEntreno() {
  return render(
    <MemoryRouter initialEntries={["/atleta/entreno/8/0"]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx" element={<EntrenoScreen />} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("render: muestra series×reps, kg y discos; SIN checkbox ni input siempre visible", async () => {
  renderEntreno();
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
  expect(screen.getByText(/5 series × 2 repeticiones/)).toBeInTheDocument();
  expect(screen.getByText("64")).toBeInTheDocument();
  // DiscRow renders at least one SVG (disc)
  const svgs = document.querySelectorAll("svg");
  expect(svgs.length).toBeGreaterThanOrEqual(1);
  // No always-visible "hecho" checkbox
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  // No always-visible kg input (only after "modificar")
  expect(screen.queryByLabelText(/kg real de Arranque/i)).not.toBeInTheDocument();
});

test("guardar sin modificar → done:true, kg:64, reps:2, movementId:arranque", async () => {
  renderEntreno();
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent).toMatchObject({ done: true, kg: 64, reps: 2, movementId: "arranque", prescribedMovementId: "arranque" });
});

test("modificar peso (✎ modificar → kg=60) → guardar → done:true, kg:60", async () => {
  renderEntreno();
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /modificar Arranque/i }));
  fireEvent.change(screen.getByLabelText(/kg real de Arranque/i), { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent).toMatchObject({ done: true, kg: 60 });
});

test("no la hice → guardar → done:false", async () => {
  renderEntreno();
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /modificar Arranque/i }));
  fireEvent.click(screen.getByRole("button", { name: /no la hice/i }));
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent).toMatchObject({ done: false });
});

test("sustituir → ⇄ → arranque.colgado.bajo → kg limpio → kg=50 → guardar → movementId correcto", async () => {
  renderEntreno();
  expect(await screen.findByText("Arranque")).toBeInTheDocument();

  // Open modify to get the swap button
  fireEvent.click(screen.getByRole("button", { name: /modificar Arranque/i }));
  // Open substitute sheet
  fireEvent.click(screen.getByRole("button", { name: /cambiar movimiento de Arranque/i }));

  // Pick the first simpler variant
  const variant = await screen.findByRole("button", { name: /Arranque colgado \(bajo\)/i });
  fireEvent.click(variant);

  // Row shows the new movement name; kg should be cleared
  expect(screen.getByText("Arranque colgado (bajo)")).toBeInTheDocument();
  expect(screen.getByLabelText(/kg real de Arranque colgado/i)).toHaveValue(null);

  // Enter kg and save
  fireEvent.change(screen.getByLabelText(/kg real de Arranque colgado/i), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));

  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent.movementId).toBe("arranque.colgado.bajo");
  expect(sent.prescribedMovementId).toBe("arranque");
  expect(sent.kg).toBe(50);
  expect(sent.done).toBe(true);
});
