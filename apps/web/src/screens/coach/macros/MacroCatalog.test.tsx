import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MACROCYCLES } from "@holy-oly/core";
import { MacroCatalog } from "./MacroCatalog";

const renderCatalog = () => render(<MemoryRouter><MacroCatalog /></MemoryRouter>);

test("lists the whole catalog by default", () => {
  renderCatalog();
  expect(screen.getByText(new RegExp(`${MACROCYCLES.length}\\s+macrociclos`, "i"))).toBeInTheDocument();
  expect(screen.getByText("Ruso 5D")).toBeInTheDocument();
});

test("filtering by family narrows the grid", () => {
  renderCatalog();
  fireEvent.click(screen.getByRole("button", { name: "Ruso" }));
  expect(screen.getByText("Ruso 5D")).toBeInTheDocument();
  expect(screen.queryByText("Cubano Intermedio 5D")).not.toBeInTheDocument();
});

test("text search filters by name", () => {
  renderCatalog();
  fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "ruso" } });
  expect(screen.getByText("Ruso 5D")).toBeInTheDocument();
  expect(screen.queryByText("Cubano Intermedio 5D")).not.toBeInTheDocument();
});

test("shows an empty state when nothing matches", () => {
  renderCatalog();
  fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "zzzz" } });
  expect(screen.getByText(/ning[uú]n programa/i)).toBeInTheDocument();
});
