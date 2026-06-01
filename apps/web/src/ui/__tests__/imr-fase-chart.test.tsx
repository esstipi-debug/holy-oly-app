import { render } from "@testing-library/react";
import { ImrFaseChart } from "../charts/ImrFaseChart";
import { MACROCYCLES, type MonitorSeries } from "@holy-oly/core";

const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
const s: MonitorSeries = {
  weeks: 12, acute: [], hrv: [], hrvBase: 70, rhr: [], rhrBase: 50,
  imr: [66, 68, 70, 69, 76, 78, 80, 79, 86, 93, 88, 89], wellness: [], recovery: [],
};

test("renders the imr line, one phase band per macro phase, and per-week dots", () => {
  const { container } = render(<ImrFaseChart series={s} macro={ruso} />);
  expect(container.querySelector("path")).toBeTruthy();
  expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(ruso.phaseProfile.length);
  expect(container.querySelectorAll("circle").length).toBe(12);
});
