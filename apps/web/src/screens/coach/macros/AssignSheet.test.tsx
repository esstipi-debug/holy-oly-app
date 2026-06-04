import { render, screen, fireEvent } from "@testing-library/react";
import { MACROCYCLES, type Atleta } from "@holy-oly/core";
import { AssignSheet } from "./AssignSheet";

const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
const athletes: Atleta[] = [
  { id: "mv", nombre: "Mara V.", iniciales: "MV", nivel: "intermediate", sexo: "F", compite: true },
  { id: "ds", nombre: "Diego S.", iniciales: "DS", nivel: "intermediate", sexo: "M", compite: true },
];

function fillRms() {
  fireEvent.change(screen.getByLabelText(/arranque/i), { target: { value: "90" } });
  fireEvent.change(screen.getByLabelText(/envión/i), { target: { value: "115" } });
  fireEvent.change(screen.getByLabelText(/sentadilla/i), { target: { value: "150" } });
  fireEvent.change(screen.getByLabelText(/frente/i), { target: { value: "120" } });
}

test("submit is disabled until an athlete and valid RMs are set", () => {
  render(<AssignSheet open macro={ruso} athletes={athletes} onClose={() => {}} onAssign={vi.fn()} />);
  expect(screen.getByRole("button", { name: /asignar plan/i })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  fillRms();
  expect(screen.getByRole("button", { name: /asignar plan/i })).toBeEnabled();
});

test("builds and submits the plan from the chosen athlete, date and RMs", () => {
  const onAssign = vi.fn().mockResolvedValue(undefined);
  render(<AssignSheet open macro={ruso} athletes={athletes} onClose={() => {}} onAssign={onAssign} />);
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  fireEvent.change(screen.getByLabelText(/fecha de inicio/i), { target: { value: "2026-03-09" } });
  fillRms();
  fireEvent.click(screen.getByRole("button", { name: /asignar plan/i }));
  expect(onAssign).toHaveBeenCalledWith({
    atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-03-09",
    rms: { arranque: 90, envion: 115, sentadilla: 150, frente: 120 }, comps: [],
  });
});
