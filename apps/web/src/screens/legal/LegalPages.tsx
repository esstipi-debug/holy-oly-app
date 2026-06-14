import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION, LEGAL_EFFECTIVE_DATE } from "@holy-oly/core";
import { LegalShell } from "./legalUi";
import { useLegalLocale } from "./useLegalLocale";
import { PrivacyContent } from "./privacyContent";
import { PrivacyContentEn } from "./privacyContent.en";
import { TermsContent } from "./termsContent";
import { TermsContentEn } from "./termsContent.en";

/**
 * Política de Privacidad (grado GDPR/UK-GDPR + CCPA/CPRA + AR/CL/BR). Bilingüe: el idioma arranca
 * automático según el navegador y se cambia con el toggle ES/EN del shell (recuerda la elección).
 */
export function PrivacidadPage() {
  const [lang, setLang] = useLegalLocale();
  const title = lang === "en" ? "Privacy Policy" : "Política de Privacidad";
  return (
    <LegalShell lang={lang} setLang={setLang} title={title} version={LEGAL_PRIVACY_VERSION} effectiveDate={LEGAL_EFFECTIVE_DATE}>
      {lang === "en" ? <PrivacyContentEn /> : <PrivacyContent />}
    </LegalShell>
  );
}

/** Términos y Condiciones. Bilingüe (ver PrivacidadPage). */
export function TerminosPage() {
  const [lang, setLang] = useLegalLocale();
  const title = lang === "en" ? "Terms of Service" : "Términos y Condiciones";
  return (
    <LegalShell lang={lang} setLang={setLang} title={title} version={LEGAL_TERMS_VERSION} effectiveDate={LEGAL_EFFECTIVE_DATE}>
      {lang === "en" ? <TermsContentEn /> : <TermsContent />}
    </LegalShell>
  );
}
