import { render } from "@testing-library/react";
import { LoadChart } from "../charts/LoadChart";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 12, acute: [300, 320, 340, 300, 360, 380, 400, 320, 420, 700, 380, 340],
  hrv: [], hrvBase: 70, rhr: [], rhrBase: 50, imr: [], wellness: [], recovery: [],
};

test("renders one bar (rect) per week plus a chronic line", () => {
  const { container } = render(<LoadChart series={s} />);
  expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(12);
  expect(container.querySelector("path")).toBeTruthy();
});
