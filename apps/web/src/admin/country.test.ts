import { describe, it, expect } from "vitest";
import { countryFlag, countryName, countryLabel } from "./country";

describe("countryFlag", () => {
  it("maps a 2-letter code to regional-indicator flag emoji", () => {
    expect(countryFlag("AR")).toBe("🇦🇷");
    expect(countryFlag("cl")).toBe("🇨🇱");
  });
  it("returns empty string for invalid/missing codes", () => {
    expect(countryFlag(null)).toBe("");
    expect(countryFlag("ARG")).toBe("");
    expect(countryFlag("1")).toBe("");
  });
});

describe("countryName", () => {
  it("resolves the Spanish country name", () => {
    expect(countryName("AR")).toBe("Argentina");
  });
  it("falls back to '—' when there is no code", () => {
    expect(countryName(null)).toBe("—");
  });
});

describe("countryLabel", () => {
  it("combines flag + name", () => {
    expect(countryLabel("AR")).toBe("🇦🇷 Argentina");
  });
  it("is '—' for a missing country", () => {
    expect(countryLabel(null)).toBe("—");
  });
});
