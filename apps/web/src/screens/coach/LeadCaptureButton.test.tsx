import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemStorage } from "../../test-utils/MemStorage";
import { readLeads } from "../../data/leads";
import { LeadCaptureButton } from "./LeadCaptureButton";

describe("LeadCaptureButton", () => {
  it("captures a lead: open → fill → enviar → gracias + persisted", () => {
    const s = new MemStorage();
    render(<LeadCaptureButton storage={s} now={() => "2026-06-07T12:00:00Z"} />);
    fireEvent.click(screen.getByRole("button", { name: /Me interesa para mi equipo/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: "Coach Ana" } });
    fireEvent.change(screen.getByLabelText(/WhatsApp o email/i), { target: { value: "ana@gym.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    expect(screen.getByText(/¡Gracias!/)).toBeInTheDocument();
    const leads = readLeads(s);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toEqual({ nombre: "Coach Ana", contacto: "ana@gym.com", ts: "2026-06-07T12:00:00Z" });
  });

  it("disables Enviar until both fields are filled (no empty leads)", () => {
    const s = new MemStorage();
    render(<LeadCaptureButton storage={s} />);
    fireEvent.click(screen.getByRole("button", { name: /Me interesa para mi equipo/i }));
    const enviar = screen.getByRole("button", { name: /Enviar/i }) as HTMLButtonElement;
    expect(enviar.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Nombre/i), { target: { value: "Solo nombre" } });
    expect(enviar.disabled).toBe(true); // contacto still empty
    expect(readLeads(s)).toEqual([]);
  });
});
