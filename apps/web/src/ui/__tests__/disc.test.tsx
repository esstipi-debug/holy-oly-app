import { render } from "@testing-library/react";
import { Disc, DiscRow } from "../Disc";

test("DiscRow renders one svg per plate for 140kg (3 per side)", () => {
  const { container } = render(<DiscRow kg={140} />);
  expect(container.querySelectorAll("svg").length).toBe(3);
});

test("DiscRow default view is ¾ — el disco de los entrenamientos", () => {
  const { container } = render(<DiscRow kg={140} />);
  const svgs = [...container.querySelectorAll("svg")];
  expect(svgs.length).toBe(3);
  for (const s of svgs) expect(s.getAttribute("data-view")).toBe("3q");
});

test("DiscRow view='front' renders the adjusted flat frontal discs", () => {
  const { container } = render(<DiscRow kg={140} view="front" />);
  const svgs = [...container.querySelectorAll("svg")];
  expect(svgs.length).toBe(3);
  for (const s of svgs) expect(s.getAttribute("data-view")).toBe("front");
});

test("el 15 (amarillo) lleva número blanco en ambas vistas", () => {
  for (const view of ["front", "3q"] as const) {
    const { container } = render(<Disc w={15} view={view} />);
    const num = container.querySelector("text");
    expect(num?.textContent).toBe("15");
    expect(num?.getAttribute("fill")).toBe("#fff");
  }
});

test("DiscRow respeta la barra femenina (15 kg) con la vista ¾", () => {
  // 85 kg con barra 15 → 35 por lado → 25 + 10
  const { container } = render(<DiscRow kg={85} barKg={15} />);
  const svgs = [...container.querySelectorAll("svg")];
  expect(svgs.length).toBe(2);
  for (const s of svgs) expect(s.getAttribute("data-view")).toBe("3q");
});

test("cada peso muestra su número en blanco en la vista ¾", () => {
  for (const w of [10, 15, 20, 25] as const) {
    const { container } = render(<Disc w={w} />);
    const num = container.querySelector("text");
    expect(num?.textContent).toBe(String(w));
    expect(num?.getAttribute("fill")).toBe("#fff");
  }
});
