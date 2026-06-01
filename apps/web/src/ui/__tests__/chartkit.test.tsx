import { render, screen } from "@testing-library/react";
import { ChartCard, linePath } from "../charts/chartkit";

test("linePath builds an SVG path from points", () => {
  expect(linePath([[0, 10], [10, 20], [20, 5]])).toBe("M0 10 L10 20 L20 5");
});

test("ChartCard renders its title, chip, and svg children", () => {
  const { container } = render(
    <ChartCard title="ACWR" sub="banda 0,8–1,3" chip="1.42" chipState="warn">
      <svg data-testid="kid" />
    </ChartCard>,
  );
  expect(screen.getByText("ACWR")).toBeInTheDocument();
  expect(screen.getByText("1.42")).toBeInTheDocument();
  expect(container.querySelector('[data-testid="kid"]')).toBeInTheDocument();
});
