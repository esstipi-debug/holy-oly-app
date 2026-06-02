import { render, screen, fireEvent } from "@testing-library/react";
import { SessionAdherence } from "./SessionAdherence";

test("renders a row per week with the planned number of session cells", () => {
  render(<SessionAdherence marks={[]} weeks={3} perWeek={5} onToggle={() => {}} />);
  expect(screen.getAllByRole("button").length).toBe(15); // 3 weeks × 5 sessions
  expect(screen.getByText("Sem 1")).toBeInTheDocument();
  expect(screen.getByText("Sem 3")).toBeInTheDocument();
});

test("shows the done/planned count and reports the tapped session", () => {
  const onToggle = vi.fn();
  render(<SessionAdherence marks={[{ week: 1, idx: 0, status: "done" }]} weeks={1} perWeek={3} onToggle={onToggle} />);
  expect(screen.getByText("1/3")).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button")[1]!); // week 1, session idx 1
  expect(onToggle).toHaveBeenCalledWith(1, 1);
});

test("explains when the plan defines no weekly sessions", () => {
  render(<SessionAdherence marks={[]} weeks={4} perWeek={0} onToggle={() => {}} />);
  expect(screen.queryAllByRole("button").length).toBe(0);
  expect(screen.getByText(/no define sesiones/i)).toBeInTheDocument();
});
