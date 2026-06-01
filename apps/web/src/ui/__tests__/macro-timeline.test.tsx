import { render } from "@testing-library/react";
import { MACROCYCLES } from "@holy-oly/core";
import { MacroTimeline } from "../charts/MacroTimeline";

const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;

test("renders one flag per competition", () => {
  const { container } = render(
    <MacroTimeline macro={ruso} hoy={12} comps={[{ name: "A", week: 12 }, { name: "B", week: 16 }]} />,
  );
  const flags = [...container.querySelectorAll("text")].filter((t) => t.textContent === "🚩");
  expect(flags.length).toBe(2);
});

test("derives the phase ribbon from the macro's phaseProfile", () => {
  const { container } = render(<MacroTimeline macro={ruso} hoy={12} comps={[]} />);
  const labels = [...container.querySelectorAll("text")].map((t) => t.textContent);
  for (const p of ruso.phaseProfile) expect(labels).toContain(p.name);
  // X axis = macro duration (end of the last phase), not the series length.
  expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain(String(ruso.phaseProfile.at(-1)!.weeks[1]));
});
