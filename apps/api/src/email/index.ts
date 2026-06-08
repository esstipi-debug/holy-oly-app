/** Email delivery (B0). Console provider in dev; plug Resend/Postmark/SES via EMAIL_PROVIDER. */

export type EmailTemplate = "password_reset" | "email_verify";

export interface EmailPayload {
  resetUrl?: string;
  verifyUrl?: string;
}

const PROVIDER = process.env.EMAIL_PROVIDER ?? "console";

function subjectFor(template: EmailTemplate): string {
  if (template === "password_reset") return "Restablecé tu contraseña — Holy Oly";
  return "Confirmá tu email — Holy Oly";
}

function bodyFor(template: EmailTemplate, data: EmailPayload): string {
  if (template === "password_reset") {
    return `Recibimos un pedido para restablecer tu contraseña.\n\n${data.resetUrl ?? ""}\n\nEl enlace expira en 1 hora. Si no lo pediste, ignorá este mensaje.`;
  }
  return `Confirmá tu cuenta de coach en Holy Oly:\n\n${data.verifyUrl ?? ""}\n\nEl enlace expira en 24 horas.`;
}

export async function sendEmail(to: string, template: EmailTemplate, data: EmailPayload): Promise<void> {
  if (PROVIDER === "console" || process.env.NODE_ENV === "test") {
    // eslint-disable-next-line no-console -- intentional dev/test sink (B0)
    console.info(`[email:${template}] to=${to}\n${bodyFor(template, data)}`);
    return;
  }
  // Future: resend | postmark | ses adapters keyed by EMAIL_PROVIDER + API keys server-side.
  throw new Error(`EMAIL_PROVIDER '${PROVIDER}' is not configured`);
}

export function appOrigin(): string {
  return process.env.APP_ORIGIN ?? process.env.WEB_ORIGIN ?? "http://localhost:8765";
}
