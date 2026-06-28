import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { vi } from "vitest";
import { CheckIn } from "../CheckIn";

test("variante dial: avanza por los 6 ítems + peso y guarda (defaults 3)", async () => {
  const onDone = vi.fn().mockResolvedValue(undefined);
  render(<CheckIn variant="dial" onClose={() => {}} onDone={onDone} />);
  for (let i = 0; i < 6; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  }
  expect(screen.getByText("¿Cuánto pesas hoy?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar check-in" }));
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(onDone.mock.calls[0]![0]).toMatchObject({ fatiga: 3, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 3, weight: 80 });
  expect(await screen.findByText("¡Listo!")).toBeInTheDocument();
});

test("variante tap: tocar una carita auto-avanza al ítem siguiente", () => {
  vi.useFakeTimers();
  try {
    render(<CheckIn variant="tap" onClose={() => {}} onDone={vi.fn()} />);
    expect(screen.getByText(/¿Cuánto cansancio/)).toBeInTheDocument(); // Fatiga
    fireEvent.click(screen.getByRole("button", { name: "Fatiga 2" }));
    act(() => { vi.advanceTimersByTime(320); });
    expect(screen.getByText(/molestias o dolor/)).toBeInTheDocument(); // Dolor
  } finally {
    vi.useRealTimers();
  }
});

test("muestra el error del submit y no cierra (onDone rechaza)", async () => {
  const onDone = vi.fn().mockRejectedValue(new Error("API caída"));
  render(<CheckIn variant="dial" initial={{ date: "2026-06-03", fatiga: 3, dolor: 3, estres: 3, humor: 3, motivacion: 3, sueno: 3 }} onClose={() => {}} onDone={onDone} />);
  for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar check-in" }));
  expect(await screen.findByText(/API caída/)).toBeInTheDocument();
  expect(screen.queryByText("¡Listo!")).not.toBeInTheDocument();
});
