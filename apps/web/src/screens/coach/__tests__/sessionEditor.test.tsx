import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import type { PrescribedExerciseView, RM } from "@holy-oly/core";
import { SessionEditor } from "../sessions/SessionEditor";

const exs: PrescribedExerciseView[] = [
  { movementId: "arranque", sets: 5, reps: 3, pct: 70, movementName: "Arranque", targetKg: 56 },
];

const RMS: RM = { arranque: 100, envion: 120, sentadilla: 150, frente: 130 };

test("edita reps y guarda los ejercicios", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} onClose={() => {}} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText("reps de Arranque"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0]![0][0]).toMatchObject({ movementId: "arranque", sets: 5, reps: 2, pct: 70 });
  // no RPE field in saved data
  expect((onSave.mock.calls[0]![0][0] as Record<string, unknown>).rpe).toBeUndefined();
});

test("no muestra input de RPE — accesorios usan % (pct)", () => {
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} onClose={() => {}} onSave={vi.fn()} />);
  expect(screen.queryByLabelText(/rpe de Arranque/i)).not.toBeInTheDocument();
  // % input is always shown (pct present for all movements now that rmRef="none" is gone)
  expect(screen.getByLabelText(/% de Arranque/i)).toBeInTheDocument();
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

test("cambia el movimiento por CUALQUIERA de la librería (no sólo sustitutos), esquema preservado", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} onClose={() => {}} onSave={onSave} />);
  // ⇄ "cambiar" abre el selector de movimientos COMPLETO (no el de sustitutos)
  fireEvent.click(screen.getByRole("button", { name: "cambiar Arranque" }));
  // buscar y elegir un movimiento distinto, que NO es un sustituto registrado del arranque
  fireEvent.change(await screen.findByLabelText("Buscar movimiento"), { target: { value: "sentadilla" } });
  fireEvent.click(await screen.findByRole("button", { name: "Sentadilla trasera" }));
  // la fila ahora muestra el nuevo movimiento
  expect(screen.getByText("Sentadilla trasera")).toBeInTheDocument();
  // guarda con el nuevo movementId, esquema (sets/reps) preservado, pct presente
  fireEvent.click(screen.getByRole("button", { name: "Guardar sesión" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const saved = onSave.mock.calls[0]![0][0] as { movementId: string; sets: number; reps: number; pct?: number };
  expect(saved.movementId).toBe("sentadilla");
  expect(saved.sets).toBe(5);
  expect(saved.reps).toBe(3);
  expect(saved.pct).toBeDefined(); // sentadilla tiene rmRef "sentadilla" → usesPct = true
});

test("con % y RM muestra el kg derivado en vivo; override manual lo marca '(fijo)'", () => {
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} rms={RMS} onClose={() => {}} onSave={vi.fn()} />);
  // arranque 5×3 @ 70% · RM arranque 100 → 70 kg
  expect(screen.getByText(/= 70 kg/)).toBeInTheDocument();
  // override manual → el peso pasa a "(fijo)"
  fireEvent.change(screen.getByLabelText("kg de Arranque"), { target: { value: "90" } });
  expect(screen.getByText(/= 90 kg \(fijo\)/)).toBeInTheDocument();
});

test("V3: una fila cx.* muestra el análisis de carga neural con eslabón débil (RMs presentes)", () => {
  const cxRow: PrescribedExerciseView[] = [
    { movementId: "cx.cargada+frontal+2t", sets: 4, reps: 1, pct: 80, movementName: "Cargada + Sent. frontal + Segundo tiempo (1+1+1)", targetKg: 96 },
  ];
  render(<SessionEditor open week={1} sessionIdx={0} exercises={cxRow} rms={RMS} onClose={() => {}} onSave={vi.fn()} />);
  const box = screen.getByLabelText(/análisis del complejo/i);
  expect(box).toHaveTextContent("SNC");
  expect(box).toHaveTextContent("85%"); // tope programable
  expect(box).toHaveTextContent(/Eslabón débil/);
  expect(box).toHaveTextContent("Envión");
  expect(box).toHaveTextContent("120 kg"); // RM del eslabón débil
});

test("V3: una fila de movimiento simple NO muestra análisis de complejo", () => {
  render(<SessionEditor open week={1} sessionIdx={0} exercises={exs} rms={RMS} onClose={() => {}} onSave={vi.fn()} />);
  expect(screen.queryByLabelText(/análisis del complejo/i)).not.toBeInTheDocument();
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
