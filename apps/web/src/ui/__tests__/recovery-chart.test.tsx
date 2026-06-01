import { render } from "@testing-library/react";
import { RecoveryChart } from "../charts/RecoveryChart";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 12, acute: [],
  hrv: [72, 71, 70, 73, 69, 70, 68, 72, 67, 62, 64, 69], hrvBase: 70,
  rhr: [49, 50, 50, 48, 51, 50, 52, 49, 53, 56, 54, 50], rhrBase: 50,
  imr: [], wellness: [], recovery: [],
};

test("renders two mini line charts (hrv + rhr)", () => {
  const { container } = render(<RecoveryChart series={s} />);
  expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(2);
  expect(container.querySelector("svg")).toBeTruthy();
});
