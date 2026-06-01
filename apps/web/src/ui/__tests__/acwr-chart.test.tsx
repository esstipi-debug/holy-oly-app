import { render } from "@testing-library/react";
import { AcwrChart } from "../charts/AcwrChart";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 12,
  acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [], hrvBase: 70, rhr: [], rhrBase: 50, imr: [], wellness: [], recovery: [],
};

test("renders an svg with a line path and one dot per week", () => {
  const { container } = render(<AcwrChart series={s} />);
  expect(container.querySelector("svg")).toBeTruthy();
  expect(container.querySelector("path")).toBeTruthy();
  expect(container.querySelectorAll("circle").length).toBe(12);
});
