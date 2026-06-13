import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedToggle } from "../SegmentedToggle";

const OPTS = [
  ["coach", "Coach"],
  ["atleta", "Atleta"],
] as const;

describe("SegmentedToggle", () => {
  it("renders a role=group with the aria-label and one button per option", () => {
    render(<SegmentedToggle ariaLabel="Ver como" options={OPTS} value="coach" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Ver como" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atleta" })).toBeInTheDocument();
  });

  it("marks the selected option with aria-pressed=true and the rest false", () => {
    render(<SegmentedToggle ariaLabel="Ver como" options={OPTS} value="atleta" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Atleta" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Coach" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the option value on click (typed, not the label)", () => {
    const onChange = vi.fn<(v: "coach" | "atleta") => void>();
    render(<SegmentedToggle ariaLabel="Ver como" options={OPTS} value="coach" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Atleta" }));
    expect(onChange).toHaveBeenCalledWith("atleta");
  });

  it("uses the exact var(--wl-*) tokens: active = accent on bg, inactive = transparent + muted", () => {
    render(<SegmentedToggle ariaLabel="Ver como" options={OPTS} value="coach" onChange={() => {}} />);
    const active = screen.getByRole("button", { name: "Coach" });
    const inactive = screen.getByRole("button", { name: "Atleta" });
    expect(active.style.background).toBe("var(--wl-accent)");
    expect(active.style.color).toBe("var(--wl-bg)");
    expect(inactive.style.background).toBe("transparent");
    expect(inactive.style.color).toBe("var(--wl-muted)");
    // group container uses the shared surface pill
    expect(screen.getByRole("group", { name: "Ver como" }).style.background).toBe("var(--wl-surface)");
  });

  it("size lg preserves the 44px tap target (default); size sm uses 34px", () => {
    const { rerender } = render(
      <SegmentedToggle ariaLabel="Ver como" options={OPTS} value="coach" onChange={() => {}} size="lg" />,
    );
    expect(screen.getByRole("button", { name: "Coach" }).style.minHeight).toBe("44px");
    expect(screen.getByRole("button", { name: "Coach" }).style.fontSize).toBe("13px");

    rerender(<SegmentedToggle ariaLabel="Ver como" options={OPTS} value="coach" onChange={() => {}} size="sm" />);
    expect(screen.getByRole("button", { name: "Coach" }).style.minHeight).toBe("34px");
    expect(screen.getByRole("button", { name: "Coach" }).style.fontSize).toBe("12px");
  });

  it("merges the caller's style onto the group (e.g. layout marginTop)", () => {
    render(
      <SegmentedToggle ariaLabel="Vista" options={OPTS} value="coach" onChange={() => {}} style={{ marginTop: 12 }} />,
    );
    expect(screen.getByRole("group", { name: "Vista" }).style.marginTop).toBe("12px");
  });
});
