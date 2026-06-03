import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { MovementPicker } from "../sessions/MovementPicker";

test("busca por término bilingüe y elige un movimiento", () => {
  const onPick = vi.fn();
  render(<MovementPicker open onClose={() => {}} onPick={onPick} />);
  fireEvent.change(screen.getByPlaceholderText(/buscar movimiento/i), { target: { value: "hang power snatch" } });
  const hit = screen.getByRole("button", { name: /Arranque de potencia colgado \(rodilla\)/i });
  fireEvent.click(hit);
  expect(onPick).toHaveBeenCalledWith("arranque.potencia.colgado.rodilla");
});
