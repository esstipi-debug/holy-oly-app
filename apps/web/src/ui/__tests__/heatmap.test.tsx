import { render, screen, fireEvent } from "@testing-library/react";
import { Heatmap } from "../charts/Heatmap";
import type { RosterRow } from "../../screens/coach/roster";

const rows: RosterRow[] = [
  { id: "mv", nombre: "Mara V.", iniciales: "MV", metodo: "Ruso 5D", compite: true,
    acwr: 0.74, rec: 77, cell: "warn", readiness: 56, trend: -4, cat: "64 kg", history: ["ok","ok","warn","ok","ok","warn","ok","warn","warn","alert","warn","warn"] },
  { id: "tl", nombre: "Tomás L.", iniciales: "TL", metodo: "Polaco 5D", compite: false,
    acwr: undefined, rec: undefined, cell: "none", readiness: undefined, trend: undefined, cat: undefined, history: ["none","none","none","none","none","none","none","none","none","none","none","none"] },
];

test("renders one name cell per row and calls onPick with the athlete id", () => {
  const picked: string[] = [];
  render(<Heatmap rows={rows} weeks={12} onPick={(id) => picked.push(id)} />);
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  expect(picked).toEqual(["mv"]);
  expect(screen.getAllByRole("button")).toHaveLength(2); // one name cell per row
});

test("renders a week-number header with exactly `weeks` cells", () => {
  const { container } = render(<Heatmap rows={rows} weeks={12} onPick={() => {}} />);
  const headerCells = container.querySelectorAll('[data-testid="hm-week"]');
  expect(headerCells).toHaveLength(12);
  expect(headerCells[11]).toHaveTextContent("12");
});
