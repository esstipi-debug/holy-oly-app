import type { ReactNode } from "react";
import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { useFormat } from "./useFormat";

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

beforeEach(async () => {
  await i18n.changeLanguage("es-419");
});

describe("useFormat", () => {
  test("number formatting follows the active language", async () => {
    const { result, rerender } = renderHook(() => useFormat(), { wrapper });
    // es-419 (neutral Latin America) is mapped to es-CL → dot grouping (the app's convention).
    expect(result.current.number(1234567)).toBe("1.234.567");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    rerender();
    // en groups thousands with commas — proves the binding follows the active language.
    expect(result.current.number(1234567)).toBe("1,234,567");
  });

  test("currency formatting follows the active language", async () => {
    await i18n.changeLanguage("en");
    const { result } = renderHook(() => useFormat(), { wrapper });
    expect(result.current.currency(19.99, "USD")).toBe("$19.99");
  });

  test("date formatting follows the active language", async () => {
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", timeZone: "UTC" };
    const { result, rerender } = renderHook(() => useFormat(), { wrapper });
    expect(result.current.date("2026-06-12", opts)).toMatch(/junio/i);
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    rerender();
    expect(result.current.date("2026-06-12", opts)).toMatch(/june/i);
  });
});
