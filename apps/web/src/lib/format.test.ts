import { describe, test, expect } from "vitest";
import { formatNumber, formatCurrency, formatDate, intlLocale } from "./format";

describe("intlLocale", () => {
  test("passes real locales through and maps the pseudo-locale to English", () => {
    expect(intlLocale("es-419")).toBe("es-419");
    expect(intlLocale("es-AR")).toBe("es-AR");
    expect(intlLocale("en")).toBe("en");
    expect(intlLocale("en-XA")).toBe("en");
  });
});

describe("formatNumber", () => {
  test("groups thousands the way each locale expects", () => {
    expect(formatNumber(1234567, "en")).toBe("1,234,567");
    expect(formatNumber(1234567, "es-CL")).toBe("1.234.567");
  });

  test("honors fraction-digit options", () => {
    expect(formatNumber(1.2345, "en", { maximumFractionDigits: 2 })).toBe("1.23");
  });

  test("does not throw for the neutral es-419 default", () => {
    expect(() => formatNumber(1000, "es-419")).not.toThrow();
  });
});

describe("formatCurrency", () => {
  test("formats Chilean pesos without decimals", () => {
    const out = formatCurrency(19990, "es-CL", "CLP", { maximumFractionDigits: 0 });
    expect(out).toContain("$");
    expect(out).toContain("19.990");
  });

  test("formats US dollars in English", () => {
    expect(formatCurrency(19.99, "en", "USD")).toBe("$19.99");
  });
});

describe("formatDate", () => {
  test("renders the month name in the active language", () => {
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", timeZone: "UTC" };
    expect(formatDate("2026-06-12", "es-419", opts)).toMatch(/junio/i);
    expect(formatDate("2026-06-12", "en", opts)).toMatch(/june/i);
  });

  test("accepts Date objects, ISO strings and timestamps", () => {
    const opts: Intl.DateTimeFormatOptions = { year: "numeric", timeZone: "UTC" };
    expect(formatDate(new Date("2026-06-12T00:00:00Z"), "en", opts)).toContain("2026");
    expect(formatDate("2026-06-12", "en", opts)).toContain("2026");
    expect(formatDate(Date.UTC(2026, 5, 12), "en", opts)).toContain("2026");
  });
});
