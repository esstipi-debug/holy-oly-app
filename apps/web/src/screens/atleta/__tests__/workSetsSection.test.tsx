import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { WorkSetsSection, type SetRow } from "../entreno/WorkSetsSection";

const SERIES: SetRow[] = [
  { kg: 90, reps: 2, done: true },
  { kg: 90, reps: 2, done: true },
  { kg: 90, reps: 2, done: true },
];

test("renderiza N filas de serie con kg, reps y discos", () => {
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={() => {}} />);
  expect(screen.getByText("Serie 1/3")).toBeInTheDocument();
  expect(screen.getByText("Serie 3/3")).toBeInTheDocument();
  expect(screen.getAllByText("90").length).toBeGreaterThanOrEqual(3);
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3);
});

test("modificar serie 2 → cambiar kg llama onPatchSet(1, {kg})", () => {
  const onPatchSet = vi.fn();
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={onPatchSet} />);
  fireEvent.click(screen.getByRole("button", { name: /modificar serie 2/i }));
  fireEvent.change(screen.getByLabelText(/kg serie 2/i), { target: { value: "85" } });
  expect(onPatchSet).toHaveBeenCalledWith(1, { kg: 85 });
});

test("'no la hice' en una serie llama onPatchSet(i, {done:false})", () => {
  const onPatchSet = vi.fn();
  render(<WorkSetsSection series={SERIES} barKg={15} onPatchSet={onPatchSet} />);
  fireEvent.click(screen.getByRole("button", { name: /modificar serie 3/i }));
  fireEvent.click(screen.getByRole("button", { name: /^no la hice$/i }));
  expect(onPatchSet).toHaveBeenCalledWith(2, { done: false });
});
