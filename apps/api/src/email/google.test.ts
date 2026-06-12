import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the SMTP transport: createTransport() returns a stub whose sendMail we inspect.
// NEVER opens a real SMTP connection. Defined via vi.hoisted so the (hoisted)
// vi.mock factory can reference them.
interface MailArg {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}
const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn(async (_msg: MailArg) => ({ messageId: "test-id" }));
  const createTransport = vi.fn(() => ({ sendMail }));
  return { sendMail, createTransport };
});
vi.mock("nodemailer", () => ({
  default: { createTransport },
  createTransport,
}));

import { sendViaGoogle, googleEmailConfigured, resetGoogleTransport } from "./google";
import { sendEmail, renderEmail } from "./index";

const ENV = { ...process.env };

beforeEach(() => {
  sendMail.mockClear();
  createTransport.mockClear();
  resetGoogleTransport();
  delete process.env.EMAIL_PROVIDER;
  delete process.env.GOOGLE_SMTP_USER;
  delete process.env.GOOGLE_SMTP_APP_PASSWORD;
  delete process.env.EMAIL_FROM;
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("google email adapter (D1)", () => {
  it("reports not-configured without credentials", () => {
    expect(googleEmailConfigured()).toBe(false);
    process.env.GOOGLE_SMTP_USER = "coach@example.com";
    expect(googleEmailConfigured()).toBe(false); // app password still missing
    process.env.GOOGLE_SMTP_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(googleEmailConfigured()).toBe(true);
  });

  it("builds an SSL transport on smtp.gmail.com:465 with the app-password auth", async () => {
    process.env.GOOGLE_SMTP_USER = "coach@example.com";
    process.env.GOOGLE_SMTP_APP_PASSWORD = "app-pass";
    await sendViaGoogle({ to: "a@b.com", subject: "S", text: "T", html: "<p>T</p>" });
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: "coach@example.com", pass: "app-pass" },
      }),
    );
  });

  it("calls sendMail with from/to/subject/text/html", async () => {
    process.env.GOOGLE_SMTP_USER = "coach@example.com";
    process.env.GOOGLE_SMTP_APP_PASSWORD = "app-pass";
    await sendViaGoogle({ to: "athlete@x.com", subject: "Hola", text: "texto", html: "<b>html</b>" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: "coach@example.com", // defaults to GOOGLE_SMTP_USER when EMAIL_FROM unset
      to: "athlete@x.com",
      subject: "Hola",
      text: "texto",
      html: "<b>html</b>",
    });
  });

  it("uses EMAIL_FROM as the From header when set", async () => {
    process.env.GOOGLE_SMTP_USER = "smtp-bot@example.com";
    process.env.GOOGLE_SMTP_APP_PASSWORD = "app-pass";
    process.env.EMAIL_FROM = "Holy Oly <no-reply@holy-oly.com>";
    await sendViaGoogle({ to: "athlete@x.com", subject: "S", text: "t", html: "<p>t</p>" });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Holy Oly <no-reply@holy-oly.com>" }),
    );
  });

  it("throws a clear error (not a silent no-op) when credentials are missing", async () => {
    process.env.GOOGLE_SMTP_USER = "coach@example.com"; // app password missing
    await expect(
      sendViaGoogle({ to: "a@b.com", subject: "S", text: "t", html: "<p>t</p>" }),
    ).rejects.toThrow(/GOOGLE_SMTP_APP_PASSWORD/);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("sendEmail provider switch", () => {
  it("routes to Google when EMAIL_PROVIDER=google, with rendered subject/html", async () => {
    process.env.EMAIL_PROVIDER = "google";
    process.env.GOOGLE_SMTP_USER = "coach@example.com";
    process.env.GOOGLE_SMTP_APP_PASSWORD = "app-pass";
    await sendEmail("athlete@x.com", "password_reset", { resetUrl: "https://app/reset?token=xyz" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = sendMail.mock.calls[0]![0];
    expect(arg.to).toBe("athlete@x.com");
    expect(arg.subject).toBe("Restablecé tu contraseña — Holy Oly");
    expect(arg.html).toContain("https://app/reset?token=xyz");
    expect(arg.text).toContain("https://app/reset?token=xyz");
  });

  it("console provider (default) logs and never touches nodemailer", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await sendEmail("athlete@x.com", "email_verify", { verifyUrl: "https://app/verify?token=abc" });
    expect(info).toHaveBeenCalledTimes(1);
    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it("throws for an unknown provider", async () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    await expect(sendEmail("a@b.com", "email_verify", { verifyUrl: "u" })).rejects.toThrow(
      /sendgrid/,
    );
  });
});

describe("renderEmail templates", () => {
  it("escapes HTML-unsafe characters in the URL", () => {
    const msg = renderEmail("a@b.com", "email_verify", {
      verifyUrl: 'https://app/verify?token=a"b&c<d',
    });
    expect(msg.html).not.toContain('token=a"b&c<d'); // raw unsafe chars must be escaped
    expect(msg.html).toContain("&quot;");
    expect(msg.html).toContain("&amp;");
    expect(msg.text).toContain('https://app/verify?token=a"b&c<d'); // text stays raw
  });
});
