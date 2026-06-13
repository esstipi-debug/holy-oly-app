import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION, LEGAL_EFFECTIVE_DATE } from "@holy-oly/core";

// Contacto operativo (stopgap hasta registrar el dominio/entidad legal — ver plan go-live).
const CONTACT_EMAIL = "esstipi@gmail.com";

const page: CSSProperties = {
  padding: "18px 16px 64px",
  maxWidth: 680,
  margin: "0 auto",
  color: "var(--wl-text)",
  background: "var(--wl-bg)",
  minHeight: "100vh",
  fontFamily: "var(--wl-display)",
  lineHeight: 1.6,
};
const h2: CSSProperties = { fontSize: 15, fontWeight: 800, margin: "26px 0 6px", letterSpacing: ".01em" };
const p: CSSProperties = { margin: "8px 0", fontSize: 14 };
const ul: CSSProperties = { margin: "8px 0", paddingLeft: 20, fontSize: 14, display: "grid", gap: 4 };
const muted: CSSProperties = { fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" };

function LegalShell({ title, version, children }: { title: string; version: string; children: ReactNode }) {
  const navigate = useNavigate();
  // Volver = de dónde viniste (legal se linkea desde login, Cuenta coach y Cuenta atleta);
  // sin historial (deep-link) → a la raíz, que despacha por rol.
  const onBack = (): void => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };
  return (
    <div style={page}>
      <button type="button" onClick={onBack}
        style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", ...muted }}>
        ← Volver
      </button>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "12px 0 4px" }}>{title}</h1>
      <div style={{ ...muted, marginBottom: 6 }}>Versión {version} · vigente desde {LEGAL_EFFECTIVE_DATE}</div>
      <div style={{ ...muted, marginBottom: 18, padding: "8px 10px", borderRadius: "var(--wl-radius)", border: "1px dashed color-mix(in srgb,var(--wl-text) 24%,transparent)" }}>
        Documento en revisión legal antes del lanzamiento comercial. Durante la fase de prueba,
        este texto describe con honestidad cómo tratamos tus datos.
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

