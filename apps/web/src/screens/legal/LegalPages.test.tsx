import type { ReactNode } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { PrivacidadPage, TerminosPage } from "./LegalPages";

// Guarda de COMPLETITUD legal + i18n: los documentos deben conservar las secciones obligatorias en
// AMBOS idiomas, el toggle de idioma debe funcionar, y no debe volver el disclaimer de «borrador».
// El idioma ahora lo maneja el LOCALE GLOBAL de la app (i18n), no un flag legal aparte.

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("es-419");
  });
});

const wrap = (ui: ReactNode) => (
  <I18nextProvider i18n={i18n}>
    <MemoryRouter>{ui}</MemoryRouter>
  </I18nextProvider>
);
const renderPriv = async (lang = "es-419") => {
  await i18n.changeLanguage(lang);
  const utils = render(wrap(<PrivacidadPage />));
  await act(async () => {}); // flush react-i18next's post-mount settle
  return utils;
};
const renderTerms = async (lang = "es-419") => {
  await i18n.changeLanguage(lang);
  const utils = render(wrap(<TerminosPage />));
  await act(async () => {});
  return utils;
};

describe("Política de Privacidad — completitud (ES)", () => {
  it("incluye las secciones y compromisos obligatorios", async () => {
    await renderPriv("es-419");
    expect(screen.getByText("Política de Privacidad")).toBeInTheDocument();
    expect(screen.getByText(/Responsable del tratamiento/)).toBeInTheDocument();
    expect(screen.getByText(/Datos del ciclo menstrual \(categoría especial\)/)).toBeInTheDocument();
    expect(screen.getByText(/Transferencias internacionales/)).toBeInTheDocument();
    expect(screen.getByText(/Tus derechos según dónde estés/)).toBeInTheDocument();
    expect(screen.getByText(/Notificación de incidentes de seguridad/)).toBeInTheDocument();
    expect(screen.getByText(/No vendemos ni alquilamos tus datos/)).toBeInTheDocument();
    expect(screen.getByText(/El dato crudo nunca viaja al coach/)).toBeInTheDocument();
  });

  it("ya no muestra el disclaimer de borrador", async () => {
    await renderPriv("es-419");
    expect(screen.queryByText(/borrador/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/requiere revisión legal/i)).not.toBeInTheDocument();
  });
});

describe("Privacy Policy — completeness (EN)", () => {
  it("includes the mandatory sections and commitments", async () => {
    await renderPriv("en");
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
  it("ES: secciones obligatorias", async () => {
    await renderTerms("es-419");
    expect(screen.getByText(/Exención médica, asunción de riesgo y emergencias/)).toBeInTheDocument();
    expect(screen.getByText(/Limitación de responsabilidad/)).toBeInTheDocument();
    expect(screen.getByText(/Ley aplicable y resolución de disputas/)).toBeInTheDocument();
  });
  it("EN: mandatory sections", async () => {
    await renderTerms("en");
    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    expect(screen.getByText(/Medical disclaimer, assumption of risk and emergencies/)).toBeInTheDocument();
    expect(screen.getByText(/Limitation of liability/)).toBeInTheDocument();
    expect(screen.getByText(/Governing law and dispute resolution/)).toBeInTheDocument();
  });
});

describe("toggle de idioma — ahora el locale global", () => {
  it("cambia el documento de español a inglés al pulsar EN", async () => {
    await renderPriv("es-419");
    expect(screen.getByText(/Responsable del tratamiento/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "EN" }));
    });
    expect(await screen.findByText(/Data controller/)).toBeInTheDocument();
    expect(screen.queryByText(/Responsable del tratamiento/)).not.toBeInTheDocument();
  });
});
