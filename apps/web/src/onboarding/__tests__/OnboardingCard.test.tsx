import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemStorage } from "../../test-utils/MemStorage";
import { isOnboardingSeen } from "../onboardingSeen";
import { OnboardingCard } from "../OnboardingCard";

const STEPS = ["Primer paso de prueba", "Segundo paso de prueba"];

describe("OnboardingCard", () => {
  it("shows the title and every step when unseen", () => {
    const s = new MemStorage();
    render(<OnboardingCard title="Bienvenido test" steps={STEPS} storageKey="ho:onboard:u1" storage={s} />);
    expect(screen.getByTestId("onboarding-card")).toBeInTheDocument();
    expect(screen.getByText("Bienvenido test")).toBeInTheDocument();
    expect(screen.getByText("Primer paso de prueba")).toBeInTheDocument();
    expect(screen.getByText("Segundo paso de prueba")).toBeInTheDocument();
  });

  it("renders nothing when already seen", () => {
    const s = new MemStorage();
    s.setItem("ho:onboard:u1", "1");
    const { container } = render(<OnboardingCard title="x" steps={STEPS} storageKey="ho:onboard:u1" storage={s} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dismiss persists the seen flag, fires onDismiss, and hides", () => {
    const s = new MemStorage();
    const onDismiss = vi.fn();
    render(<OnboardingCard title="x" steps={STEPS} storageKey="ho:onboard:u1" storage={s} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /Entendido/i }));
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
    expect(isOnboardingSeen(s, "ho:onboard:u1")).toBe(true);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
