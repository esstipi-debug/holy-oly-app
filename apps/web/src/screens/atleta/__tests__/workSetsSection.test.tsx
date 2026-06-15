import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { WorkSetsSection, type SetRow } from "../entreno/WorkSetsSection";

const SERIES: SetRow[] = [
  { kg: 90, reps: 2, done: true },
  { kg: 90, reps: 2, done: true },
  { kg: 90, reps: 2, done: true },
];

test("renderiza N filas de serie tocables con kg, reps y discos", () => {
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={() => {}} />);
  expect(screen.getByRole("button", { name: /serie 1 de 3, 90 kilos por 2 reps/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /serie 3 de 3, 90 kilos por 2 reps/i })).toBeInTheDocument();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3); // discos por fila
});

test("tap en una fila marca/desmarca → onPatchSet(i, {done})", () => {
  const onPatchSet = vi.fn();
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={onPatchSet} />);
  fireEvent.click(screen.getByRole("button", { name: /serie 2 de 3/i }));
  expect(onPatchSet).toHaveBeenCalledWith(1, { done: false }); // nace done:true → toggle
});

test("editor por serie: − kg en la serie 2 llama onPatchSet(1, {kg}) (independiente)", () => {
  const onPatchSet = vi.fn();
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={onPatchSet} />);
  fireEvent.click(screen.getByRole("button", { name: /ajustar serie 2/i }));
  fireEvent.click(screen.getByRole("button", { name: /menos kg serie 2/i }));
  expect(onPatchSet).toHaveBeenCalledWith(1, { kg: 89 }); // 90 − 1, solo la serie 2
});

test("'no la hice' en el editor de una serie llama onPatchSet(i, {done:false})", () => {
  const onPatchSet = vi.fn();
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={onPatchSet} />);
  fireEvent.click(screen.getByRole("button", { name: /ajustar serie 3/i }));
  fireEvent.click(screen.getByRole("button", { name: /^no la hice$/i }));
  expect(onPatchSet).toHaveBeenCalledWith(2, { done: false });
});
