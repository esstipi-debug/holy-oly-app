import { render, screen, fireEvent } from "@testing-library/react";
import { MACROCYCLES } from "@holy-oly/core";
import { MacroCard } from "./MacroCard";

const cubano = MACROCYCLES.find((m) => m.id === "cubano-int-5d")!;

test("renders the program's headline meta", () => {
  render(<MacroCard macro={cubano} onOpen={() => {}} />);
  expect(screen.getByText("Cubano Intermedio 5D")).toBeInTheDocument();
  expect(screen.getByText("12 semanas")).toBeInTheDocument();
  expect(screen.getByText("5d/sem")).toBeInTheDocument();
  expect(screen.getByText("Intermedio")).toBeInTheDocument(); // level label (exact, not the title)
  expect(screen.getByText("INTENSIDAD")).toBeInTheDocument(); // meters present
});

test("calls onOpen with the macro id when clicked", () => {
  const onOpen = vi.fn();
  render(<MacroCard macro={cubano} onOpen={onOpen} />);
  fireEvent.click(screen.getByRole("button"));
  expect(onOpen).toHaveBeenCalledWith("cubano-int-5d");
});
