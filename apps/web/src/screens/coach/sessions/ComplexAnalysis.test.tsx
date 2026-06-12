import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RM } from "@holy-oly/core";
import { ComplexAnalysis } from "./ComplexAnalysis";

const RMS: RM = { arranque: 100, envion: 120, sentadilla: 150, frente: 130 };

describe("ComplexAnalysis (V3 — visibilidad de carga neural del complejo)", () => {
  it("un ejercicio cx.* muestra carga SNC/axial/metabólica, complejidad, tope % y eslabón débil", () => {
    // cx.cargada+frontal+2t: SNC 8 · axial 8 · metab 10 · complejidad 9 · tope 85% · débil=envión(120)
    render(<ComplexAnalysis movementId="cx.cargada+frontal+2t" rms={RMS} />);
    const box = screen.getByLabelText(/análisis del complejo/i);
    expect(box).toHaveTextContent("SNC");
    expect(box).toHaveTextContent("8/10");
    expect(box).toHaveTextContent("10/10"); // metabólica capada
    expect(box).toHaveTextContent("9/12");  // complejidad
    expect(box).toHaveTextContent("85%");   // tope programable
    expect(box).toHaveTextContent(/Eslabón débil/);
    expect(box).toHaveTextContent("Envión");
    expect(box).toHaveTextContent("120 kg");
  });

  it("un movimiento simple NO muestra el análisis (oculto honesto)", () => {
    const { container } = render(<ComplexAnalysis movementId="arranque" rms={RMS} />);
    expect(screen.queryByLabelText(/análisis del complejo/i)).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("sin RMs → muestra carga/complejidad/tope pero OCULTA el eslabón débil (sin kg inventado)", () => {
    render(<ComplexAnalysis movementId="cx.cargada+frontal+2t" />);
    const box = screen.getByLabelText(/análisis del complejo/i);
    expect(box).toHaveTextContent("85%");
    expect(box).not.toHaveTextContent(/Eslabón débil/);
  });

  it("un cx.* desconocido → nada (getComplex undefined, sin throw)", () => {
    const { container } = render(<ComplexAnalysis movementId="cx.no-existe" rms={RMS} />);
    expect(container).toBeEmptyDOMElement();
  });
});
