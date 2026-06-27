import { useEffect } from "react";
import { Link, useRouteError } from "react-router-dom";
import { useTranslation } from "react-i18next";

/** errorElement del router (W5/D7): un render/loader que revienta cae acá en vez de la pantalla
 *  de React Router en inglés. El stack va a console.error (debug), JAMÁS al usuario. */
export function AppError() {
  const error = useRouteError();
  const { t } = useTranslation();

  useEffect(() => {
    // diagnóstico deliberado del error boundary (sin stack al usuario)
    console.error("[router] error no manejado:", error);
  }, [error]);

  useEffect(() => {
    const prev = document.title;
    document.title = t("errorPage.docTitleError");
    return () => { document.title = prev; };
  }, [t]);

  return (
    <div style={{
      minHeight: "100vh", background: "var(--wl-bg)", color: "var(--wl-text)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 10, padding: "0 24px", textAlign: "center",
    }}>
      <h1 style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 26, lineHeight: 1.15, margin: 0 }}>
        {t("errorPage.crashTitle")}
      </h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)", margin: 0, lineHeight: 1.6 }}>
        {t("errorPage.crashSub")}
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "12px 22px", borderRadius: 12, border: 0, cursor: "pointer",
            background: "var(--wl-accent)", color: "var(--wl-bg)",
            fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14,
          }}
        >
          {t("errorPage.reload")}
        </button>
        <Link
          to="/"
          style={{
            padding: "12px 22px", borderRadius: 12, textDecoration: "none",
            border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)",
            background: "var(--wl-surface)", color: "var(--wl-text)",
            fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14,
          }}
        >
          {t("backToHome")}
        </Link>
      </div>
    </div>
  );
}
