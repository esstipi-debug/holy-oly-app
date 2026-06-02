import { render, screen } from "@testing-library/react";
import { MACROCYCLES } from "@holy-oly/core";
import { LoadMeters } from "./LoadMeters";

const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!; // intensity 3, volume 5 → recovery 1

test("renders intensity, volume and derived-recovery meters with their values", () => {
  render(<LoadMeters macro={ruso} />);
  expect(screen.getByText("INTENSIDAD")).toBeInTheDocument();
  expect(screen.getByText("VOLUMEN")).toBeInTheDocument();
  expect(screen.getByText("RECOVERY")).toBeInTheDocument();
  expect(screen.getByText("3/5")).toBeInTheDocument(); // intensity
  expect(screen.getByText("5/5")).toBeInTheDocument(); // volume
  expect(screen.getByText("1/5")).toBeInTheDocument(); // recovery = 6 - max(3,5)
});
