import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanDayDetail } from "./PlanDayDetail";

const base = {
  title: "Jue 11 jun · S8",
  phaseName: "Transformación",
  phaseTint: "#22b8cf",
  focus: "fuerza · pulls pesados",
  barKg: 15,
};

describe("PlanDayDetail", () => {
  it("muestra fase + objetivo, y cada ejercicio con kg + discos (DiscRow oficial)", () => {
    const { container } = render(
      <PlanDayDetail {...base} sub="Sesión 4 de 5 · tope 85%" estado="pending"
        exercises={[{ name: "Arranque", sets: 5, reps: 2, pct: 82, kg: 72 }]} />,
    );
    expect(screen.getByText("Transformación")).toBeInTheDocument();
    expect(screen.getByText(/fuerza · pulls pesados/)).toBeInTheDocument();
    expect(screen.getByText("72 kg")).toBeInTheDocument();
    // DiscRow renders IWF discs as SVGs: 72 kg con barra 15 → discos presentes
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("% aparece junto al kg, no con las series/reps", () => {
    render(
      <PlanDayDetail {...base}
        exercises={[{ name: "Arranque", sets: 5, reps: 2, pct: 82, kg: 72 }]} />,
    );
    expect(screen.getByText(/82%/)).toBeInTheDocument();
    // El pct NO va en la línea de series — "5×2" sin "@"
    expect(screen.queryByText(/5×2.*82%|82%.*5×2/)).toBeNull();
  });

  it("% aparece aunque NO haya kg (template del coach: la intensidad es el % puro)", () => {
    render(
      <PlanDayDetail {...base}
        exercises={[{ name: "Arranque", sets: 5, reps: 3, pct: 92 }]} />,
    );
    // sin atleta no hay kg → el % es la única intensidad y DEBE verse (no «—» a secas)
    expect(screen.getByText(/92%/)).toBeInTheDocument();
  });

  it("sin kg → «—» y SIN discos (jamás un 0 inventado)", () => {
    const { container } = render(
      <PlanDayDetail {...base} exercises={[{ name: "Remo", sets: 4, reps: 8 }]} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(container.querySelectorAll("svg").length).toBe(0);
  });

  it("variante competencia: banner dorado con el nombre, sin filas", () => {
    render(<PlanDayDetail {...base} compName="Nacional" exercises={[]} />);
    expect(screen.getByText(/Día de competencia — Nacional/)).toBeInTheDocument();
  });

  it("variante descanso: pedagogía de recuperación, sin filas falsas", () => {
    render(<PlanDayDetail {...base} isRest exercises={[]} />);
    expect(screen.getByText(/La recuperación es la mitad del trabajo/)).toBeInTheDocument();
  });

  it("estado del día visible (coach: marks)", () => {
    render(<PlanDayDetail {...base} estado="done" exercises={[{ name: "Arranque", sets: 3, reps: 3, pct: 70, kg: 56 }]} />);
    expect(screen.getByText("Hecha ✓")).toBeInTheDocument();
  });
});
