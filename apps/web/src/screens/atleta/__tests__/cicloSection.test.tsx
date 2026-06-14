import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocalMeClient } from "../../../data/LocalMeClient";
import type { MeClient } from "../../../data/meClient";
import { MemStorage } from "../../../test-utils/MemStorage";
import { CicloSection } from "../CicloSection";

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// CicloSection enlaza a /privacidad (gate de consentimiento) → necesita un Router en el test.
const renderCiclo = (client: LocalMeClient) =>
  render(<MemoryRouter><CicloSection client={client} /></MemoryRouter>);

/** Atleta que aún NO activó el módulo (sin consentimiento) → la UI muestra el gate. */
function setup() {
  const store = new MemStorage();
  const client = new LocalMeClient("x9", store);
  renderCiclo(client);
  return client;
}

/** Atleta que YA consintió (activó) → la UI muestra el formulario de registro. */
async function setupConsented() {
  const store = new MemStorage();
  const client = new LocalMeClient("x9", store);
  await client.putMeCycle({ share: "none", state: "regular" }, true);
  renderCiclo(client);
  return client;
}

test("female-only (owner 2026-06-14): un atleta hombre no ve la sección del ciclo (ni el gate)", async () => {
  const male = { getMeCycle: async () => ({ sexo: "M", consented: false, share: "none", state: "regular" }) } as unknown as MeClient;
  const { container } = render(<MemoryRouter><CicloSection client={male} /></MemoryRouter>);
  await new Promise((r) => setTimeout(r, 0));
  expect(container.textContent).toBe("");
});

test("PR-L2 opt-in: sin activar muestra el gate de consentimiento, NO el formulario", async () => {
  setup();
  await screen.findByRole("button", { name: /activar/i });
  // Intro informativa presente; formulario de compartir ausente hasta consentir.
  expect(screen.getByText(/tu ciclo es tuyo/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Contexto" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
});

test("activar está deshabilitado hasta el reconocimiento; al activar aparece el formulario", async () => {
  setup();
  const activar = await screen.findByRole("button", { name: /activar/i });
  expect(activar).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /no reemplaza/i }));
  expect(activar).toBeEnabled();
  fireEvent.click(activar);
  await waitFor(() => expect(screen.getByRole("button", { name: "Contexto" })).toBeInTheDocument());
});

test("consentida: cambiar nivel de compartir cambia el copy de privacidad", async () => {
  await setupConsented();
  await waitFor(() => expect(screen.getByRole("button", { name: "Nada" })).toBeInTheDocument());
  expect(screen.getByText(/el coach no ve nada/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Contexto" }));
  expect(screen.getByText(/ventana lútea/i)).toBeInTheDocument();
  expect(screen.getByText(/nunca fecha, fase ni síntomas/i)).toBeInTheDocument();
});

test("consentida: guardar persiste el registro completo en el cliente", async () => {
  const client = await setupConsented();
  await waitFor(() => expect(screen.getByRole("button", { name: "Contexto" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Contexto" }));
  fireEvent.change(screen.getByLabelText(/inicio del último período/i), { target: { value: daysAgo(10) } });
  fireEvent.change(screen.getByLabelText(/duración típica/i), { target: { value: "28" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(() => expect(screen.getByRole("button", { name: /guardado/i })).toBeInTheDocument());
  expect(await client.getMeCycle()).toMatchObject({ share: "full", state: "regular", lastPeriodStart: daysAgo(10), cycleLengthDays: 28, consented: true });
});

test("consentida: duración fuera de 21..45 invalida y deshabilita guardar", async () => {
  await setupConsented();
  const len = await screen.findByLabelText(/duración típica/i);
  fireEvent.change(len, { target: { value: "50" } });
  expect(len).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
});

test("consentida: amenorrea → derivación sobria; irregular → nota de no-proyección", async () => {
  await setupConsented();
  await waitFor(() => expect(screen.getByRole("button", { name: "Sin período" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Sin período" }));
  expect(screen.getByText(/profesional de la salud/i)).toBeInTheDocument();
  expect(screen.getByText(/no es un logro deportivo/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Irregular" }));
  expect(screen.getByText(/no proyectamos ventanas/i)).toBeInTheDocument();
});

test("consentida: desactivar revoca el consentimiento y vuelve al gate", async () => {
  await setupConsented();
  await waitFor(() => expect(screen.getByRole("button", { name: "Contexto" })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /desactivar/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /activar/i })).toBeInTheDocument());
});
