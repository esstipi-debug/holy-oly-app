import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { FechaSheet } from "../entreno/FechaSheet";

const noop = () => {};
const base = { open: true, hoy: "2026-06-12", ocupadas: [], onClose: noop };

test("ofrece Hoy/Ayer y dispara onPick con la fecha elegida", () => {
  const onPick = vi.fn();
  render(<FechaSheet {...base} motivo="conflicto" onPick={onPick} />);
  expect(screen.getByText(/ya registraste un entreno/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /ayer/i }));
  expect(onPick).toHaveBeenCalledWith("2026-06-11");
});

test("fecha ocupada elegida a mano → lo dice y NO deja confirmar", () => {
  const onPick = vi.fn();
  render(<FechaSheet {...base} motivo="editar" ocupadas={["2026-06-10"]} onPick={onPick} />);
  fireEvent.change(screen.getByLabelText(/elegir fecha/i), { target: { value: "2026-06-10" } });
  expect(screen.getByText(/esa fecha ya tiene un entreno/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /usar esta fecha/i }));
  expect(onPick).not.toHaveBeenCalled();
});

test("aviso suave fuera de la semana del plan — informa, no bloquea (D2)", () => {
  const onPick = vi.fn();
  render(<FechaSheet {...base} motivo="editar" fueraDeSemana={(f) => f === "2026-05-01"} onPick={onPick} />);
  fireEvent.change(screen.getByLabelText(/elegir fecha/i), { target: { value: "2026-05-01" } });
  expect(screen.getByText(/fuera de la semana del plan/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /usar esta fecha/i }));
  expect(onPick).toHaveBeenCalledWith("2026-05-01");
});
