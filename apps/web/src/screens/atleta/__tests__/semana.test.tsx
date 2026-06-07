import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, vi } from "vitest";

vi.mock("../../../data/meClient", () => {
  const getMeSessions = vi.fn();
  return { getMeSessions, meClient: { getMeSessions } };
});

import * as me from "../../../data/meClient";
import { SemanaCard } from "../hoy/SemanaCard";

const MOCK_SESSIONS = [
  { week: 8, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64, actual: { done: true } }] },
  { week: 8, sessionIdx: 1, exercises: [{ movementId: "cargada", sets: 5, reps: 2, pct: 80, movementName: "Cargada", targetKg: 80 }] },
];

vi.mocked(me.getMeSessions).mockResolvedValue(MOCK_SESSIONS as never);

afterEach(() => vi.clearAllMocks());

function renderCard() {
  return render(
    <MemoryRouter initialEntries={["/atleta"]}>
      <Routes>
        <Route path="/atleta" element={<SemanaCard week={8} />} />
        <Route path="/atleta/entreno/:week/:idx" element={<div>ENTRENO</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

test("lista los días de la semana y navega al tocar uno", async () => {
  renderCard();
  expect(await screen.findByText(/Día 1/)).toBeInTheDocument();
  // Use aria-label to target the day-list button specifically (CTA also contains "Día 2")
  fireEvent.click(screen.getByRole("button", { name: "Día 2" }));
  await waitFor(() => expect(screen.getByText("ENTRENO")).toBeInTheDocument());
});

test("CTA primario apunta al siguiente día pendiente y navega", async () => {
  renderCard();
  // Día 1 está done, Día 2 está pendiente → CTA debe decir "Registrar entreno · Día 2"
  const cta = await screen.findByRole("button", { name: /Registrar entreno · Día 2/ });
  expect(cta).toBeInTheDocument();
  fireEvent.click(cta);
  await waitFor(() => expect(screen.getByText("ENTRENO")).toBeInTheDocument());
});
