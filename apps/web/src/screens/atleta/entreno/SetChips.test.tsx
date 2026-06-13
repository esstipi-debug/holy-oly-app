import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { SetChips } from "./SetChips";

test("tap a un chip llama onToggle con su índice", () => {
  const onToggle = vi.fn();
  render(<SetChips series={[{ kg: 64, reps: 2, done: true }, { kg: 64, reps: 2, done: true }]} onToggle={onToggle} />);
  fireEvent.click(screen.getByRole("button", { name: /serie 2 · hecha/i }));
  expect(onToggle).toHaveBeenCalledWith(1);
});

test("el chip refleja el estado done con aria-pressed", () => {
  render(<SetChips series={[{ kg: 64, reps: 2, done: false }]} onToggle={() => {}} />);
  expect(screen.getByRole("button", { name: /serie 1 · no hecha/i })).toHaveAttribute("aria-pressed", "false");
});

test("muestra kg y reps de cada serie", () => {
  render(<SetChips series={[{ kg: 86, reps: 1, done: true }]} onToggle={() => {}} />);
  expect(screen.getByText("86")).toBeInTheDocument();
  expect(screen.getByText(/× 1/)).toBeInTheDocument();
});
