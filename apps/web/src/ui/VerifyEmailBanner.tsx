import { useState } from "react";
import { useTranslation } from "react-i18next";
import { resendVerificationEmail } from "../auth/authClient";

/**
 * Banner "Verificá tu email" + reenvío con estados visibles (W4) — extraído de SuscripcionScreen
 * (W5) para reusarlo en toda superficie de coach con email sin verificar (Suscripción, Equipo,
 * Cuenta). 100% API: quien lo monta ya gateó por `user.emailVerified === false`.
 */
export function VerifyEmailBanner({ sub }: { sub?: string }) {
  const { t } = useTranslation();
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const subText = sub ?? t("verifyEmail.defaultSub");

  async function onResend(): Promise<void> {
    setResend("sending");
    try {
      await resendVerificationEmail();
      setResend("sent");
    } catch {
      setResend("error");
    }
  }

  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-accent) 30%,transparent)" }}>
      <div style={{ fontWeight: 700 }}>{t("verifyEmail.title")}</div>
      <div style={{ fontSize: 12, color: "var(--wl-muted)", marginTop: 4 }}>{subText}</div>
      <button
        type="button"
        disabled={resend === "sending" || resend === "sent"}
        onClick={() => void onResend()}
        style={{ marginTop: 8, padding: "8px 12px", borderRadius: 10, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontWeight: 700, cursor: resend === "sending" || resend === "sent" ? "default" : "pointer", opacity: resend === "sending" ? 0.45 : 1 }}
      >
        {/* role="status": el éxito del reenvío se ANUNCIA (lector de pantalla), no sólo cambia el texto del botón. */}
        {resend === "sending" ? t("verifyEmail.sending") : resend === "sent" ? <span role="status">{t("verifyEmail.sent")}</span> : t("verifyEmail.resend")}
      </button>
      {resend === "error" && (
        <div role="alert" style={{ marginTop: 8, color: "var(--wl-danger)", fontSize: 12 }}>
          {t("verifyEmail.error")}
        </div>
      )}
    </div>
  );
}
