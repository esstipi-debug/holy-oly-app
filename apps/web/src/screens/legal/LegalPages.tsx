import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION, LEGAL_EFFECTIVE_DATE } from "@holy-oly/core";
import { LegalShell } from "./legalUi";
import { PrivacyContent } from "./privacyContent";
import { TermsContent } from "./termsContent";

/** Política de Privacidad (grado GDPR/UK-GDPR + CCPA/CPRA + AR/CL/BR). Contenido en privacyContent.tsx. */
export function PrivacidadPage() {
  return (
    <LegalShell title="Política de Privacidad" version={LEGAL_PRIVACY_VERSION} effectiveDate={LEGAL_EFFECTIVE_DATE}>
      <PrivacyContent />
    </LegalShell>
  );
}

/** Términos y Condiciones. Contenido en termsContent.tsx. */
export function TerminosPage() {
  return (
    <LegalShell title="Términos y Condiciones" version={LEGAL_TERMS_VERSION} effectiveDate={LEGAL_EFFECTIVE_DATE}>
      <TermsContent />
    </LegalShell>
  );
}