/** Política de privacidad — v1 (beta legal). Refleja lo que la app realmente hace hoy. */
export function PrivacidadPage() {
  return (
    <LegalShell title="Política de privacidad" version={LEGAL_PRIVACY_VERSION}>
      <p style={p}>
        Holy Oly es una herramienta para coordinar el entrenamiento entre un coach y sus atletas.
        Esta política explica qué datos tratamos, con qué fin, dónde se alojan y qué derechos tenés.
      </p>

      <Section title="1. Responsable">
        <p style={p}>
          El responsable del tratamiento es el equipo de Holy Oly. Para cualquier consulta sobre tus
          datos o esta política, escribinos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="2. Qué datos tratamos">
        <ul style={ul}>
          <li><b>Cuenta:</b> email y contraseña (cifrada), o tu identidad de Google si entrás con OAuth.</li>
          <li><b>Entrenamiento:</b> tu plan, series, kilos, asistencia y registro de sesiones.</li>
          <li><b>Bienestar (check-in):</b> fatiga, dolor, estrés, ánimo, motivación, sueño y peso, si los cargás.</li>
          <li><b>Ciclo menstrual (opt-in):</b> sólo si lo activás explícitamente — ver la sección 8.</li>
          <li><b>Facturación (coach):</b> datos de la suscripción gestionada por el proveedor de pagos.</li>
        </ul>
      </Section>

      <Section title="3. Finalidad y base legal">
        <p style={p}>
          Tratamos tus datos para prestarte el servicio: coordinar el plan entre coach y atleta, mostrar
          tu progreso y —sólo con tu consentimiento— dar al coach un contexto redactado de tu ciclo. La
          base legal es la ejecución del servicio que solicitás y, para los datos sensibles (ciclo), tu
          consentimiento explícito, que podés revocar en cualquier momento.
        </p>
      </Section>

      <Section title="4. Ubicación y transferencia internacional">
        <p style={p}>
          La infraestructura aloja la base de datos en <b>Estados Unidos (Oregón)</b>. Si usás la app
          desde Argentina u otro país, tus datos se transfieren y procesan internacionalmente. Al crear
          tu cuenta aceptás esta transferencia, necesaria para prestarte el servicio.
        </p>
      </Section>

      <Section title="5. Con quién los compartimos (subprocesadores)">
        <ul style={ul}>
          <li><b>Render</b> (hosting y base de datos, EE.UU.).</li>
          <li><b>Google</b> (envío de emails transaccionales y, si lo usás, inicio de sesión con Google).</li>
          <li><b>Mercado Pago</b> (cobro de la suscripción del coach, cuando corresponde).</li>
        </ul>
        <p style={p}>No vendemos tus datos ni los usamos para publicidad de terceros.</p>
      </Section>

      <Section title="6. Conservación">
        <p style={p}>
          Conservamos tus datos mientras tu cuenta esté activa. Si eliminás tu cuenta, borramos tus datos
          asociados (incluido el registro del ciclo) de forma permanente, salvo lo que debamos retener por
          obligación legal o de seguridad (por ejemplo, registros mínimos de auditoría sin datos de salud).
        </p>
      </Section>

      <Section title="7. Tus derechos">
        <ul style={ul}>
          <li><b>Acceso y portabilidad:</b> descargá todos tus datos en formato JSON desde Cuenta → «Tus datos».</li>
          <li><b>Supresión:</b> eliminá tu cuenta y todos tus datos desde Cuenta → «Tus datos».</li>
          <li><b>Rectificación:</b> editá tu información desde la app.</li>
          <li><b>Revocación del consentimiento:</b> desactivá el registro del ciclo cuando quieras (sección 8).</li>
          <li><b>Oposición y reclamos:</b> escribinos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</li>
        </ul>
      </Section>

      <Section title="8. Datos del ciclo menstrual (opt-in)">
        <p style={p}>
          El registro del ciclo es <b>opcional y por elección</b>: el módulo no se activa por tu género ni
          por defecto. Recién aparece cuando entrás a «Ciclo» en tu Cuenta y lo activás dando tu
          consentimiento informado.
        </p>
        <ul style={ul}>
          <li>Vos decidís qué compartir con tu coach: <b>nada</b>, <b>mínimo</b> (que registrás) o <b>contexto</b>.</li>
          <li>El coach <b>nunca</b> ve tu fecha, fase ni síntomas: sólo recibe una proyección <b>redactada</b> calculada en el servidor.</li>
          <li>Tus datos del ciclo se almacenan <b>cifrados</b>. Vos sos la dueña del dato.</li>
          <li><b>Revocación inmediata:</b> al desactivar el registro, se borra y tu coach deja de ver cualquier contexto al instante.</li>
        </ul>
        <p style={p}>Esto no reemplaza el consejo de un profesional de la salud.</p>
      </Section>

      <Section title="9. Seguridad">
        <p style={p}>
          Las contraseñas se almacenan con hashing fuerte, las sesiones son revocables y los datos
          sensibles del ciclo se cifran en reposo. El acceso del coach a datos de una atleta exige un
          vínculo aceptado por ambas partes.
        </p>
      </Section>

      <Section title="10. Menores, cambios y reclamos">
        <p style={p}>
          El servicio está dirigido a personas mayores de edad o que cuenten con autorización de su
          representante legal. Si actualizamos esta política de forma material, te lo informaremos y, si
          corresponde, te pediremos que la aceptes de nuevo. Ante cualquier reclamo, contactanos en{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> o ante la autoridad de protección de
          datos de tu país.
        </p>
      </Section>
    </LegalShell>
  );
}

/** Términos de uso — v1 (beta legal). */
export function TerminosPage() {
  return (
    <LegalShell title="Términos de uso" version={LEGAL_TERMS_VERSION}>
      <Section title="1. El servicio">
        <p style={p}>
          Holy Oly es una herramienta de coordinación deportiva entre coach y atleta. <b>No es un servicio
          médico</b> ni reemplaza el asesoramiento de profesionales de la salud, nutrición o medicina
          deportiva.
        </p>
      </Section>

      <Section title="2. Cuenta y elegibilidad">
        <p style={p}>
          Necesitás una cuenta para usar la app. Sos responsable de la confidencialidad de tu contraseña
          y de la actividad de tu cuenta. Los datos que cargás deben ser veraces.
        </p>
      </Section>

      <Section title="3. Roles y responsabilidades">
        <ul style={ul}>
          <li>El <b>coach</b> es responsable de las decisiones de programación del entrenamiento.</li>
          <li>El <b>atleta</b> es responsable de reportar su estado con honestidad y de escuchar a su cuerpo.</li>
        </ul>
      </Section>

      <Section title="4. Exención médica y emergencias">
        <p style={p}>
          La app no diagnostica, no trata ni atiende emergencias. Ante dolor persistente, lesión o
          cualquier señal de alarma de salud, consultá a un profesional. El uso de la información es bajo
          tu responsabilidad.
        </p>
      </Section>

      <Section title="5. Suscripción y facturación (coach)">
        <p style={p}>
          La suscripción del coach se factura por separado a través del proveedor de pagos. Los atletas no
          pagan por vincularse a un coach. Podés ver y gestionar tu plan desde la app.
        </p>
      </Section>

      <Section title="6. Uso aceptable y propiedad intelectual">
        <p style={p}>
          No está permitido usar la app para fines ilícitos, vulnerar la seguridad ni acceder a datos de
          terceros sin autorización. El software y la marca pertenecen a Holy Oly; tus datos son tuyos.
        </p>
      </Section>

      <Section title="7. Suspensión y limitación de responsabilidad">
        <p style={p}>
          Podemos suspender cuentas por abuso, fraude o incumplimiento de estos términos. En la medida que
          la ley lo permita, el servicio se ofrece «tal cual» y no respondemos por daños indirectos
          derivados de decisiones de entrenamiento.
        </p>
      </Section>

      <Section title="8. Cambios, ley aplicable y contacto">
        <p style={p}>
          Podemos actualizar estos términos; si el cambio es material te lo informaremos. Para consultas,
          escribinos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </LegalShell>
  );
}
