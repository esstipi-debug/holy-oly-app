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
