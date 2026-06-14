import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RmFaltanteBanner } from "./RmFaltanteBanner";
import type { RosterRow } from "../roster";

const row = (id: string, nombre: string, needsRm: boolean): RosterRow => ({
  id, nombre, iniciales: id.toUpperCase(), metodo: "Ruso 5D", compite: false,
  acwr: undefined, rec: undefined, cell: "none", readiness: undefined, trend: undefined,
  cat: undefined, history: [], needsRm,
});

describe("RmFaltanteBanner", () => {
  it("does not render when every athlete has RM", () => {
    const { container } = render(
      <RmFaltanteBanner rows={[row("mv", "Mara V.", false), row("ds", "Diego S.", false)]} onPick={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists only the athletes missing RM and pluralizes the count", () => {
    render(
      <RmFaltanteBanner
        rows={[row("mv", "Mara V.", false), row("np", "Nahuel P.", true), row("tl", "Tomás L.", true)]}
        onPick={() => {}}
      />,
    );
    expect(screen.getByText("2 atletas sin RM")).toBeInTheDocument();
    expect(screen.getByText(/Nahuel P\./)).toBeInTheDocument();
    expect(screen.getByText(/Tomás L\./)).toBeInTheDocument();
    expect(screen.queryByText(/Mara V\./)).toBeNull();
  });

  it("navigates to an athlete's drill-down when its chip is tapped", () => {
    const picks: string[] = [];
    render(<RmFaltanteBanner rows={[row("np", "Nahuel P.", true)]} onPick={(id) => picks.push(id)} />);
    fireEvent.click(screen.getByText(/Nahuel P\./));
    expect(picks).toEqual(["np"]);
  });
});
