import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PrivacidadPage, TerminosPage } from "./LegalPages";

// Guarda de COMPLETITUD legal + i18n: los documentos deben conservar las secciones obligatorias en
// AMBOS idiomas, el toggle ES/EN debe funcionar, y no debe volver el disclaimer de «borrador».
// El idioma se fuerza por localStorage (en jsdom navigator.language es "en-US").

afterEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
});

const renderPriv = (lang = "es") => { localStorage.setItem("ho:legalLang", lang); return render(<MemoryRouter><PrivacidadPage /></MemoryRouter>); };
const renderTerms = (lang = "es") => { localStorage.setItem("ho:legalLang", lang); return render(<MemoryRouter><TerminosPage /></MemoryRouter>); };

describe("Política de Privacidad — completitud (ES)", () => {
  it("incluye las secciones y compromisos obligatorios", () => {
    renderPriv("es");
    expect(screen.getByText("Política de Privacidad")).toBeInTheDocument();
    expect(screen.getByText(/Responsable del tratamiento/)).toBeInTheDocument();
    expect(screen.getByText(/Datos del ciclo menstrual \(categoría especial\)/)).toBeInTheDocument();
    expect(screen.getByText(/Transferencias internacionales/)).toBeInTheDocument();
    expect(screen.getByText(/Tus derechos según dónde estés/)).toBeInTheDocument();
    expect(screen.getByText(/Notificación de incidentes de seguridad/)).toBeInTheDocument();
    expect(screen.getByText(/No vendemos ni alquilamos tus datos/)).toBeInTheDocument();
    expect(screen.getByText(/El dato crudo nunca viaja al coach/)).toBeInTheDocument();
  });

  it("ya no muestra el disclaimer de borrador", () => {
    renderPriv("es");
    expect(screen.queryByText(/borrador/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/requiere revisión legal/i)).not.toBeInTheDocument();
  });
});

describe("Privacy Policy — completeness (EN)", () => {
  it("includes the mandatory sections and commitments", () => {
    renderPriv("en");
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByText(/Data controller/)).toBeInTheDocument();
    expect(screen.getByText(/Menstrual cycle data \(special category\)/)).toBeInTheDocument();
    expect(screen.getByText(/International transfers/)).toBeInTheDocument();
    expect(screen.getByText(/Your rights depending on where you are/)).toBeInTheDocument();
    expect(screen.getByText(/We do not sell or rent your data/)).toBeInTheDocument();
    expect(screen.getByText(/The raw data never travels to the coach/)).toBeInTheDocument();
    expect(screen.getByText(/California Privacy Protection Agency/)).toBeInTheDocument();
  });
});

describe("Términos / Terms — completitud", () => {
  it("ES: secciones obligatorias", () => {
    renderTerms("es");
    expect(screen.getByText(/Exención médica, asunción de riesgo y emergencias/)).toBeInTheDocument();
    expect(screen.getByText(/Limitación de responsabilidad/)).toBeInTheDocument();
    expect(screen.getByText(/Ley aplicable y resolución de disputas/)).toBeInTheDocument();
  });
  it("EN: mandatory sections", () => {
    renderTerms("en");
    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    expect(screen.getByText(/Medical disclaimer, assumption of risk and emergencies/)).toBeInTheDocument();
    expect(screen.getByText(/Limitation of liability/)).toBeInTheDocument();
    expect(screen.getByText(/Governing law and dispute resolution/)).toBeInTheDocument();
  });
});

describe("toggle de idioma ES/EN", () => {
  it("cambia el documento de español a inglés al pulsar EN", () => {
    renderPriv("es");
    expect(screen.getByText(/Responsable del tratamiento/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByText(/Data controller/)).toBeInTheDocument();
    expect(screen.queryByText(/Responsable del tratamiento/)).not.toBeInTheDocument();
  });
});
