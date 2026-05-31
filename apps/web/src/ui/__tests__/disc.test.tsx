import { render } from "@testing-library/react";
import { DiscRow } from "../Disc";
test("DiscRow renders one svg per plate for 140kg (3 per side)", () => {
  const { container } = render(<DiscRow kg={140} />);
  expect(container.querySelectorAll("svg").length).toBe(3);
});
