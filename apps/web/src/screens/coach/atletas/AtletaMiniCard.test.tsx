import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AtletaMiniCard } from "./AtletaMiniCard";
import type { RosterRow } from "../roster";

const row: RosterRow = {
  id: "mara", nombre: "Mara V.", iniciales: "MV", metodo: "Ruso 5D", compite: true,
  acwr: 1.62, rec: 41, cell: "alert", readiness: 28, trend: -9, cat: "64 kg",
  history: ["ok", "ok", "warn", "alert", "warn", "alert", "alert"],
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
});
