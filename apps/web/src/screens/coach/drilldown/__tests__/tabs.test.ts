import { toTab } from "../tabs";

test("toTab acepta las 3 tabs conocidas", () => {
  expect(toTab("resumen")).toBe("resumen");
  expect(toTab("monitor")).toBe("monitor");
  expect(toTab("plan")).toBe("plan");
});

test("toTab cae a 'resumen' ante null/undefined/vacío/basura", () => {
  expect(toTab(null)).toBe("resumen");
  expect(toTab(undefined)).toBe("resumen");
  expect(toTab("")).toBe("resumen");
  expect(toTab("palmares")).toBe("resumen"); // tab vieja eliminada
  expect(toTab("MONITOR")).toBe("resumen"); // case-sensitive a propósito
});
