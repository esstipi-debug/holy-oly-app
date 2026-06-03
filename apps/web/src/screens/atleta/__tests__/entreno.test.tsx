import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi } from "vitest";
import * as me from "../../../data/meClient";
import { EntrenoScreen } from "../EntrenoScreen";

vi.spyOn(me, "getMeSessions").mockResolvedValue([
  { week: 1, sessionIdx: 0, exercises: [{ movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 }] },
] as never);
const put = vi.spyOn(me, "putMeSession").mockResolvedValue(undefined);

test("carga la sesión, registra lo real y guarda", async () => {
  render(
    <MemoryRouter initialEntries={["/atleta/entreno/1/0"]}>
      <Routes>
        <Route path="/atleta/entreno/:week/:idx" element={<EntrenoScreen />} />
        <Route path="/atleta" element={<div>HOY</div>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText("Arranque")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("kg real de Arranque"), { target: { value: "58" } });
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect(put.mock.calls[0]![2][0]).toMatchObject({ order: 0, movementId: "arranque", kg: 58 });
});
