import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/** 404 del sistema (W5/D7): catch-all del router. Hereda el skin neon que index.html fija en
 *  <html class="wl wl--neon"> — no necesita wrapper .wl propio. */
export function NotFound() {
  const { t } = useTranslation();
  useEffect(() => {
    const prev = document.title;
    document.title = t("errorPage.docTitleNotFound");
    return () => { document.title = prev; };
  }, [t]);

  return (
    <div style={{
      minHeight: "100vh", background: "var(--wl-bg)", color: "var(--wl-text)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 10, padding: "0 24px", textAlign: "center",
    }}>
      <h1 style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 26, lineHeight: 1.15, margin: 0 }}>
        {t("errorPage.notFoundTitle")}
      </h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)", margin: 0, lineHeight: 1.6 }}>
        {t("errorPage.notFoundSub")}
      </p>
      <Link
        to="/"
        style={{
          marginTop: 10, padding: "12px 22px", borderRadius: 12, textDecoration: "none",
          background: "var(--wl-accent)", color: "var(--wl-bg)",
          fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14,
        }}
      >
        {t("backToHome")}
      </Link>
    </div>
  );
}
