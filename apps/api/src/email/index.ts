/**
 * Email delivery (B0 / D1).
 *
 * Providers, keyed by EMAIL_PROVIDER:
 *   - "console" (default): logs to stdout — dev/test sink, no network.
 *   - "google": real transactional email via Google SMTP + App Password (see ./google).
 *
 * The public surface (sendEmail, appOrigin) is unchanged so callers in auth/** keep working.
 * Future providers (resend | postmark | ses) would slot into the same switch.
 */

import { sendViaGoogle, type OutboundMessage } from "./google";

export type EmailTemplate = "password_reset" | "email_verify";

export interface EmailPayload {
  resetUrl?: string;
  verifyUrl?: string;
}

/** Resolved per-call so env changes (and tests) take effect without reimport. */
function activeProvider(): string {
  return process.env.EMAIL_PROVIDER ?? "console";
}

function subjectFor(template: EmailTemplate): string {
  if (template === "password_reset") return "Restablecé tu contraseña — Holy Oly";
  return "Confirmá tu email — Holy Oly";
}

function textFor(template: EmailTemplate, data: EmailPayload): string {
  if (template === "password_reset") {
    return `Recibimos un pedido para restablecer tu contraseña.\n\n${data.resetUrl ?? ""}\n\nEl enlace expira en 1 hora. Si no lo pediste, ignorá este mensaje.`;
  }
  return `Confirmá tu cuenta de coach en Holy Oly:\n\n${data.verifyUrl ?? ""}\n\nEl enlace expira en 24 horas.`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlFor(template: EmailTemplate, data: EmailPayload): string {
  const isReset = template === "password_reset";
  const url = (isReset ? data.resetUrl : data.verifyUrl) ?? "";
  const safeUrl = escapeHtml(url);
  const intro = isReset
    ? "Recibimos un pedido para restablecer tu contraseña."
    : "Confirmá tu cuenta de coach en Holy Oly:";
  const cta = isReset ? "Restablecer contraseña" : "Confirmar email";
  const note = isReset
    ? "El enlace expira en 1 hora. Si no lo pediste, ignorá este mensaje."
    : "El enlace expira en 24 horas.";
  return [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;line-height:1.5">`,
    `<p>${escapeHtml(intro)}</p>`,
    url
      ? `<p><a href="${safeUrl}" style="display:inline-block;padding:10px 18px;background:#d6006e;color:#fff;border-radius:8px;text-decoration:none">${cta}</a></p>` +
        `<p style="font-size:13px;color:#555">O copiá este enlace: <br><span style="word-break:break-all">${safeUrl}</span></p>`
      : "",
    `<p style="font-size:13px;color:#555">${escapeHtml(note)}</p>`,
    `<p style="font-size:12px;color:#888">Holy Oly</p>`,
    `</div>`,
  ].join("");
}

/** Build the rendered, provider-agnostic message for a template + data. */
export function renderEmail(to: string, template: EmailTemplate, data: EmailPayload): OutboundMessage {
  return {
    to,
    subject: subjectFor(template),
    text: textFor(template, data),
    html: htmlFor(template, data),
  };
}

export async function sendEmail(to: string, template: EmailTemplate, data: EmailPayload): Promise<void> {
  const message = renderEmail(to, template, data);
  const provider = activeProvider();

  if (provider === "google") {
    await sendViaGoogle(message);
    return;
  }

  if (provider === "console") {
    console.info(`[email:${template}] to=${to}\n${message.text}`);
    return;
  }

  // Future: resend | postmark | ses adapters keyed by EMAIL_PROVIDER + API keys server-side.
  throw new Error(`EMAIL_PROVIDER '${provider}' is not configured`);
}

export function appOrigin(): string {
  return process.env.APP_ORIGIN ?? process.env.WEB_ORIGIN ?? "http://localhost:8765";
}
