import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MacroHistoryList } from "./MacroHistoryList";
import type { MacroHistoryView } from "@holy-oly/core";

const VIEW: MacroHistoryView = {
  cyclesDone: 2,
  avgAdherencePct: 83,
  entries: [
    { macroId: "ruso-5d", macroName: "Ruso 5D", ordinal: 2, startDate: "2025-05-12", endDate: "2025-08-31", weeks: 16, sessionsDone: 76, sessionsTotal: 80, adherencePct: 95, rmEnd: { arranque: 78, envion: 98, sentadilla: 130, frente: 105 } },
    { macroId: "ruso-5d", macroName: "Ruso 5D", ordinal: 1, startDate: "2025-01-06", endDate: "2025-04-27", weeks: 16, sessionsDone: 56, sessionsTotal: 80, adherencePct: 70, rmEnd: { arranque: 70, envion: 90, sentadilla: 120, frente: 96 } },
  ],
};

describe("MacroHistoryList", () => {
  it("shows the cycle count and average adherence in the header", () => {
    render(<MacroHistoryList view={VIEW} audience="coach" />);
    expect(screen.getByText(/2 ciclos · 83% adherencia/)).toBeInTheDocument();
  });

  it("renders each cycle with its name, sessions and adherence %", () => {
    render(<MacroHistoryList view={VIEW} audience="coach" />);
    expect(screen.getAllByText("Ruso 5D")).toHaveLength(2);
    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
    expect(screen.getByText(/76\/80 sesiones/)).toBeInTheDocument();
  });

  it("shows RM-at-close for the coach", () => {
    render(<MacroHistoryList view={VIEW} audience="coach" />);
    expect(screen.getAllByText(/RM cierre/).length).toBeGreaterThan(0);
  });

  it("NEVER shows RM to the athlete (HR-1)", () => {
    render(<MacroHistoryList view={VIEW} audience="atleta" />);
    expect(screen.queryByText(/RM cierre/)).toBeNull();
  });

  it("renders an honest empty state when there are no closed cycles", () => {
    render(<MacroHistoryList view={{ entries: [], cyclesDone: 0, avgAdherencePct: 0 }} audience="coach" />);
    expect(screen.getByText(/Sin ciclos cerrados todavía/)).toBeInTheDocument();
  });
});
