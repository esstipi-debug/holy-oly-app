import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION, LEGAL_EFFECTIVE_DATE } from "@holy-oly/core";
import { LegalShell } from "./legalUi";
import { useLegalLang } from "../../i18n/useLocale";
import { PrivacyContent } from "./privacyContent";
import { PrivacyContentEn } from "./privacyContent.en";
import { TermsContent } from "./termsContent";
import { TermsContentEn } from "./termsContent.en";

/**
 * Política de Privacidad (grado GDPR/UK-GDPR + CCPA/CPRA + AR/CL/BR). Bilingüe: el idioma sigue al
 * LOCALE GLOBAL de la app (arranca automático según el navegador y se cambia con el toggle global,
 * que recuerda la elección). La prosa larga vive en `privacyContent[.en].tsx`.
 */
export function PrivacidadPage() {
  const legalLang = useLegalLang();
  const title = legalLang === "en" ? "Privacy Policy" : "Política de Privacidad";
  return (
    <LegalShell title={title} version={LEGAL_PRIVACY_VERSION} effectiveDate={LEGAL_EFFECTIVE_DATE}>
      {legalLang === "en" ? <PrivacyContentEn /> : <PrivacyContent />}
    </LegalShell>
  );
}

/** Términos y Condiciones. Bilingüe, sigue el locale global (ver PrivacidadPage). */
export function TerminosPage() {
  const legalLang = useLegalLang();
  const title = legalLang === "en" ? "Terms of Service" : "Términos y Condiciones";
  return (
    <LegalShell title={title} version={LEGAL_TERMS_VERSION} effectiveDate={LEGAL_EFFECTIVE_DATE}>
      {legalLang === "en" ? <TermsContentEn /> : <TermsContent />}
    </LegalShell>
  );
}
