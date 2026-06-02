import { render, screen, fireEvent } from "@testing-library/react";
import { ChartCard, linePath } from "../charts/chartkit";

const EXPLAIN = { forma: "A ÷ B", sirve: "decidir X", lectura: "banda 0,8–1,3" };

test("linePath builds an SVG path from points", () => {
  expect(linePath([[0, 10], [10, 20], [20, 5]])).toBe("M0 10 L10 20 L20 5");
});

test("ChartCard renders its title, chip, and svg children", () => {
  const { container } = render(
    <ChartCard title="ACWR" sub="banda 0,8–1,3" chip="1.42" chipState="warn" explain={EXPLAIN}>
      <svg data-testid="kid" />
    </ChartCard>,
  );
  expect(screen.getByText("ACWR")).toBeInTheDocument();
  expect(screen.getByText("1.42")).toBeInTheDocument();
  expect(container.querySelector('[data-testid="kid"]')).toBeInTheDocument();
});

test("ChartCard: el tap en la ⓘ abre el sheet con las 3 secciones de HR-2", () => {
  render(<ChartCard title="ACWR" explain={EXPLAIN}><svg /></ChartCard>);
  expect(screen.queryByText("A ÷ B")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /cómo se lee/i }));
  expect(screen.getByText("A ÷ B")).toBeInTheDocument();
  expect(screen.getByText("decidir X")).toBeInTheDocument();
  expect(screen.getByText("banda 0,8–1,3")).toBeInTheDocument();
});
