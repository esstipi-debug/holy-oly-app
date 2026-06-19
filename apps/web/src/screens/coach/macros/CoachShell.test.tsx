import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { afterEach } from "vitest";
import { AuthProvider } from "../../../auth/AuthContext";
import { CoachShell } from "./CoachShell";
import { CuentaCoach } from "./CuentaCoach";

afterEach(() => localStorage.clear());

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

test("default skin = legend; cambiarla desde Cuenta re-skinea el shell (wl--<skin>)", () => {
  const { container } = render(
    <MemoryRouter initialEntries={["/coach/cuenta"]}>
      <AuthProvider>
        <Routes>
          <Route path="/coach" element={<CoachShell />}>
            <Route path="cuenta" element={<CuentaCoach />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(container.querySelector(".wl")?.className).toContain("wl--legend"); // default
  fireEvent.click(screen.getByRole("button", { name: "Skin Plates" }));
  expect(container.querySelector(".wl")?.className).toContain("wl--plates");
  expect(container.querySelector(".wl")?.className).not.toContain("wl--legend");
});
