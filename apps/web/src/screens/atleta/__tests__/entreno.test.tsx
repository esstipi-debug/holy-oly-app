import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, vi, type MockInstance } from "vitest";
import type { ExerciseActualInput } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { EntrenoScreen } from "../EntrenoScreen";

// simplerVariants("arranque")[0] = "arranque.colgado.bajo" (complexity 8, full from hang below knee)
// name: "Arranque colgado (bajo)"

const SESSION_FIXTURE = [
  { week: 1, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 }] },
] as never;

let put: MockInstance<any>;

beforeEach(() => {
  vi.spyOn(me, "getMeSessions").mockResolvedValue(SESSION_FIXTURE);
  put = vi.spyOn(me, "putMeSession").mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

function renderEntrenamo() {
  return render(
    <MemoryRouter initialEntries={["/atleta/entreno/1/0"]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx" element={<EntrenoScreen />} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("carga la sesión, registra lo real y guarda", async () => {
  renderEntrenamo();
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("hecho Arranque"));
  fireEvent.change(screen.getByLabelText("kg real de Arranque"), { target: { value: "58" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent1 = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent1).toMatchObject({ order: 0, movementId: "arranque", kg: 58 });
});

test("ejercicio no marcado como hecho no envía reals (sin-dato)", async () => {
  renderEntrenamo();
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("kg real de Arranque"), { target: { value: "58" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  const sent2 = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent2).toMatchObject({ order: 0, done: false });
  expect(sent2.kg).toBeUndefined();
});

test("sustituir movimiento: abre el sheet, elige variante, guarda con prescribedMovementId", async () => {
  renderEntrenamo();
  expect(await screen.findByText("Arranque")).toBeInTheDocument();

  // Click the swap button to open SubstituteSheet
  fireEvent.click(
    screen.getByRole("button", { name: /cambiar movimiento de Arranque/i }),
  );

  // Fix 1 guard: clicking ⇄ must NOT toggle the "done" checkbox (button was outside label)
  expect(screen.getByLabelText("hecho Arranque")).not.toBeChecked();

  // Sheet is open — pick the first simpler variant
  const variant = screen.getByRole("button", { name: /Arranque colgado \(bajo\)/i });
  fireEvent.click(variant);

  // Row now shows the new movement name; kg should be cleared
  expect(screen.getByText("Arranque colgado (bajo)")).toBeInTheDocument();
  expect(screen.getByLabelText(/kg real de Arranque colgado/i)).toHaveValue(null);

  // Mark done and save
  fireEvent.click(
    screen.getByLabelText(/hecho Arranque colgado/i),
  );
  fireEvent.change(
    screen.getByLabelText(/kg real de Arranque colgado/i),
    { target: { value: "55" } },
  );
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));

  const sent = (put.mock.calls[0]![2] as ExerciseActualInput[])[0]!;
  expect(sent.movementId).toBe("arranque.colgado.bajo");
  expect(sent.prescribedMovementId).toBe("arranque");
  expect(sent.kg).toBe(55);
});
