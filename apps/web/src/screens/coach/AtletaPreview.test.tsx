import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { SessionView } from "@holy-oly/core";
import { AtletaPreview, type AthletePreviewClient } from "./AtletaPreview";

const SESSION: SessionView[] = [
  {
    week: 12,
    sessionIdx: 0,
    exercises: [
      { movementId: "arranque", movementName: "Arranque", sets: 5, reps: 3, pct: 70, targetKg: 64, warmup: [] },
    ],
  },
];

const clientReturning = (s: SessionView[]): AthletePreviewClient => ({ getMeSessions: vi.fn(async () => s) });

describe("AtletaPreview", () => {
  it("renders the athlete's prescribed session with kg (discs via DiscRow)", async () => {
    render(<AtletaPreview athleteId="kv" week={12} sexo="M" client={clientReturning(SESSION)} />);
    await waitFor(() => expect(screen.getByTestId("atleta-preview")).toBeInTheDocument());
    expect(screen.getByText("Arranque")).toBeInTheDocument();
    expect(screen.getByText(/5×3 · 70%/)).toBeInTheDocument();
    expect(screen.getByText("64 kg")).toBeInTheDocument();
    expect(screen.getByText(/semana 12/)).toBeInTheDocument();
  });

  it("shows an honest empty state when there is no session", async () => {
    render(<AtletaPreview athleteId="kv" week={99} client={clientReturning([])} />);
    await waitFor(() => expect(screen.getByText(/estado vacío/)).toBeInTheDocument());
  });

  it("shows an error state when the client rejects", async () => {
    const client: AthletePreviewClient = { getMeSessions: vi.fn(async () => { throw new Error("boom"); }) };
    render(<AtletaPreview athleteId="kv" week={12} client={client} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("requests the week passed in", async () => {
    const client = clientReturning(SESSION);
    render(<AtletaPreview athleteId="kv" week={12} client={client} />);
    await waitFor(() => expect(screen.getByTestId("atleta-preview")).toBeInTheDocument());
    expect(client.getMeSessions).toHaveBeenCalledWith(12);
  });
});
