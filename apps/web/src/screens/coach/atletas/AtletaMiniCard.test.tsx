import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AtletaMiniCard } from "./AtletaMiniCard";
import type { RosterRow } from "../roster";
import type { CoachRisk } from "@holy-oly/core";

const row: RosterRow = {
  id: "mara", nombre: "Mara V.", iniciales: "MV", metodo: "Ruso 5D", compite: true,
  acwr: 1.62, rec: 41, cell: "alert", readiness: 28, trend: -9, cat: "64 kg",
  history: ["ok", "ok", "warn", "alert", "warn", "alert", "alert"], needsRm: false,
  risk: null,
};

describe("AtletaMiniCard", () => {
  it("muestra nombre, iniciales y readiness; tap → onPick(id)", () => {
    const picks: string[] = [];
    render(<AtletaMiniCard row={row} onPick={(id) => picks.push(id)} />);
    expect(screen.getByText("Mara V.")).toBeInTheDocument();
    expect(screen.getByText("MV")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(picks).toEqual(["mara"]);
  });
  it("sin dato → readiness '—' (nunca un número inventado)", () => {
    const nd: RosterRow = { ...row, cell: "none", readiness: undefined, acwr: undefined, rec: undefined, trend: undefined, cat: undefined, history: ["none", "none"] };
    render(<AtletaMiniCard row={nd} onPick={() => {}} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
  it("V5: trend negativo → flecha ▼ con la magnitud del Δ", () => {
    render(<AtletaMiniCard row={{ ...row, readiness: 78, trend: -9 }} onPick={() => {}} />);
    const chip = screen.getByLabelText(/tendencia baja 9/);
    expect(chip).toHaveTextContent("▼");
    expect(chip).toHaveTextContent("9");
  });
  it("V5: trend positivo → flecha ▲ (un 78 subiendo ≠ un 78 cayendo)", () => {
    render(<AtletaMiniCard row={{ ...row, readiness: 78, trend: 6 }} onPick={() => {}} />);
    const chip = screen.getByLabelText(/tendencia sube 6/);
    expect(chip).toHaveTextContent("▲");
    expect(chip).toHaveTextContent("6");
  });
  it("V5: trend estable (0) → → sin magnitud", () => {
    render(<AtletaMiniCard row={{ ...row, readiness: 78, trend: 0 }} onPick={() => {}} />);
    expect(screen.getByLabelText(/tendencia estable 0/)).toHaveTextContent("→");
  });
  it("V5: sin trend → no pinta flecha (sin-dato honesto)", () => {
    render(<AtletaMiniCard row={{ ...row, readiness: 78, trend: undefined }} onPick={() => {}} />);
    expect(screen.queryByLabelText(/tendencia/)).not.toBeInTheDocument();
  });
  it("macro-history: needsRm → badge 'Falta RM'; con RM → sin badge", () => {
    const { rerender } = render(<AtletaMiniCard row={{ ...row, needsRm: true }} onPick={() => {}} />);
    expect(screen.getByText("Falta RM")).toBeInTheDocument();
    rerender(<AtletaMiniCard row={{ ...row, needsRm: false }} onPick={() => {}} />);
    expect(screen.queryByText("Falta RM")).toBeNull();
  });
  it("risk chip: row.risk con loadNote=sobrecarga → muestra 'Riesgo sobrecarga'", () => {
    const risk: CoachRisk = { item: "sueno", days: 4, severity: "alert", alsoStreaking: [], acwrSustained: true, readinessBand: "red", loadNote: "sobrecarga" };
    render(<AtletaMiniCard row={{ ...row, risk }} onPick={() => {}} />);
    expect(screen.getByText(/Riesgo sobrecarga/)).toBeInTheDocument();
  });
  it("risk chip: row.risk=null → no aparece ningún texto de riesgo ni ⚠ de carga", () => {
    render(<AtletaMiniCard row={{ ...row, risk: null, needsRm: false }} onPick={() => {}} />);
    expect(screen.queryByText(/Riesgo|⚠.*sobrecarga/)).toBeNull();
  });
});
