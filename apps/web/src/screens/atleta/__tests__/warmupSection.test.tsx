import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import type { WarmupSet } from "@holy-oly/core";
import { WarmupSection } from "../entreno/WarmupSection";

const SETS: WarmupSet[] = [
  { pct: 0, kg: 15, reps: 5, label: "barra" },
  { pct: 39, kg: 45, reps: 5, label: "rampa" },
];

test("renderiza sets con kg, % y discos; copy valora la base (técnica + volumen de base)", () => {
  render(<WarmupSection sets={SETS} barKg={15} doneSet={new Set()} onToggle={() => {}} />);
  expect(screen.getByText(/técnica \+ volumen de base/i)).toBeInTheDocument();
  expect(screen.queryByText(/no cuenta/i)).not.toBeInTheDocument(); // copy desestimante prohibido (owner 06-11)
  expect(screen.getByText("Barra")).toBeInTheDocument();
  expect(screen.getByText("39%")).toBeInTheDocument();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(1); // discos
});

test("sets vacío → no renderiza nada", () => {
  const { container } = render(<WarmupSection sets={[]} barKg={20} doneSet={new Set()} onToggle={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test("controlado: tocar una serie llama onToggle(i)", () => {
  const onToggle = vi.fn();
  render(<WarmupSection sets={SETS} barKg={15} doneSet={new Set()} onToggle={onToggle} />);
  fireEvent.click(screen.getByRole("button", { name: /calentamiento 39% 45 kilos/i }));
  expect(onToggle).toHaveBeenCalledWith(1);
});

test("muestra el progreso del calentamiento (doneSet)", () => {
  render(<WarmupSection sets={SETS} barKg={15} doneSet={new Set([0])} onToggle={() => {}} />);
  expect(screen.getByText("1/2")).toBeInTheDocument();
});

test("es colapsable: el toggle del head esconde los sets", () => {
  render(<WarmupSection sets={SETS} barKg={15} doneSet={new Set()} onToggle={() => {}} />);
  expect(screen.getByText("Barra")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /calentamiento · técnica/i }));
  expect(screen.queryByText("Barra")).not.toBeInTheDocument();
});
