import { describe, test, expect } from "vitest";
import {
  normalizeLang,
  htmlLangFor,
  DEFAULT_LANG,
  PSEUDO_LANG,
  TOGGLE_LANGS,
  SUPPORTED_LANGS,
  LANG_LABELS,
} from "./config";

describe("normalizeLang", () => {
  test("returns our exact codes unchanged", () => {
    expect(normalizeLang("es-419")).toBe("es-419");
    expect(normalizeLang("es-AR")).toBe("es-AR");
    expect(normalizeLang("en")).toBe("en");
  });

  test("maps Rioplatense browser tags to es-AR", () => {
    expect(normalizeLang("es-ar")).toBe("es-AR");
    expect(normalizeLang("es-AR")).toBe("es-AR");
  });

  test("maps any other Spanish variant to the neutral es-419 default", () => {
    expect(normalizeLang("es")).toBe("es-419");
    expect(normalizeLang("es-CL")).toBe("es-419");
    expect(normalizeLang("es-MX")).toBe("es-419");
    expect(normalizeLang("es-ES")).toBe("es-419");
  });

  test("maps any English variant to en", () => {
    expect(normalizeLang("en-US")).toBe("en");
    expect(normalizeLang("en-GB")).toBe("en");
  });

  test("maps any Portuguese variant to pt-BR (Brazilian Portuguese is the base)", () => {
    expect(normalizeLang("pt-BR")).toBe("pt-BR");
    expect(normalizeLang("pt")).toBe("pt-BR");
    expect(normalizeLang("pt-PT")).toBe("pt-BR");
  });

  test("recognizes the en-XA pseudo-locale", () => {
    expect(normalizeLang("en-XA")).toBe(PSEUDO_LANG);
    expect(normalizeLang("en-xa")).toBe(PSEUDO_LANG);
  });

  test("trims and is case-insensitive", () => {
    expect(normalizeLang("  EN-us ")).toBe("en");
    expect(normalizeLang("ES-419")).toBe("es-419");
  });

  test("returns null for unsupported or empty input", () => {
    expect(normalizeLang("fr")).toBeNull();
    expect(normalizeLang("ja")).toBeNull();
    expect(normalizeLang("")).toBeNull();
    expect(normalizeLang(null)).toBeNull();
    expect(normalizeLang(undefined)).toBeNull();
  });
});

describe("htmlLangFor", () => {
  test("returns the BCP-47 attribute for real locales", () => {
    expect(htmlLangFor("es-419")).toBe("es-419");
    expect(htmlLangFor("es-AR")).toBe("es-AR");
    expect(htmlLangFor("en")).toBe("en");
  });

  test("presents the pseudo-locale as plain English to the browser", () => {
    expect(htmlLangFor("en-XA")).toBe("en");
  });

  test("falls back to the default for unknown values", () => {
    expect(htmlLangFor("garbage")).toBe(DEFAULT_LANG);
  });
});

describe("locale constants", () => {
  test("the global default is neutral Latin-American Spanish", () => {
    expect(DEFAULT_LANG).toBe("es-419");
  });

  test("the toggle exposes the three base languages (es-AR is auto-detected)", () => {
    expect(TOGGLE_LANGS).toEqual(["es-419", "en", "pt-BR"]);
  });

  test("every supported user locale has a human label", () => {
    for (const lng of TOGGLE_LANGS) {
      expect(LANG_LABELS[lng]).toBeTruthy();
    }
  });

  test("supported locales include both Spanish variants, English and the pseudo-locale", () => {
    expect(SUPPORTED_LANGS).toContain("es-419");
    expect(SUPPORTED_LANGS).toContain("es-AR");
    expect(SUPPORTED_LANGS).toContain("en");
    expect(SUPPORTED_LANGS).toContain("pt-BR");
    expect(SUPPORTED_LANGS).toContain(PSEUDO_LANG);
  });
});
