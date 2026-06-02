import { render, screen } from "@testing-library/react";
import { MACROCYCLES } from "@holy-oly/core";
import { MacroPeriodization } from "../charts/MacroPeriodization";

// cubano-int-5d: 3 phases, peaks:false (the screenshot's program).
const cubano = MACROCYCLES.find((m) => m.id === "cubano-int-5d")!;
// ruso-5d: 4 phases, peaks:true, peakWeek 16.
const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;

test("renders a phase-detail row with the IMR band range for every phase", () => {
  render(<MacroPeriodization macro={cubano} />);
  // The "fases en detalle" rows are the only place the full lo–hi band shows.
  for (const p of cubano.phaseProfile) {
    expect(screen.getByText(new RegExp(`IMR ${p.imrPct[0]}–${p.imrPct[1]}%`))).toBeInTheDocument();
  }
});

test("renders the phase ribbon with the mean IMR per phase", () => {
  render(<MacroPeriodization macro={cubano} />);
  // Cimentación: round((65+72)/2) = 69 — unique to the ribbon (rows show the range, not the mean).
  expect(screen.getByText(/IMR ~69%/)).toBeInTheDocument();
});

test("labels the volume bars from each phase's volRel", () => {
  const { container } = render(<MacroPeriodization macro={cubano} />);
  const texts = [...container.querySelectorAll("text")].map((t) => t.textContent);
  expect(texts).toContain("78"); // Desarrollo volRel
  expect(texts).toContain("55"); // Intensificación volRel
});

test("shows a peak marker for a peaking macrocycle", () => {
  const { container } = render(<MacroPeriodization macro={ruso} />);
  expect(container.textContent).toContain("▲");
});

test("omits the peak marker for a non-peaking macrocycle", () => {
  const { container } = render(<MacroPeriodization macro={cubano} />);
  expect(container.textContent).not.toContain("▲");
});
