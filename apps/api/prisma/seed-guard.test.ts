import { describe, it, expect } from "vitest";
import { assertSeedAllowed, loadSeedConfig } from "./seed-guard";

describe("assertSeedAllowed", () => {
  it("throws when NODE_ENV=production and ALLOW_DEMO_SEED is unset", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production" })).toThrow(/production/i);
  });

  it("allows production seeding only with an explicit ALLOW_DEMO_SEED=true override", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production", ALLOW_DEMO_SEED: "true" })).not.toThrow();
  });

  it("does not block seeding outside production", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "test" })).not.toThrow();
    expect(() => assertSeedAllowed({})).not.toThrow();
  });
});

describe("loadSeedConfig", () => {
  it("uses committed demo defaults outside production", () => {
    const cfg = loadSeedConfig({ NODE_ENV: "test" });
    expect(cfg.coachEmail).toBe("coach@holyoly.dev");
    expect(cfg.coachPassword).toBe("holyoly-demo");
  });

  it("refuses committed defaults in production — SEED_* must be set explicitly", () => {
    expect(() =>
      loadSeedConfig({ NODE_ENV: "production", ALLOW_DEMO_SEED: "true" }),
    ).toThrow(/must be set|SEED_/i);
  });

  it("accepts explicit secrets in production and normalizes the email", () => {
    const cfg = loadSeedConfig({
      NODE_ENV: "production",
      ALLOW_DEMO_SEED: "true",
      SEED_COACH_EMAIL: "  Real@Coach.com ",
      SEED_COACH_PASSWORD: "a-strong-secret",
      SEED_INVITE_CODE: "ABCDEFGH2345",
      SEED_ATLETA_EMAIL: "a@x.com",
      SEED_ATLETA_PASSWORD: "p2-strong",
      SEED_MARA_EMAIL: "m@x.com",
      SEED_MARA_PASSWORD: "p3-strong",
    });
    expect(cfg.coachEmail).toBe("real@coach.com");
    expect(cfg.coachPassword).toBe("a-strong-secret");
    expect(cfg.coachInvite).toBe("ABCDEFGH2345");
  });
});
