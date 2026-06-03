import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, beforeEach, vi, type MockInstance } from "vitest";
import type { ExerciseActualInput } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { EntrenoScreen } from "../EntrenoScreen";

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
