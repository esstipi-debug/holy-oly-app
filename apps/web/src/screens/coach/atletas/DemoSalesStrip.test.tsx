import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { RosterRow } from "../roster";
import { ROSTER_HINTS } from "../../../data/seeds";
import { DemoSalesStrip } from "./DemoSalesStrip";

const row = (over: Partial<RosterRow> & Pick<RosterRow, "id" | "nombre" | "cell">): RosterRow =>
  ({ metodo: "", readiness: 80, trend: 0, acwr: 1, rec: 80, history: [], cat: undefined, ...over }) as RosterRow;

describe("DemoSalesStrip", () => {
  it("renders a hint + cell label for each annotated athlete", () => {
    render(<DemoSalesStrip rows={[row({ id: "ds", nombre: "Diego S.", cell: "alert" }), row({ id: "cf", nombre: "Caro F.", cell: "ok" })]} />);
    expect(screen.getByTestId("demo-sales-strip")).toBeInTheDocument();
    expect(screen.getByText("Diego S.")).toBeInTheDocument();
    expect(screen.getByText(ROSTER_HINTS.ds!)).toBeInTheDocument();
    expect(screen.getByText("Alerta")).toBeInTheDocument();
  });

  it("renders nothing when no row has a hint", () => {
    const { container } = render(<DemoSalesStrip rows={[row({ id: "zz-unknown", nombre: "X", cell: "ok" })]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
