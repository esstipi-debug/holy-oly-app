import { render, screen } from "@testing-library/react";
import { WellnessChart } from "../charts/WellnessChart";
import type { MonitorSeries } from "@holy-oly/core";

const s: MonitorSeries = {
  weeks: 12, acute: [], hrv: [], hrvBase: 70, rhr: [], rhrBase: 50, imr: [],
  wellness: [82, 80, 78, 83, 74, 72, 70, 80, 66, 58, 62, 70], recovery: [],
  wellnessItems: {
    Fatiga: [2, 2, 3, 2, 3, 3, 4, 2, 4, 5, 3, 2],
    Dolor: [1, 2, 2, 1, 2, 2, 3, 2, 3, 4, 2, 2],
    Estrés: [2, 2, 2, 3, 3, 3, 3, 2, 4, 4, 3, 2],
    Humor: [4, 4, 4, 4, 3, 3, 3, 4, 2, 1, 3, 4],
    Motivación: [5, 5, 4, 4, 4, 4, 3, 4, 3, 2, 4, 5],
    Sueño: [4, 4, 4, 4, 3, 3, 3, 4, 2, 1, 3, 4],
  },
};

test("renders the wellness score chart and a sparkline per item", () => {
  const { container } = render(<WellnessChart series={s} />);
  expect(container.querySelector("svg")).toBeTruthy();
  // 6 item labels
  for (const k of ["Fatiga", "Dolor", "Estrés", "Humor", "Motivación", "Sueño"]) {
    expect(screen.getByText(k)).toBeInTheDocument();
  }
});

test("WellnessChart: no muestra el número plano del ítem (HR-1)", () => {
  const solo = {
    weeks: 1, acute: [], hrv: [], hrvBase: 70, rhr: [], rhrBase: 50, imr: [],
    wellness: [80], recovery: [], wellnessItems: { Fatiga: [3] },
  } as unknown as MonitorSeries;
  render(<WellnessChart series={solo} />);
  expect(screen.getByText("Fatiga")).toBeInTheDocument();
  expect(screen.queryByText("3")).not.toBeInTheDocument();
});
