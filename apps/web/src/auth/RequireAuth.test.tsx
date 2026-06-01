import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { RequireAuth } from "./RequireAuth";

// VITE_API_URL is unset in the test env → apiEnabled=false → the guard is a pass-through
// (standalone localStorage mode). The API-gated path is covered by the browser e2e (Fase 6).
describe("RequireAuth (standalone, no API)", () => {
  it("renders children when the API is disabled", () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <RequireAuth role="coach"><div>PROTECTED</div></RequireAuth>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("PROTECTED")).toBeInTheDocument();
  });
});
