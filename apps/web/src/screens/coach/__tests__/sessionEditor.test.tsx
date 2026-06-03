import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { PrescribedExerciseView } from "@holy-oly/core";
import { SessionEditor } from "../sessions/SessionEditor";

const exs: PrescribedExerciseView[] = [
  { movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 },
];

test("edita reps y guarda los ejercicios", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} onClose={() => {}} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText("reps de Arranque"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0]![0][0]).toMatchObject({ movementId: "arranque", sets: 5, reps: 2, pct: 70 });
});

test("quita un ejercicio", () => {
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} onClose={() => {}} onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Quitar Arranque" }));
  expect(screen.queryByLabelText("reps de Arranque")).not.toBeInTheDocument();
});
