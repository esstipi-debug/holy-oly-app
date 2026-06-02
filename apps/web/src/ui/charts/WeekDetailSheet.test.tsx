import { render, screen, fireEvent } from "@testing-library/react";
import { WeekDetailSheet } from "./WeekDetailSheet";
import type { WeekSignal } from "./weekSignals";

const signals: WeekSignal[] = [
  { label: "ACWR", value: "1.42", hasData: true, state: "alert" },
  { label: "Peso", value: "—", hasData: false },
];

test("WeekDetailSheet: muestra semana, fecha, señales y 'sin dato'", () => {
  render(<WeekDetailSheet open week={2} dateISO="2026-03-09" isTaper={false} signals={signals}
    perWeek={0} marks={[]} onToggle={() => {}} onClose={() => {}} />);
  expect(screen.getByText(/Semana 2/)).toBeInTheDocument();
  expect(screen.getByText("2026-03-09")).toBeInTheDocument();
  expect(screen.getByText("1.42")).toBeInTheDocument();
  expect(screen.getByText("Peso")).toBeInTheDocument();
  expect(screen.getByText("sin dato")).toBeInTheDocument();
});

test("WeekDetailSheet: una señal en banda (estado ok) va en Badge, no número pelado", () => {
  const sig: WeekSignal[] = [{ label: "ACWR", value: "1.05", hasData: true, state: "ok" }];
  render(<WeekDetailSheet open week={1} dateISO="2026-03-09" isTaper={false} signals={sig}
    perWeek={0} marks={[]} onToggle={() => {}} onClose={() => {}} />);
  // El Badge envuelve el valor con un pill (border-radius 99); el número pelado no lo tendría.
  expect(screen.getByText("1.05")).toHaveStyle({ borderRadius: "99px" });
});

test("WeekDetailSheet: el toggle de adherencia llama onToggle(week, idx)", () => {
  const calls: [number, number][] = [];
  render(<WeekDetailSheet open week={2} dateISO="2026-03-09" isTaper={false} signals={signals}
    perWeek={3} marks={[]} onToggle={(w, i) => calls.push([w, i])} onClose={() => {}} />);
  fireEvent.click(screen.getByLabelText(/sesión 1/i));
  expect(calls).toEqual([[2, 0]]);
});
