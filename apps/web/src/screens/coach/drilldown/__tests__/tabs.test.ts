import { toTab } from "../tabs";

test("toTab acepta las 2 tabs conocidas", () => {
  expect(toTab("plan")).toBe("plan");
  expect(toTab("monitor")).toBe("monitor");
});

test("toTab cae a 'plan' ante null/undefined/vacío/basura (incluida la vieja 'resumen')", () => {
  expect(toTab(null)).toBe("plan");
  expect(toTab(undefined)).toBe("plan");
  expect(toTab("")).toBe("plan");
  expect(toTab("resumen")).toBe("plan"); // tab eliminada
  expect(toTab("palmares")).toBe("plan"); // tab vieja eliminada
  expect(toTab("MONITOR")).toBe("plan"); // case-sensitive a propósito
});
