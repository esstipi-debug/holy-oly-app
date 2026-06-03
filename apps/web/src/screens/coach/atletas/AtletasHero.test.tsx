import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AtletasHero } from "./AtletasHero";
import type { RosterRow } from "../roster";

const hero: RosterRow = {
  id: "tomas", nombre: "Tomás L.", iniciales: "TL", metodo: "Polaco 5D", compite: true,
  acwr: 0.98, rec: 88, cell: "ok", readiness: 91, trend: 4, cat: "102 kg", history: ["ok", "ok", "ok"],
};

describe("AtletasHero", () => {
  it("muestra readiness grande, nombre, categoría y los 3 stats; tap → onPick", () => {
    const picks: string[] = [];
    render(<AtletasHero row={hero} onPick={(id) => picks.push(id)} />);
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("Tomás L.")).toBeInTheDocument();
    expect(screen.getByText("102 kg")).toBeInTheDocument();
    expect(screen.getByText("0.98")).toBeInTheDocument();   // ACWR
    expect(screen.getByText("88%")).toBeInTheDocument();    // RECUP
    expect(screen.getByText("+4")).toBeInTheDocument();     // RACHA
    expect(screen.getByText(/MEJOR READINESS/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(picks).toEqual(["tomas"]);
  });
});
