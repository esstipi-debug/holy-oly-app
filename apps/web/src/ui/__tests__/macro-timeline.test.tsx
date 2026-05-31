import { render } from "@testing-library/react";
import { MacroTimeline } from "../charts/MacroTimeline";
test("renders one flag per competition", () => {
  const { container } = render(<MacroTimeline weeks={16} hoy={12} comps={[{ name: "A", week: 12 }, { name: "B", week: 16 }]} />);
  // 2 flag labels (🚩 text nodes)
  const flags = [...container.querySelectorAll("text")].filter((t) => t.textContent === "🚩");
  expect(flags.length).toBe(2);
});
