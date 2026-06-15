import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Section } from "../Section";

describe("Section", () => {
  it("no colapsable: renderiza eyebrow, título, right y cuerpo, sin botón", () => {
    render(
      <Section title="Adherencia del bloque" eyebrow="hechas / con registro" right={<b>8/10</b>}>
        <p>cuerpo</p>
      </Section>,
    );
    expect(screen.getByText("Adherencia del bloque")).toBeInTheDocument();
    expect(screen.getByText("hechas / con registro")).toBeInTheDocument();
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("cuerpo")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("colapsable abierto por defecto: header es botón aria-expanded=true y el cuerpo se ve", () => {
    render(
      <Section title="RM y referencias" collapsible>
        <p>cuerpo rm</p>
      </Section>,
    );
    const btn = screen.getByRole("button", { name: /RM y referencias/ });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("cuerpo rm")).toBeInTheDocument();
  });

  it("colapsable defaultOpen=false: el cuerpo NO está montado hasta abrir (lazy)", () => {
    render(
      <Section title="Prilepin · vista previa" collapsible defaultOpen={false}>
        <p>cuerpo prilepin</p>
      </Section>,
    );
    const btn = screen.getByRole("button", { name: /Prilepin/ });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("cuerpo prilepin")).toBeNull();

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("cuerpo prilepin")).toBeInTheDocument();
  });

  it("colapsable: cerrar de nuevo desmonta el cuerpo (lazy-unmount)", () => {
    render(
      <Section title="RM" collapsible>
        <p>cuerpo rm</p>
      </Section>,
    );
    const btn = screen.getByRole("button", { name: /RM/ });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("cuerpo rm")).toBeNull();
  });

  it("colapsable abierto: aria-controls apunta al id del cuerpo", () => {
    render(
      <Section title="RM" collapsible>
        <p>cuerpo rm</p>
      </Section>,
    );
    const btn = screen.getByRole("button", { name: /RM/ });
    const id = btn.getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).not.toBeNull();
  });
});
