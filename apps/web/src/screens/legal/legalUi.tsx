import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { LanguageToggle } from "../../i18n/LanguageToggle";

/**
 * Presentación compartida de los documentos legales (Privacidad / Términos). El CONTENIDO vive en
 * `privacyContent.tsx` / `termsContent.tsx`; acá sólo el shell + primitivos de maquetado, para que
 * el texto legal sea legible, navegable y «print-friendly» (útil en due-diligence y capturas).
 */

/** Contacto operativo del responsable. Stopgap hasta el dominio/casilla propios (ver plan go-live). */
export const LEGAL_CONTACT_EMAIL = "esstipi@gmail.com";

const page: CSSProperties = {
  padding: "20px 18px 72px",
  maxWidth: 760,
  margin: "0 auto",
  color: "var(--wl-text)",
  background: "var(--wl-bg)",
  minHeight: "100vh",
  fontFamily: "var(--wl-display)",
  lineHeight: 1.62,
};
const h2: CSSProperties = { fontSize: 16, fontWeight: 800, margin: "30px 0 6px", scrollMarginTop: 16 };
const h3: CSSProperties = { fontSize: 13.5, fontWeight: 800, margin: "16px 0 4px", color: "var(--wl-text)" };
const pStyle: CSSProperties = { margin: "8px 0", fontSize: 14 };
const ulStyle: CSSProperties = { margin: "8px 0", paddingLeft: 20, fontSize: 14, display: "grid", gap: 5 };
const muted: CSSProperties = { fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" };

export function P({ children }: { children: ReactNode }) {
  return <p style={pStyle}>{children}</p>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul style={ulStyle}>
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

/** Subtítulo dentro de una sección (h3). */
export function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 style={h3}>{title}</h3>
      {children}
    </>
  );
}

/** Sección numerada (h2) — la numeración facilita la navegación y las referencias cruzadas. */
export function Section({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 id={id} style={h2}>{n}. {title}</h2>
      {children}
    </section>
  );
}

/** Aviso destacado (p. ej. exención médica, dato sensible). Borde sobrio, sin color de estado. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <div style={{ ...pStyle, padding: "10px 12px", borderRadius: "var(--wl-radius)", border: "1px solid color-mix(in srgb,var(--wl-text) 22%,transparent)", background: "color-mix(in srgb,var(--wl-text) 4%,transparent)" }}>
      {children}
    </div>
  );
}

/** Lista de definiciones (término → significado). */
export function Defs({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl style={{ margin: "8px 0", fontSize: 14, display: "grid", gap: 6 }}>
      {items.map(([term, def], i) => (
        <div key={i}>
          <dt style={{ fontWeight: 800, display: "inline" }}>{term}: </dt>
          <dd style={{ display: "inline", margin: 0 }}>{def}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Tabla simple (categorías de datos, subprocesadores, derechos por región). */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const cell: CSSProperties = { border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", padding: "7px 9px", fontSize: 12.5, verticalAlign: "top", textAlign: "left" };
  return (
    <div style={{ overflowX: "auto", margin: "10px 0" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} style={{ ...cell, fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--wl-muted)", background: "color-mix(in srgb,var(--wl-text) 5%,transparent)" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={cell}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

/** Enlace al correo de contacto del responsable. */
export function Contact() {
  return <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
}

/** Resumen «de un vistazo» (aviso por capas, recomendado por las autoridades de la UE). */
export function Summary({ title = "En resumen", items }: { title?: string; items: ReactNode[] }) {
  return (
    <div style={{ margin: "14px 0 8px", padding: "12px 14px", borderRadius: "var(--wl-radius)", border: "1px solid color-mix(in srgb,var(--wl-accent) 40%,transparent)", background: "color-mix(in srgb,var(--wl-accent) 8%,transparent)" }}>
      <div style={{ ...muted, marginBottom: 6, color: "var(--wl-text)", fontWeight: 700 }}>{title}</div>
      <ul style={{ ...ulStyle, margin: 0 }}>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  );
}

/** Marco del documento: volver + selector de idioma + título + metadatos + cuerpo. El chrome (volver,
 *  metadatos, footer) vive en el ns i18n `legal` y sigue el locale global; la PROSA larga conserva su
 *  propio mecanismo ES/EN (privacyContent[.en]) vía useLegalLang. pt-BR muestra la prosa ES por ahora
 *  (legal PT-BR pendiente), así que su chrome también es ES — consistente con lo que ve el usuario. */
export function LegalShell({ title, version, effectiveDate, children }: { title: string; version: string; effectiveDate: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useTranslation("legal");
  // Volver = de dónde viniste (legal se linkea desde login, Cuenta coach y Cuenta atleta);
  // sin historial (deep-link) → a la raíz, que despacha por rol.
  const onBack = (): void => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };
  return (
    <div style={page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button type="button" onClick={onBack}
          style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", ...muted }}>
          {t("back")}
        </button>
        <div style={{ width: 116, flex: "0 0 auto" }}>
          <LanguageToggle />
        </div>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "12px 0 4px", letterSpacing: "-.01em" }}>{title}</h1>
      <div style={{ ...muted, marginBottom: 14 }}>{t("meta", { version, date: effectiveDate })}</div>
      {children}
      <div style={{ ...muted, marginTop: 28, paddingTop: 12, borderTop: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)" }}>
        <Trans t={t} i18nKey="footer" components={{ contact: <Contact /> }} />
      </div>
    </div>
  );
}
