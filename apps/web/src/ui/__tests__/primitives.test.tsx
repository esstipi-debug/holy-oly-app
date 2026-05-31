import { render, screen } from "@testing-library/react";
import { Button } from "../Button";
import { Badge } from "../Badge";
test("Button renders its label", () => {
  render(<Button>Empezar</Button>);
  expect(screen.getByText("Empezar")).toBeInTheDocument();
});
test("Badge renders with tone", () => {
  render(<Badge tone="warn">Vigilar</Badge>);
  expect(screen.getByText("Vigilar")).toBeInTheDocument();
});
