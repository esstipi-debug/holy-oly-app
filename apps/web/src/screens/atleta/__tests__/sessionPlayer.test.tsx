import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { SessionPlayer, type PlayerRow } from "../entreno/SessionPlayer";

function row(over: Partial<PlayerRow> = {}): PlayerRow {
  return {
    movementId: "cargada-envion", movementName: "Envión", prescribedMovementId: "cargada-envion",
    sets: 3, reps: 2, targetKg: 90, pct: 78, notes: "pecho alto en el catch",
    warmup: [{ pct: 0, kg: 15, reps: 5, label: "barra" }],
    series: [{ kg: 90, reps: 2, done: true }, { kg: 90, reps: 2, done: true }, { kg: 90, reps: 2, done: true }],
    ...over,
  };
}

const cbs = () => ({ onPatchSet: vi.fn(), onSubstitute: vi.fn(), onMovementNotDone: vi.fn(), onPrev: vi.fn(), onNext: vi.fn(), onFinish: vi.fn(), onExit: vi.fn() });

test("header: Movimiento X/Y, nombre, series×reps·%, cue del coach", () => {
  render(<SessionPlayer row={row()} index={0} total={3} barKg={15} busy={false} {...cbs()} />);
  expect(screen.getByText("Movimiento 1/3")).toBeInTheDocument();
  expect(screen.getByText("Envión")).toBeInTheDocument();
  expect(screen.getByText(/3 series × 2 reps · 78%/)).toBeInTheDocument();
  expect(screen.getByText(/pecho alto en el catch/)).toBeInTheDocument();
  expect(screen.getByText(/Calentamiento/)).toBeInTheDocument();
  expect(screen.getByText("Serie 1/3")).toBeInTheDocument();
});

test("primer movimiento: la flecha atrás VIVE y sale al resumen (pedido owner); 'Siguiente' avanza", () => {
  const c = cbs();
  render(<SessionPlayer row={row()} index={0} total={3} barKg={15} busy={false} {...c} />);
  const back = screen.getByRole("button", { name: /volver al resumen del día/i });
  expect(back).toBeEnabled();
  fireEvent.click(back);
  expect(c.onExit).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /siguiente movimiento/i }));
  expect(c.onNext).toHaveBeenCalled();
});

test("movimiento intermedio: la flecha atrás va al movimiento anterior", () => {
  const c = cbs();
  render(<SessionPlayer row={row()} index={1} total={3} barKg={15} busy={false} {...c} />);
  fireEvent.click(screen.getByRole("button", { name: /movimiento anterior/i }));
  expect(c.onPrev).toHaveBeenCalled();
  expect(c.onExit).not.toHaveBeenCalled();
});

test("último movimiento: muestra 'Fin · Guardar' y llama onFinish", () => {
  const c = cbs();
  render(<SessionPlayer row={row()} index={2} total={3} barKg={15} busy={false} {...c} />);
  fireEvent.click(screen.getByRole("button", { name: /guardar entreno/i }));
  expect(c.onFinish).toHaveBeenCalled();
});

test("sustituido: oculta el calentamiento y muestra el prescripto", () => {
  const c = cbs();
  render(<SessionPlayer row={row({ movementId: "press-empuje", movementName: "Press de empuje", prescribedMovementId: "cargada-envion" })} index={0} total={1} barKg={15} busy={false} {...c} />);
  expect(screen.queryByText(/Calentamiento/)).not.toBeInTheDocument();
  expect(screen.getByText(/prescripto: Envión/)).toBeInTheDocument();
});

test("⇄ cambiar y 'no la hice (todo)' llaman sus callbacks", () => {
  const c = cbs();
  render(<SessionPlayer row={row()} index={0} total={1} barKg={15} busy={false} {...c} />);
  fireEvent.click(screen.getByRole("button", { name: /cambiar movimiento/i }));
  expect(c.onSubstitute).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /no la hice \(todo\)/i }));
  expect(c.onMovementNotDone).toHaveBeenCalled();
});
