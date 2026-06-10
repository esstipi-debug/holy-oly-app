import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LocalMeClient } from "../../../data/LocalMeClient";
import { MemStorage } from "../../../test-utils/MemStorage";
import { CicloSection } from "../CicloSection";

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function setup() {
  const store = new MemStorage();
  const client = new LocalMeClient("x9", store);
  render(<CicloSection client={client} />);
  return client;
}

test("default sin registro: share Nada con su copy de privacidad; cambiar nivel cambia el copy", async () => {
  setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Nada" })).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Nada" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/el coach no ve nada/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Contexto" }));
  expect(screen.getByText(/ventana lútea/i)).toBeInTheDocument();
  expect(screen.getByText(/nunca fecha, fase ni síntomas/i)).toBeInTheDocument();
});

test("guardar persiste el registro completo en el cliente", async () => {
  const client = setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Contexto" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Contexto" }));
  fireEvent.change(screen.getByLabelText(/inicio del último período/i), { target: { value: daysAgo(10) } });
  fireEvent.change(screen.getByLabelText(/duración típica/i), { target: { value: "28" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(() => expect(screen.getByRole("button", { name: /guardado/i })).toBeInTheDocument());
  expect(await client.getMeCycle()).toEqual({ share: "full", state: "regular", lastPeriodStart: daysAgo(10), cycleLengthDays: 28 });
});

test("duración fuera de 21..45 invalida y deshabilita guardar", async () => {
  setup();
  const len = await screen.findByLabelText(/duración típica/i);
  fireEvent.change(len, { target: { value: "50" } });
  expect(len).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
});

test("amenorrea → derivación sobria; irregular → nota de no-proyección", async () => {
  setup();
  await waitFor(() => expect(screen.getByRole("button", { name: "Sin período" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Sin período" }));
  expect(screen.getByText(/profesional de la salud/i)).toBeInTheDocument();
  expect(screen.getByText(/no es un logro deportivo/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Irregular" }));
  expect(screen.getByText(/no proyectamos ventanas/i)).toBeInTheDocument();
});
