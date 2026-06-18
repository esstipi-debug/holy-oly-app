import { render, screen, fireEvent } from "@testing-library/react";
import { CompSheet } from "./CompSheet";

function renderSheet(onAdd = vi.fn().mockResolvedValue(undefined)) {
  render(
    <CompSheet
      open
      onClose={() => {}}
      comps={[]}
      startDate="2026-01-05" // week 1 begins Jan 5
      totalWeeks={16}
      onAdd={onAdd}
      onRemove={async () => {}}
    />,
  );
  return onAdd;
}

test("picking a date reports the derived macro week", () => {
  renderSheet();
  fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: "2026-01-19" } }); // +14 days
  expect(screen.getByText(/semana 3/i)).toBeInTheDocument();
});

test("submitting adds the competition with the chosen ISO date", () => {
  const onAdd = renderSheet();
  fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: "2026-01-19" } });
  fireEvent.change(screen.getByPlaceholderText(/COMP/), { target: { value: "Apertura" } });
  fireEvent.click(screen.getByRole("button", { name: /agregar/i }));
  expect(onAdd).toHaveBeenCalledWith("Apertura", "2026-01-19");
});

// Regresión: el input NO debe tener min/max nativos — el date picker del navegador los enforcea y
// dejaba al coach sin poder ingresar una fecha fuera de la ventana del macro (p. ej. una competencia
// posterior a la última semana). fireEvent.change ignora min/max, por eso el assert es sobre los attrs.
test("the date input has no native min/max so any competition date can be entered", () => {
  renderSheet();
  const dateInput = screen.getByLabelText(/fecha/i);
  expect(dateInput).not.toHaveAttribute("min");
  expect(dateInput).not.toHaveAttribute("max");
});

test("a date after the macro's last week is still accepted (clamped to the last week)", () => {
  const onAdd = renderSheet();
  // startDate 2026-01-05, totalWeeks 16 → last week ~Apr 20; pick well past it.
  fireEvent.change(screen.getByLabelText(/fecha/i), { target: { value: "2026-09-01" } });
  expect(screen.getByText(/semana 16/i)).toBeInTheDocument(); // clamped display
  fireEvent.click(screen.getByRole("button", { name: /agregar/i }));
  expect(onAdd).toHaveBeenCalledWith(expect.any(String), "2026-09-01");
});
