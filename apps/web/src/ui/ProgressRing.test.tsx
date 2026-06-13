import { render, screen } from "@testing-library/react";
import { ProgressRing } from "./ProgressRing";

test("muestra el valor central + etiqueta y dibuja pista + progreso (2 círculos)", () => {
  const { container } = render(<ProgressRing frac={0.5} big="2/3" small="ejercicios" />);
  expect(screen.getByText("2/3")).toBeInTheDocument();
  expect(screen.getByText("ejercicios")).toBeInTheDocument();
  expect(container.querySelectorAll("circle").length).toBe(2);
});

test("clampa frac a [0,1] → el arco de progreso nunca tiene offset negativo", () => {
  const { container } = render(<ProgressRing frac={1.6} big="5/3" />);
  const prog = container.querySelectorAll("circle")[1] as SVGCircleElement;
  const offset = Number(prog.style.strokeDashoffset);
  expect(offset).toBeGreaterThanOrEqual(0); // frac clampeado a 1 → offset 0
});
