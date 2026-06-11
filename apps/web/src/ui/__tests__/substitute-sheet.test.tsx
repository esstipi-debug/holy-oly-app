import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { SubstituteSheet } from "../SubstituteSheet";

// simplerVariants("arranque") returns 13 variants (complexity < 9), sorted desc.
// The highest-complexity simpler variant (complexity 8) is "arranque.colgado.bajo"
// (full snatch from hang below knee: 9 - 2 + 1 = 8).
// substitutesOf("arranque") → canonical of tiron-arranque + sentadilla-overhead.

test("ofrece bajar-complejidad + sustituir y elige uno", () => {
  const onPick = vi.fn();
  render(
    <SubstituteSheet
      open
      movementId="arranque"
      onClose={() => {}}
      onPick={onPick}
    />,
  );
  expect(screen.getByText(/Bajar complejidad/i)).toBeInTheDocument();
  expect(screen.getByText(/Sustituir/i)).toBeInTheDocument();
  // simplerVariants("arranque")[0] = arranque.colgado.bajo, name = "Arranque desde colgado (bajo)"
  const opt = screen.getByRole("button", { name: /Arranque desde colgado \(bajo\)/i });
  fireEvent.click(opt);
  expect(onPick).toHaveBeenCalledWith("arranque.colgado.bajo");
});

test("llama onClose al elegir una opción", () => {
  const onClose = vi.fn();
  const onPick = vi.fn();
  render(
    <SubstituteSheet
      open
      movementId="arranque"
      onClose={onClose}
      onPick={onPick}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Arranque desde colgado \(bajo\)/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("muestra el nombre del movimiento actual", () => {
  render(
    <SubstituteSheet
      open
      movementId="arranque"
      onClose={() => {}}
      onPick={() => {}}
    />,
  );
  expect(screen.getByText(/Actual.*Arranque/i)).toBeInTheDocument();
});

test("muestra sustitutos de arranque (tirón y sentadilla overhead)", () => {
  render(
    <SubstituteSheet
      open
      movementId="arranque"
      onClose={() => {}}
      onPick={() => {}}
    />,
  );
  // substitutesOf("arranque") → tiron-arranque + sentadilla-overhead
  expect(
    screen.getByRole("button", { name: /Tirón de arranque/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Sentadilla de arranque/i }),
  ).toBeInTheDocument();
});
