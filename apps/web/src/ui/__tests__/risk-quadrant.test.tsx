import { render, screen, fireEvent } from "@testing-library/react";
import { RiskQuadrant, type QuadPoint } from "../charts/RiskQuadrant";

const points: QuadPoint[] = [
  { id: "ds", iniciales: "DS", acwr: 1.55, rec: 54, cell: "alert" },
  { id: "mv", iniciales: "MV", acwr: 0.74, rec: 77, cell: "warn" },
];

test("plots one dot per assessed athlete and calls onPick", () => {
  const picked: string[] = [];
  const { container } = render(<RiskQuadrant points={points} noData={[]} onPick={(id) => picked.push(id)} />);
  expect(container.querySelectorAll("circle").length).toBe(2);
  fireEvent.click(screen.getByText("MV"));
  expect(picked).toEqual(["mv"]);
});

test("a risk-zone athlete (high acwr + low rec) is colored alert — dot color matches position", () => {
  const { container } = render(<RiskQuadrant points={points} noData={[]} onPick={() => {}} />);
  const dsCircle = container.querySelector('g[data-id="ds"] circle') as SVGCircleElement;
  expect(dsCircle).toBeTruthy();
  expect(dsCircle.style.fill).toContain("#ff3b46"); // STATUS.alert; not STATUS.ok
});

test("shows a 'sin datos' tray for no-data athletes (not plotted)", () => {
  render(<RiskQuadrant points={points} noData={[{ id: "tl", iniciales: "TL" }]} onPick={() => {}} />);
  expect(screen.getByText(/sin datos/i)).toBeInTheDocument();
  expect(screen.getByText(/TL/)).toBeInTheDocument();
});
