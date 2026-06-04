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

test("muestra error si onSave falla", async () => {
  const onSave = vi.fn().mockRejectedValue(new Error("Red caída"));
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} onClose={() => {}} onSave={onSave} />);
  fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Red caída");
  expect(screen.getByRole("button", { name: "Guardar sesión" })).not.toBeDisabled();
});

test("sustituye un movimiento y onSave recibe el nuevo movementId con esquema preservado", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} onClose={() => {}} onSave={onSave} />);
  // Open the substitute sheet for "Arranque"
  fireEvent.click(screen.getByRole("button", { name: "cambiar Arranque" }));
  // The sheet should be open — pick "Arranque colgado (bajo)" (simpler variant id: arranque.colgado.bajo)
  const pickBtn = await screen.findByRole("button", { name: "Arranque colgado (bajo)" });
  fireEvent.click(pickBtn);
  // Row now shows the new movement name
  expect(screen.getByText("Arranque colgado (bajo)")).toBeInTheDocument();
  // Save and verify onSave receives the new movementId with scheme (sets/reps) preserved
  fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0]![0][0] as { movementId: string; sets: number; reps: number; pct?: number };
  expect(saved.movementId).toBe("arranque.colgado.bajo");
  expect(saved.sets).toBe(5);
  expect(saved.reps).toBe(3);
  expect(saved.pct).toBeDefined(); // arranque.colgado.bajo has rmRef "arranque" → usesPct = true
});

test("reordena ejercicios con las flechas", () => {
  const two: PrescribedExerciseView[] = [
    { movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 },
    { movementId: "sentadilla", sets: 5, reps: 5, pct: 80, movementName: "Sentadilla", targetKg: 112 },
  ];
  render(<SessionEditor open week={1} sessionIdx={0} exercises={two} onClose={() => {}} onSave={vi.fn()} />);
  const names = () =>
    screen
      .getAllByRole("button", { name: /^(subir|bajar|Quitar) (Arranque|Sentadilla)$/ })
      .map((btn) => (btn.getAttribute("aria-label") ?? "").replace(/^(subir|bajar|Quitar) /, ""))
      .filter((v, i, arr) => arr.indexOf(v) === i);
  expect(names()).toEqual(["Arranque", "Sentadilla"]);
  fireEvent.click(screen.getByRole("button", { name: "subir Sentadilla" }));
  expect(names()).toEqual(["Sentadilla", "Arranque"]);
});
