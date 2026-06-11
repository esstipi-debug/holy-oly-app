import { render, screen, fireEvent } from "@testing-library/react";
import type { WarmupSet } from "@holy-oly/core";
import { WarmupSection } from "../entreno/WarmupSection";

const SETS: WarmupSet[] = [
  { pct: 0, kg: 15, reps: 5, label: "barra" },
  { pct: 39, kg: 45, reps: 5, label: "rampa" },
];

test("renderiza sets con kg, % y discos; valora la rampa (técnica + volumen de base)", () => {
  render(<WarmupSection sets={SETS} barKg={15} />);
  expect(screen.getByText(/técnica \+ volumen de base/i)).toBeInTheDocument();
  expect(screen.queryByText(/no cuenta/i)).not.toBeInTheDocument(); // copy desestimante prohibido (owner 06-11)
  expect(screen.getByText("Barra")).toBeInTheDocument();
  expect(screen.getByText("39%")).toBeInTheDocument();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(1); // discos
});

test("sets vacío → no renderiza nada", () => {
  const { container } = render(<WarmupSection sets={[]} barKg={20} />);
  expect(container).toBeEmptyDOMElement();
});

test("es salteable: el toggle colapsa los sets", () => {
  render(<WarmupSection sets={SETS} barKg={15} />);
  expect(screen.getByText("Barra")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /calentamiento/i }));
  expect(screen.queryByText("Barra")).not.toBeInTheDocument();
});
