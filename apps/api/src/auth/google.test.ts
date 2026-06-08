import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { googleConfigured, buildGoogleAuthUrl, googleRedirectUri } from "./google";

describe("google auth config", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "";
    process.env.GOOGLE_CLIENT_SECRET = "";
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("reports disabled without credentials", () => {
    expect(googleConfigured()).toBe(false);
  });

  it("builds authorize URL when configured", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.API_ORIGIN = "http://localhost:3000";
    expect(googleConfigured()).toBe(true);
    const url = new URL(buildGoogleAuthUrl("state-nonce"));
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("state-nonce");
    expect(url.searchParams.get("redirect_uri")).toBe(googleRedirectUri());
  });
});
