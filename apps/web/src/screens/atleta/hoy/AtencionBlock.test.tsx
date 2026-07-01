import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AtencionBlock } from "./AtencionBlock";

describe("AtencionBlock", () => {
  it("no renderiza nada sin heads-up", () => {
    const { container } = render(<AtencionBlock headsUp={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("warn: nombra el factor y la consecuencia, con acción presente", () => {
    render(<AtencionBlock headsUp={{ item: "sueno", days: 3, severity: "warn", alsoStreaking: [] }} />);
    expect(screen.getByText(/Llevás 3 días durmiendo mal/)).toBeInTheDocument();
    expect(screen.getByText(/recuperación caer/)).toBeInTheDocument();
    expect(screen.getByText(/priorizá descanso/)).toBeInTheDocument();
  });

  it("alert deriva al coach", () => {
    render(<AtencionBlock headsUp={{ item: "fatiga", days: 5, severity: "alert", alsoStreaking: [] }} />);
    expect(screen.getByText(/cuentes a tu coach/)).toBeInTheDocument();
  });

  it("dolor deriva al coach aún en warn (ítem sensible)", () => {
    render(<AtencionBlock headsUp={{ item: "dolor", days: 3, severity: "warn", alsoStreaking: [] }} />);
    expect(screen.getByText(/cuentes a tu coach/)).toBeInTheDocument();
  });
});
