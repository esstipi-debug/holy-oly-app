import * as jose from "jose";
import { appOrigin } from "../email";

export const GOOGLE_PROVIDER = "google";
export const OAUTH_CTX_COOKIE = "oauth_ctx";
export const OAUTH_PENDING_COOKIE = "oauth_pending";
export const OAUTH_COOKIE_MAX_AGE_SEC = 600;

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function apiOrigin(): string {
  const raw = process.env.API_ORIGIN ?? appOrigin();
  return raw.replace(/\/$/, "");
}

export function googleRedirectUri(): string {
  return `${apiOrigin()}/auth/google/callback`;
}

export function oauthStateSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("Google OAuth state secret is not configured");
  return secret;
}

export function buildGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<{ idToken: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`google token exchange failed (${res.status})`);
  }
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error("google token response missing id_token");
  return { idToken: json.id_token };
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const JWKS = jose.createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  const sub = payload.sub;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!sub || !email) throw new Error("google id token missing sub or email");
  return {
    sub,
    email: email.trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}

export function oauthCookieOpts(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export function webRedirect(path = "/"): string {
  return `${appOrigin().replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
