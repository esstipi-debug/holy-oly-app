import { render } from "@testing-library/react";
import { Medal } from "../Medal";
test("Medal renders an svg for each metal", () => {
  for (const k of ["oro", "plata", "bronce"] as const) {
    const { container } = render(<Medal metal={k} size={40} />);
    expect(container.querySelector("svg")).toBeTruthy();
  }
});
