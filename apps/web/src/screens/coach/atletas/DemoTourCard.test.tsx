import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemStorage } from "../../../test-utils/MemStorage";
import { isTourSeen } from "../../../data/demoTour";
import { DemoTourCard } from "./DemoTourCard";

describe("DemoTourCard", () => {
  it("shows the 5-step guide when unseen, and dismiss persists + hides", () => {
    const s = new MemStorage();
    const onDismiss = vi.fn();
    render(<DemoTourCard storage={s} onDismiss={onDismiss} />);
    expect(screen.getByTestId("demo-tour-card")).toBeInTheDocument();
    expect(screen.getByText(/muestras el corazón del producto/i)).toBeInTheDocument();
    expect(screen.getByText(/Toca «Atleta»/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Entendido/i }));
    expect(screen.queryByTestId("demo-tour-card")).not.toBeInTheDocument();
    expect(isTourSeen(s)).toBe(true);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders nothing when already seen", () => {
    const s = new MemStorage();
    s.setItem("ho:tourSeen", "1");
    const { container } = render(<DemoTourCard storage={s} />);
    expect(container).toBeEmptyDOMElement();
  });
});
