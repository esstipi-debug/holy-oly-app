import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedTabs } from "../SegmentedTabs";

const OPTS = [
  ["none", "Nada"],
  ["min", "Mínimo"],
  ["full", "Contexto"],
] as const;

describe("SegmentedTabs", () => {
  it("renders the .ho-seg group with its aria-label and one button per option", () => {
    render(<SegmentedTabs ariaLabel="Compartir con el coach" options={OPTS} value="none" onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "Compartir con el coach" });
    expect(group).toHaveClass("ho-seg");
    expect(screen.getByRole("button", { name: "Nada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contexto" })).toBeInTheDocument();
  });

  it("marks the active option with class 'on' and aria-pressed=true", () => {
    render(<SegmentedTabs ariaLabel="Compartir" options={OPTS} value="full" onChange={() => {}} />);
    const active = screen.getByRole("button", { name: "Contexto" });
    expect(active).toHaveClass("on");
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Nada" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the option value on click", () => {
    const onChange = vi.fn<(v: "none" | "min" | "full") => void>();
    render(<SegmentedTabs ariaLabel="Compartir" options={OPTS} value="none" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mínimo" }));
    expect(onChange).toHaveBeenCalledWith("min");
  });
});
