import { describe, test, expect, afterAll } from "vitest";
import i18n from "./index";

afterAll(async () => {
  await i18n.changeLanguage("es-419");
});

describe("i18n init", () => {
  test("resolves common keys in the default es-419 locale", async () => {
    await i18n.changeLanguage("es-419");
    expect(i18n.t("loading")).toBe("Cargando…");
  });

  test("resolves English", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("loading")).toBe("Loading…");
  });

  test("es-AR overlays the voseo voice but inherits the rest from es-419", async () => {
    await i18n.changeLanguage("es-AR");
    expect(i18n.t("tryAgain")).toBe("Probá de nuevo."); // voseo override
    expect(i18n.t("loading")).toBe("Cargando…"); // inherited from es-419 via fallback
  });

  test("ICU plural rules format counts correctly", async () => {
    await i18n.changeLanguage("en");
    i18n.addResource("en", "common", "_test_weeks", "{count, plural, one {# week} other {# weeks}}");
    expect(i18n.t("_test_weeks", { count: 1 })).toBe("1 week");
    expect(i18n.t("_test_weeks", { count: 4 })).toBe("4 weeks");
  });

  test("the en-XA pseudo-locale accents output and wraps it in markers", async () => {
    await i18n.changeLanguage("en-XA");
    const out = i18n.t("loading");
    expect(out.startsWith("⟦")).toBe(true);
    expect(out).not.toContain("Loading");
  });
});
