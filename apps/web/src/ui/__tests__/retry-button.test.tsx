import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RetryButton } from "../RetryButton";

describe("RetryButton", () => {
  it("renders a button named Reintentar and fires onClick (the name tests query by)", () => {
    const onClick = vi.fn();
    render(<RetryButton onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "Reintentar" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses the accent token, underline and a transparent borderless background", () => {
    render(<RetryButton onClick={() => {}} />);
    const btn = screen.getByRole("button", { name: "Reintentar" });
    expect(btn.style.color).toBe("var(--wl-accent)");
    expect(btn.style.textDecoration).toBe("underline");
    expect(btn.style.background).toBe("transparent");
    expect(btn.style.fontFamily).toBe("var(--mono)");
  });

  it("defaults to 11px and honors an explicit fontSize (calza con el bloque de error)", () => {
    const { rerender } = render(<RetryButton onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Reintentar" }).style.fontSize).toBe("11px");
    rerender(<RetryButton onClick={() => {}} fontSize={10.5} />);
    expect(screen.getByRole("button", { name: "Reintentar" }).style.fontSize).toBe("10.5px");
  });
});
