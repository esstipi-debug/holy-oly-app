import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

const page: CSSProperties = {
  padding: "18px 16px 48px",
  maxWidth: 640,
  margin: "0 auto",
  color: "var(--wl-text)",
  background: "var(--wl-bg)",
  minHeight: "100vh",
  fontFamily: "var(--wl-display)",
  lineHeight: 1.55,
};

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={page}>
      <Link to="/login" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>← Volver</Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "12px 0 8px" }}>{title}</h1>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginBottom: 18 }}>
        Borrador · requiere revisión legal antes de lanzamiento comercial
      </div>
      {children}
    </div>
  );
}

/** E8 — draft privacy notice (data region per ADR 2026-06-07). */
export function PrivacidadPage() {
  return (
    <LegalShell title="Privacidad">
      <p>Holy Oly procesa datos de entrenamiento, bienestar y —si lo compartís— ciclo menstrual con consentimiento explícito.</p>
      <p><strong>Ubicación de datos:</strong> la infraestructura prevista aloja la base de datos en <strong>Estados Unidos (Oregon)</strong>. Si usás la app desde Argentina u otro país, tus datos pueden transferirse internacionalmente.</p>
      <p><strong>Finalidad:</strong> coordinar macrociclos entre coach y atleta, mostrar progreso y —solo con tu consentimiento— contexto de ciclo redactado para el coach.</p>
      <p><strong>Tus derechos:</strong> podés exportar o eliminar tu cuenta desde la sección Cuenta (cuando la API esté habilitada).</p>
      <p><strong>Contacto:</strong> privacy@holyoly.dev (placeholder hasta definir entidad legal).</p>
    </LegalShell>
  );
}

/** E8 — draft terms of service. */
export function TerminosPage() {
  return (
    <LegalShell title="Términos de uso">
      <p>Holy Oly es una herramienta de coordinación deportiva entre coach y atleta. No reemplaza asesoramiento médico ni nutricional.</p>
      <p>El coach es responsable de las decisiones de programación. Los atletas son responsables de reportar su estado con honestidad.</p>
      <p>La suscripción de coach se factura por separado; los atletas no pagan por vincularse a un coach.</p>
      <p>Podemos suspender cuentas por abuso, fraude o incumplimiento de estos términos.</p>
      <p>Este texto es un borrador y debe ser revisado por asesoría legal antes del lanzamiento comercial.</p>
    </LegalShell>
  );
}
