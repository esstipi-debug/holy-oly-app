import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Loading } from "../Loading";

describe("Loading", () => {
  it("renders a role=status busy region with the muted default message", () => {
    render(<Loading />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-busy", "true");
    expect(el).toHaveTextContent("Cargando…");
    expect(el.style.color).toBe("var(--wl-muted)");
  });

  it("uses the given message and merges the caller's layout style", () => {
    render(<Loading style={{ padding: 24, fontFamily: "var(--mono)" }}>Cargando tu progreso…</Loading>);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("Cargando tu progreso…");
    expect(el.style.padding).toBe("24px");
    expect(el.style.fontFamily).toBe("var(--mono)");
  });
});
