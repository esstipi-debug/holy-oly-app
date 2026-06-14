import type { ReactNode } from "react";
import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "./index";
import { useLocale, useLegalLang } from "./useLocale";

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

beforeEach(async () => {
  await i18n.changeLanguage("es-419");
});

describe("useLocale", () => {
  test("reports the active language", () => {
    const { result } = renderHook(() => useLocale(), { wrapper });
    expect(result.current.lang).toBe("es-419");
  });

  test("setLang switches the whole app language", async () => {
    const { result } = renderHook(() => useLocale(), { wrapper });
    act(() => result.current.setLang("en"));
    await waitFor(() => expect(result.current.lang).toBe("en"));
  });

  test("exposes the toggle language list", () => {
    const { result } = renderHook(() => useLocale(), { wrapper });
    expect(result.current.languages).toEqual(["es-419", "en", "pt-BR"]);
  });

  test("the pseudo-locale never yields an invalid selector value", async () => {
    await i18n.changeLanguage("en-XA");
    const { result } = renderHook(() => useLocale(), { wrapper });
    expect(["es-419", "en", "pt-BR"]).toContain(result.current.lang);
  });
});

describe("useLegalLang", () => {
  test("collapses Spanish variants to 'es' and English to 'en'", async () => {
    const { result } = renderHook(() => useLegalLang(), { wrapper });
    expect(result.current).toBe("es");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    await waitFor(() => expect(result.current).toBe("en"));
  });
});
