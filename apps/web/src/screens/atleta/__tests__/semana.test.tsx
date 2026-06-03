import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach, vi } from "vitest";
import * as me from "../../../data/meClient";
import { SemanaCard } from "../hoy/SemanaCard";

afterEach(() => vi.restoreAllMocks());

vi.spyOn(me, "getMeSessions").mockResolvedValue([
  { week: 8, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 2, pct: 80, movementName: "Arranque", targetKg: 64, actual: { done: true } }] },
  { week: 8, sessionIdx: 1, exercises: [{ movementId: "cargada", sets: 5, reps: 2, pct: 80, movementName: "Cargada", targetKg: 80 }] },
] as never);

test("lista los días de la semana y navega al tocar uno", async () => {
  render(
    <MemoryRouter initialEntries={["/atleta"]}>
      <Routes>
        <Route path="/atleta" element={<SemanaCard week={8} />} />
        <Route path="/atleta/entreno/:week/:idx" element={<div>ENTRENO</div>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText(/Día 1/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Día 2/ }));
  await waitFor(() => expect(screen.getByText("ENTRENO")).toBeInTheDocument());
});
