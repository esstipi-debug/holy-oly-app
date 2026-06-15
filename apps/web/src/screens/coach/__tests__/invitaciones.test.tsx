import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as vc from "../../../data/vinculoClient";
import { InvitacionesScreen } from "../InvitacionesScreen";

vi.mock("../../../data/vinculoClient");

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText } });
  writeText.mockClear();
  vi.mocked(vc.listVinculos).mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

function renderScreen() {
  return render(<MemoryRouter><InvitacionesScreen /></MemoryRouter>);
}

test("muestra el código + botón Copiar; copiar lo manda al portapapeles y da feedback", async () => {
  vi.mocked(vc.getInvite).mockResolvedValue({ inviteCode: "AB7K" });
  renderScreen();
  expect(await screen.findByText("AB7K")).toBeInTheDocument();
  const copyBtn = screen.getByRole("button", { name: /copiar código/i });
  fireEvent.click(copyBtn);
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("AB7K"));
  expect(await screen.findByText("¡Copiado!")).toBeInTheDocument();
});

test("sin código aún no muestra Copiar (sólo Generar)", async () => {
  vi.mocked(vc.getInvite).mockResolvedValue({ inviteCode: null });
  renderScreen();
  await screen.findByText("Generar");
  expect(screen.queryByRole("button", { name: /copiar código/i })).not.toBeInTheDocument();
});

test("traduce el error crudo del backend «coach session required» a español", async () => {
  vi.mocked(vc.getInvite).mockRejectedValue(new Error("coach session required"));
  renderScreen();
  expect(await screen.findByText(/entrar como coach/i)).toBeInTheDocument();
  // nunca el string crudo en inglés
  expect(screen.queryByText(/coach session required/)).not.toBeInTheDocument();
});
