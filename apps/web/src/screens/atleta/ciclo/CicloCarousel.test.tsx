import { render, screen, fireEvent } from "@testing-library/react";
import type { MeCycleView } from "@holy-oly/core";
import type { MeClient } from "../../../data/meClient";
import { CicloCarousel } from "./CicloCarousel";

const TODAY = "2026-06-12";
const mara: MeCycleView = { sexo: "F", consented: true, share: "full", state: "regular", lastPeriodStart: "2026-05-23", cycleLengthDays: 28 };
// El ciclo es female-only (owner 2026-06-14): por defecto la stub es femenina; los tests de hombre pasan sexo:"M".
const stub = (cycle: Partial<MeCycleView>): MeClient =>
  ({ getMeCycle: async () => ({ sexo: "F", consented: true, share: "none", state: "regular", ...cycle }) }) as unknown as MeClient;

test("grafica el ciclo de Mara: encabezado «Tu ciclo», fase lútea, y cambia de formato", async () => {
  render(<CicloCarousel client={stub(mara)} today={TODAY} />);
  expect(await screen.findByText("Tu ciclo")).toBeInTheDocument();
  // formato por defecto = línea de tiempo, y la fase de HOY visible
  expect(screen.getByText("Línea de tiempo")).toBeInTheDocument();
  expect(screen.getAllByText(/lútea/i).length).toBeGreaterThan(0);
  // próximo período proyectado (20–24 jun)
  expect(screen.getByText(/20.*24 jun/i)).toBeInTheDocument();
  // cambiar de formato → anillo
  fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
  expect(screen.getByText("Anillo")).toBeInTheDocument();
  // y otra vez → tarjeta
  fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
  expect(screen.getByText("Tarjeta")).toBeInTheDocument();
});

test("ciclo NO regular → mensaje honesto, sin gráfico (sin precisión falsa)", async () => {
  render(<CicloCarousel client={stub({ share: "full", state: "unreliable" })} today={TODAY} />);
  expect(await screen.findByText(/registr[áa] tu ciclo|no.*proyect/i)).toBeInTheDocument();
  expect(screen.queryByText("Línea de tiempo")).not.toBeInTheDocument();
});

test("hideWhenEmpty (Home): sin ciclo registrado → no renderiza nada (no naggea el opt-in)", async () => {
  const { container } = render(<CicloCarousel client={stub({ share: "none", state: "regular" })} today={TODAY} hideWhenEmpty />);
  // espera a que termine la carga async y confirma que no queda «Tu ciclo» ni mensaje
  await new Promise((r) => setTimeout(r, 0));
  expect(screen.queryByText("Tu ciclo")).not.toBeInTheDocument();
  expect(screen.queryByText(/registr[áa] tu ciclo/i)).not.toBeInTheDocument();
  expect(container.textContent).toBe("");
});

test("paleta NEUTRA: jamás usa tokens de estado (semáforo)", async () => {
  const { container } = render(<CicloCarousel client={stub(mara)} today={TODAY} />);
  await screen.findByText("Tu ciclo");
  expect(container.innerHTML).not.toMatch(/--ok\b|--warn|--alert|wl-danger|--gold/);
});

test("female-only (owner 2026-06-14): un atleta hombre NUNCA ve «Tu ciclo», ni con datos cargados", async () => {
  const { container } = render(<CicloCarousel client={stub({ ...mara, sexo: "M" })} today={TODAY} />);
  await new Promise((r) => setTimeout(r, 0));
  expect(screen.queryByText("Tu ciclo")).not.toBeInTheDocument();
  expect(container.textContent).toBe("");
});
