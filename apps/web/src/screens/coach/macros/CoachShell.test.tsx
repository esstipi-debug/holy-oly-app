import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CoachShell } from "./CoachShell";

test("renders the active screen plus the bottom nav", () => {
  render(
    <MemoryRouter initialEntries={["/coach"]}>
      <Routes>
        <Route path="/coach" element={<CoachShell />}>
          <Route index element={<div>EQUIPO SENTINEL</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText("EQUIPO SENTINEL")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /macrociclos/i })).toBeInTheDocument();
});
