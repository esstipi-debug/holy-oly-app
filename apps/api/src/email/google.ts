/**
 * Google (Gmail / Google Workspace) email adapter — D1.
 *
 * Transactional delivery via SMTP using a Google App Password and Nodemailer.
 * This is the real, simplest path to unblock go-live. OAuth2 / the Gmail API is a
 * future upgrade (refresh-token rotation, no app-password) and is intentionally NOT
 * implemented here — an App Password over SMTP+SSL is sufficient.
 *
 * Selected when EMAIL_PROVIDER=google. Required env (server-side only):
 *   GOOGLE_SMTP_USER         the sending mailbox, e.g. coach@your-domain.com
 *   GOOGLE_SMTP_APP_PASSWORD a 16-char Google App Password (NOT the account password)
 *   EMAIL_FROM               optional From header; defaults to GOOGLE_SMTP_USER
 */

import nodemailer, { type Transporter } from "nodemailer";

const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465; // implicit TLS (SSL)

export interface OutboundMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface GoogleSmtpConfig {
  user: string;
  appPassword: string;
  from: string;
}

/** True when all credentials required by the Google adapter are present. */
export function googleEmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SMTP_USER && process.env.GOOGLE_SMTP_APP_PASSWORD);
}

function readConfig(): GoogleSmtpConfig {
  const user = process.env.GOOGLE_SMTP_USER;
  const appPassword = process.env.GOOGLE_SMTP_APP_PASSWORD;
  if (!user || !appPassword) {
    const missing = [
      !user ? "GOOGLE_SMTP_USER" : null,
      !appPassword ? "GOOGLE_SMTP_APP_PASSWORD" : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `EMAIL_PROVIDER=google selected but missing required env: ${missing}. ` +
        `Set ${missing} (App Password from a Google/Workspace account) to send email.`,
    );
  }
  return { user, appPassword, from: process.env.EMAIL_FROM?.trim() || user };
}

// Lazily build a single transport. Nodemailer pools/reuses the SMTP connection,
// so we keep one instance keyed by the credentials it was built with.
let cached: { transport: Transporter; user: string } | null = null;

function transportFor(config: GoogleSmtpConfig): Transporter {
  if (cached && cached.user === config.user) return cached.transport;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true, // port 465 → SSL on connect
    auth: { user: config.user, pass: config.appPassword },
  });
  cached = { transport, user: config.user };
  return transport;
}

/** Reset the cached transport. Used by tests; harmless in production. */
export function resetGoogleTransport(): void {
  cached = null;
}

/**
 * Send one transactional message via Google SMTP.
 * Throws a clear error (not a silent no-op) when credentials are missing.
 */
export async function sendViaGoogle(message: OutboundMessage): Promise<void> {
  const config = readConfig();
  const transport = transportFor(config);
  await transport.sendMail({
    from: config.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
