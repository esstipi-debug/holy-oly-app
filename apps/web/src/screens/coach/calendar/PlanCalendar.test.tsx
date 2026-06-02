import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanCalendar } from "./PlanCalendar";
import { MACROCYCLES } from "@holy-oly/core";
import type { Competencia, SessionLog } from "@holy-oly/core";

const macro = MACROCYCLES.find((m) => m.id === "coreano-5d")!;
const base = {
  macro, weeks: 12, startDate: "2026-03-02", hoyWeek: 4,
  comps: [{ name: "Nacional", week: 9 }] as Competencia[],
  marks: [] as SessionLog, perWeek: 5,
};

describe("PlanCalendar", () => {
  it("colapsado por default: muestra el header, NO las filas", () => {
    render(<PlanCalendar {...base} onWeekClick={() => {}} />);
    expect(screen.getByRole("button", { name: /calendario/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Semana 1\b/ })).not.toBeInTheDocument();
  });
  it("abrir lista una fila por semana; tap fila → onWeekClick(week)", () => {
    const picks: number[] = [];
    render(<PlanCalendar {...base} onWeekClick={(w) => picks.push(w)} />);
    fireEvent.click(screen.getByRole("button", { name: /calendario/i }));
    const semana9 = screen.getByRole("button", { name: /Semana 9\b/ });
    expect(semana9).toBeInTheDocument();
    fireEvent.click(semana9);
    expect(picks).toEqual([9]);
  });
  it("abierto: HOY y la 🚩 de la comp son visibles", () => {
    render(<PlanCalendar {...base} onWeekClick={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /calendario/i }));
    expect(screen.getByText("HOY")).toBeInTheDocument();
    expect(screen.getByText(/Nacional/)).toBeInTheDocument();
  });
});
