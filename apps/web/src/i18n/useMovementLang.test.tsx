import type { ReactNode } from "react";
import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "./index";
import { useMovementLang } from "./useMovementLang";
import { setMovementLangPref } from "./movementLang";

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

beforeEach(async () => {
  localStorage.clear();
  setMovementLangPref("auto");
  await i18n.changeLanguage("es-419");
});

describe("useMovementLang", () => {
  test("'auto' follows the UI language", async () => {
    const { result, rerender } = renderHook(() => useMovementLang(), { wrapper });
    expect(result.current.resolved).toBe("es");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    rerender();
    expect(result.current.resolved).toBe("en");
  });

  test("an explicit English choice overrides a Spanish UI", () => {
    const { result } = renderHook(() => useMovementLang(), { wrapper });
    act(() => result.current.setPref("en"));
    expect(result.current.resolved).toBe("en");
    expect(result.current.pref).toBe("en");
  });
});
