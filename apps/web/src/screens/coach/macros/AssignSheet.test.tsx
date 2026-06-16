import { render, screen, fireEvent } from "@testing-library/react";
import { MACROCYCLES, anchorPlanToComp, type Atleta } from "@holy-oly/core";
import { AssignSheet } from "./AssignSheet";

const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
const TOTAL = ruso.phaseProfile[ruso.phaseProfile.length - 1]!.weeks[1];
const ANCHOR_WEEK = ruso.peaks && ruso.peakWeek != null ? ruso.peakWeek : TOTAL;
const TODAY = "2026-06-10";
const RMS = { arranque: 90, envion: 115, sentadilla: 150, frente: 120 };

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

test("default = anclar por COMPETENCIA: pide nombre+fecha y no habilita sin ellos", () => {
  render(<AssignSheet open macro={ruso} athletes={athletes} onClose={() => {}} onAssign={vi.fn()} today={TODAY} />);
  expect(screen.getByLabelText(/nombre de la competencia/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  fillRms();
  expect(screen.getByRole("button", { name: /asignar plan/i })).toBeDisabled(); // falta la compe
  fireEvent.change(screen.getByLabelText(/nombre de la competencia/i), { target: { value: "Nacional" } });
  fireEvent.change(screen.getByLabelText(/fecha de la competencia/i), { target: { value: "2026-09-19" } });
  expect(screen.getByRole("button", { name: /asignar plan/i })).toBeEnabled();
});

test("por competencia: calcula el inicio hacia atrás (pico en la semana de la compe) y crea la comp", () => {
  const onAssign = vi.fn().mockResolvedValue(undefined);
  render(<AssignSheet open macro={ruso} athletes={athletes} onClose={() => {}} onAssign={onAssign} today={TODAY} />);
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  fillRms();
  fireEvent.change(screen.getByLabelText(/nombre de la competencia/i), { target: { value: "Nacional" } });
  fireEvent.change(screen.getByLabelText(/fecha de la competencia/i), { target: { value: "2026-09-19" } });

  const expected = anchorPlanToComp("2026-09-19", ANCHOR_WEEK, TOTAL, TODAY);
  // preview honesto visible (semana ancla de la compe)
  expect(screen.getByRole("status").textContent).toMatch(new RegExp(`semana ${ANCHOR_WEEK}`));

  fireEvent.click(screen.getByRole("button", { name: /asignar plan/i }));
  expect(onAssign).toHaveBeenCalledWith(
    { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: expected.startDate, rms: RMS, comps: [] },
    { name: "Nacional", date: "2026-09-19", week: ANCHOR_WEEK },
  );
});

test("compe en el pasado → aviso honesto y submit bloqueado", () => {
  render(<AssignSheet open macro={ruso} athletes={athletes} onClose={() => {}} onAssign={vi.fn()} today={TODAY} />);
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  fillRms();
  fireEvent.change(screen.getByLabelText(/nombre de la competencia/i), { target: { value: "Vieja" } });
  fireEvent.change(screen.getByLabelText(/fecha de la competencia/i), { target: { value: "2026-06-01" } });
  expect(screen.getByText(/ya pasó/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /asignar plan/i })).toBeDisabled();
});

test("preselectAtletaId: arranca con ese atleta elegido — asigna sin re-elegir de la lista", () => {
  const onAssign = vi.fn().mockResolvedValue(undefined);
  render(<AssignSheet open macro={ruso} athletes={athletes} onClose={() => {}} onAssign={onAssign} today={TODAY} preselectAtletaId="ds" />);
  fireEvent.click(screen.getByRole("button", { name: "Fecha de inicio" }));
  fireEvent.change(screen.getByLabelText(/fecha de inicio/i), { target: { value: "2026-03-09" } });
  fillRms();
  // NO se clickea ningún atleta: Diego (ds) ya viene pre-seleccionado desde el drill-down.
  fireEvent.click(screen.getByRole("button", { name: /asignar plan/i }));
  expect(onAssign).toHaveBeenCalledWith(
    { atletaId: "ds", macroId: "ruso-5d", startWeek: 1, startDate: "2026-03-09", rms: RMS, comps: [] },
    undefined,
  );
});

test("modo «Fecha de inicio» (toggle): el flujo clásico sigue, sin comp", () => {
  const onAssign = vi.fn().mockResolvedValue(undefined);
  render(<AssignSheet open macro={ruso} athletes={athletes} onClose={() => {}} onAssign={onAssign} today={TODAY} />);
  fireEvent.click(screen.getByRole("button", { name: "Fecha de inicio" }));
  fireEvent.click(screen.getByRole("button", { name: "Mara V." }));
  fireEvent.change(screen.getByLabelText(/fecha de inicio/i), { target: { value: "2026-03-09" } });
  fillRms();
  fireEvent.click(screen.getByRole("button", { name: /asignar plan/i }));
  expect(onAssign).toHaveBeenCalledWith(
    { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: "2026-03-09", rms: RMS, comps: [] },
    undefined,
  );
});
