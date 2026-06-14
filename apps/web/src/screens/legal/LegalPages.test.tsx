import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PrivacidadPage, TerminosPage } from "./LegalPages";

// Guarda de COMPLETITUD legal: los documentos deben conservar las secciones y compromisos exigidos
// por los estándares internacionales (GDPR/CCPA/AR/CL). Si un cambio futuro borra una sección
// obligatoria o reintroduce el disclaimer de "borrador", este test lo detecta.

const renderPriv = () => render(<MemoryRouter><PrivacidadPage /></MemoryRouter>);
const renderTerms = () => render(<MemoryRouter><TerminosPage /></MemoryRouter>);

describe("Política de Privacidad — completitud", () => {
  it("incluye las secciones y compromisos obligatorios", () => {
    renderPriv();
    expect(screen.getByText(/Responsable del tratamiento/)).toBeInTheDocument();
    expect(screen.getByText(/Datos del ciclo menstrual \(categoría especial\)/)).toBeInTheDocument();
    expect(screen.getByText(/Transferencias internacionales/)).toBeInTheDocument();
    expect(screen.getByText(/Tus derechos según dónde estés/)).toBeInTheDocument();
    expect(screen.getByText(/Notificación de incidentes de seguridad/)).toBeInTheDocument();
  });

  it("hace los compromisos clave de datos sensibles (no venta, no fuga del ciclo)", () => {
    renderPriv();
    expect(screen.getByText(/No vendemos ni alquilamos tus datos/)).toBeInTheDocument();
    expect(screen.getByText(/El dato crudo nunca viaja al coach/)).toBeInTheDocument();
    expect(screen.getByText(/California Privacy Protection Agency/)).toBeInTheDocument();
  });

  it("ya no muestra el disclaimer de borrador", () => {
    renderPriv();
    expect(screen.queryByText(/borrador/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/requiere revisión legal/i)).not.toBeInTheDocument();
  });
});

describe("Términos y Condiciones — completitud", () => {
  it("incluye las secciones obligatorias", () => {
    renderTerms();
    expect(screen.getByText(/Exención médica, asunción de riesgo y emergencias/)).toBeInTheDocument();
    expect(screen.getByText(/Limitación de responsabilidad/)).toBeInTheDocument();
    expect(screen.getByText(/Ley aplicable y resolución de disputas/)).toBeInTheDocument();
    expect(screen.getByText(/El Contenido del usuario es tuyo/)).toBeInTheDocument();
  });

  it("ya no muestra el disclaimer de borrador", () => {
    renderTerms();
    expect(screen.queryByText(/borrador/i)).not.toBeInTheDocument();
  });
});
