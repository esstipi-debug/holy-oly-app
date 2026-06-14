import { describe, test, expect, beforeEach } from "vitest";
import {
  resolveMovementLang,
  getMovementLangPref,
  setMovementLangPref,
  MOVEMENT_LANG_KEY,
  MOVEMENT_LANGS,
} from "./movementLang";

beforeEach(() => {
  localStorage.clear();
  setMovementLangPref("auto");
});

describe("resolveMovementLang", () => {
  test("'auto' follows the UI language", () => {
    expect(resolveMovementLang("auto", "es-419")).toBe("es");
    expect(resolveMovementLang("auto", "es-AR")).toBe("es");
    expect(resolveMovementLang("auto", "en")).toBe("en");
  });

  test("an explicit choice overrides the UI language", () => {
    // A Spanish-UI coach who wants English nomenclature (snatch / C&J).
    expect(resolveMovementLang("en", "es-419")).toBe("en");
    // And the reverse.
    expect(resolveMovementLang("es", "en")).toBe("es");
  });
});

describe("movement-language preference store", () => {
  test("defaults to 'auto'", () => {
    expect(getMovementLangPref()).toBe("auto");
  });

  test("setting the preference persists it and notifies subscribers", () => {
    setMovementLangPref("en");
    expect(getMovementLangPref()).toBe("en");
    expect(localStorage.getItem(MOVEMENT_LANG_KEY)).toBe("en");
  });

  test("exposes the three options for a toggle", () => {
    expect(MOVEMENT_LANGS).toEqual(["auto", "es", "en"]);
  });
});
