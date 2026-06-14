import { describe, test, expect } from "vitest";
import { pseudoize } from "./pseudo";

describe("pseudoize", () => {
  test("accents Latin letters so un-extracted strings stand out", () => {
    const out = pseudoize("Save");
    // The original ASCII word must not survive verbatim.
    expect(out).not.toContain("Save");
    // But its accented shadow should be recognizable (same length core).
    expect(out).toMatch(/[ŚŠ].*[áàâ].*/i);
  });

  test("wraps output in markers and pads length to surface truncation", () => {
    const out = pseudoize("Hi");
    expect(out.startsWith("⟦")).toBe(true);
    expect(out.endsWith("⟧")).toBe(true);
    // Padded longer than the source to reveal layout overflow.
    expect(out.length).toBeGreaterThan("Hi".length + 2);
  });

  test("never mangles ICU placeholders so interpolation still works", () => {
    const out = pseudoize("Hola {name}, tenés {count} días");
    expect(out).toContain("{name}");
    expect(out).toContain("{count}");
  });

  test("preserves Trans component tag markers like <0> and </0>", () => {
    const out = pseudoize("Acepto los <0>términos</0>");
    expect(out).toContain("<0>");
    expect(out).toContain("</0>");
  });

  test("is a pure, deterministic transform", () => {
    expect(pseudoize("Holy Oly")).toBe(pseudoize("Holy Oly"));
  });

  test("handles empty string without throwing", () => {
    expect(() => pseudoize("")).not.toThrow();
  });

  test("a lone '<' (a comparison, not a Trans tag) still accents the text after it", () => {
    // "menor < mayor" — the 'mayor' must still be pseudoized; only real <0> tags are skipped.
    const out = pseudoize("ab < cd");
    expect(out).toContain("ç"); // c -> ç proves text after the bare '<' was transformed
    expect(out).toContain("<");
  });

  test("a lone '>' is preserved and surrounding words are accented", () => {
    const out = pseudoize("más > menos");
    expect(out).toContain(">");
    expect(out).toContain("ɱ"); // m -> ɱ (from "menos")
  });

  test("preserves nested ICU plural/select braces verbatim", () => {
    const src = "{count, plural, one {# semana} other {# semanas}}";
    const out = pseudoize(src);
    expect(out).toContain("{count, plural,");
    expect(out).toContain("{# semana}");
    expect(out).toContain("{# semanas}");
  });

  test("does not throw on unbalanced braces", () => {
    expect(() => pseudoize("a } b { c")).not.toThrow();
  });
});
