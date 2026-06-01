import { render } from "@testing-library/react";
import { CompChart } from "../charts/CompChart";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 12, acute: [], hrv: [], hrvBase: 70, rhr: [], rhrBase: 50, imr: [], wellness: [], recovery: [],
  compliance: [95, 92, 98, 90, 94, 88, 96, 91, 85, 72, 90, 94],
  rpe: [7, 7, 8, 7, 8, 8, 9, 7, 9, 10, 8, 7],
};

test("renders one compliance bar per week and an rpe line", () => {
  const { container } = render(<CompChart series={s} />);
  expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(12);
  expect(container.querySelector("path")).toBeTruthy();
});
