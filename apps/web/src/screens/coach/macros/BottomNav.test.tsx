import { afterEach, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import i18n from "../../../i18n";

const navAt = (path: string) =>
  render(<MemoryRouter initialEntries={[path]}><BottomNav /></MemoryRouter>);

// i18n is a singleton across this file; restore the test default after any language switch.
afterEach(async () => { await i18n.changeLanguage("es-419"); });

test("renders the three coach tabs", () => {
  navAt("/coach");
  expect(screen.getByRole("link", { name: /atletas/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /macrociclos/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /cuenta/i })).toBeInTheDocument();
});

test("marks Macrociclos active on a macros route", () => {
  navAt("/coach/macros/ruso-5d");
  expect(screen.getByRole("link", { name: /macrociclos/i })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: /atletas/i })).not.toHaveAttribute("aria-current");
});

test("marks Atletas active on the roster and the drill-down", () => {
  navAt("/coach/a/mv");
  expect(screen.getByRole("link", { name: /atletas/i })).toHaveAttribute("aria-current", "page");
});

test("marks Cuenta active on invitaciones (folded into Cuenta)", () => {
  navAt("/coach/invitaciones");
  expect(screen.getByRole("link", { name: /cuenta/i })).toHaveAttribute("aria-current", "page");
});

test("renders the tabs translated when the language is English", async () => {
  await i18n.changeLanguage("en");
  navAt("/coach");
  expect(screen.getByRole("link", { name: /athletes/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /macrocycles/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /account/i })).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Coach navigation" })).toBeInTheDocument();
});
