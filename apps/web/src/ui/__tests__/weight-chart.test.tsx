import { render } from "@testing-library/react";
import { WeightChart } from "../charts/WeightChart";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 12, acute: [], hrv: [], hrvBase: 70, rhr: [], rhrBase: 50, imr: [], wellness: [], recovery: [],
  bodyweight: [81.2, 81.1, 80.9, 80.8, 80.9, 80.7, 80.6, 80.5, 80.6, 80.3, 80.4, 80.8],
  weightBand: [80, 81],
};

test("renders the weight line and the category band", () => {
  const { container } = render(<WeightChart series={s} />);
  expect(container.querySelector("path")).toBeTruthy();
  expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(1); // the band
});
